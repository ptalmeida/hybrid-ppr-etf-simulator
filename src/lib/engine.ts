import type {
  RedemptionEntry,
  ScenarioId,
  ScenarioResult,
  SimConfig,
  SimOutput,
  Tranche,
  YearRow,
} from './types';
import {
  CLAWBACK_MAJORATION_PER_YEAR,
  contributionForYear,
  irsBenefit,
  irsCapForAge,
  IRS_DEDUCTION_RATE,
  PPR_LEGAL_EXIT_AGE,
  PPR_MIN_TRANCHE_AGE,
} from './tax';
import {
  chargeFixedCost,
  growTranches,
  liquidate,
  redeemPprFifo,
} from './tranches';

/** What distinguishes the three scenarios. Everything else is shared. */
interface Policy {
  id: ScenarioId;
  /** Where the annual out-of-pocket contribution goes. */
  primary: 'etf' | 'ppr';
  /** Whether this scenario ever reinvests anything. */
  reinvests: boolean;
}

const POLICIES: Policy[] = [
  { id: 'etf', primary: 'etf', reinvests: false },
  { id: 'hybrid', primary: 'ppr', reinvests: true },
];

function labelFor(id: ScenarioId, cfg: SimConfig): string {
  switch (id) {
    case 'etf':
      return `Só ${cfg.etfName}`;
    case 'hybrid':
      return `Híbrido: ${cfg.pprName} + ${cfg.etfName}`;
  }
}

function balanceOf(tranches: Tranche[], product: 'etf' | 'ppr'): number {
  return tranches
    .filter((t) => t.product === product)
    .reduce((s, t) => s + t.value, 0);
}

/**
 * Share of total entregas made in the first half of the contract's life.
 * DL 158/2002 art. 4.º/3 requires at least 35% for the whole plan to be
 * redeemable. Computed from the actual schedule rather than assumed, so the
 * rule stays correct if contributions ever stop being uniform.
 */
export function firstHalfShare(
  entregas: { year: number; amount: number }[],
  redemptionYear: number,
): number {
  if (entregas.length === 0) return 0;
  const total = entregas.reduce((s, e) => s + e.amount, 0);
  if (total <= 0) return 0;

  // "Vigência do contrato" runs from the first entrega to the moment of
  // reimbursement — NOT to the last contribution. Measuring it to the last
  // entrega understates the contract's length and shifts the midpoint early.
  const firstYear = Math.min(...entregas.map((e) => e.year));
  const midpoint = (firstYear + redemptionYear) / 2;

  const inFirstHalf = entregas
    .filter((e) => e.year <= midpoint)
    .reduce((s, e) => s + e.amount, 0);
  return inFirstHalf / total;
}

/**
 * Value the household received that is NOT already inside the portfolio.
 *
 * The three scenarios are only comparable on total value created, because they
 * deliver it through different channels: the ETF scenario puts everything in
 * the portfolio, while the PPR scenarios divert part of it into paying the
 * mortgage and receiving IRS refunds.
 *
 * Each channel counts exactly once. When a benefit or a redemption is
 * reinvested, its value is already in the portfolio and must NOT be added
 * again — that double counting is the easiest mistake to make here.
 */
function valueInHand(
  policy: Policy,
  cfg: SimConfig,
  benefitTotal: number,
  mortgagePaid: number,
): { benefit: number; mortgage: number; total: number } {
  const benefitReinvested =
    policy.reinvests && cfg.benefitDestination !== 'consumed';
  const redemptionReinvested = policy.reinvests && cfg.reinvestRedemption;

  const benefit = benefitReinvested ? 0 : benefitTotal;
  const mortgage = redemptionReinvested ? 0 : mortgagePaid;
  return { benefit, mortgage, total: benefit + mortgage };
}

/**
 * What actually reaches the investment after the entry charge.
 *
 * A PPR takes a subscription commission off each entrega — the market average
 * is around 3%, and some products reach 6%. An ETF purchase pays dealing
 * commission and FX spread instead, part percentage and part flat, which is
 * why the flat component matters so much for small monthly contributions.
 */
function applyEntryFee(
  amount: number,
  product: 'etf' | 'ppr',
  cfg: SimConfig,
): number {
  if (amount <= 0) return 0;
  const net =
    product === 'ppr'
      ? amount * (1 - cfg.pprSubscriptionFee / 100)
      : amount * (1 - cfg.etfBuyFee / 100) - cfg.etfBuyFeeFixed;
  return Math.max(0, net);
}

function runScenario(policy: Policy, cfg: SimConfig): ScenarioResult {
  // Annual drag stacks: every percentage charged on assets, each year.
  const etfNetRate = cfg.etfReturn - cfg.etfFee - cfg.etfCustodyFee;
  const pprNetRate =
    cfg.pprReturn -
    cfg.pprFee -
    cfg.pprDepositaryFee -
    cfg.pprUnderlyingFee -
    cfg.pprTrackingError;
  const annualInstalments = cfg.monthlyInstalment * 12;

  // Last year the mortgage is still running. Instalments only fall due inside
  // this window, so alínea g) is only available while it lasts.
  const mortgageEndYear = cfg.hasMortgage
    ? cfg.mortgageStartYear + cfg.mortgageYears - 1
    : null;

  /**
   * Whether the PPR can be cashed out at the end under art. 4.º conditions.
   *
   * Alínea g) only works while there are instalments left to pay. Once the
   * mortgage is settled that door closes, and the only remaining condition
   * this simulator can check is age: art. 4.º/1 e) allows redemption from 60.
   *
   * So a mortgage that finishes before the participant turns 60 leaves the
   * balance stranded — redeemable only outside legal conditions, at 21.5% /
   * 17.2% / 8.6% plus the benefit clawback.
   */
  /**
   * Last year a PPR entrega can still reach alínea g). Contributing after this
   * buys a deduction that will be handed back on redemption.
   */
  const pprCutoffYear = lastUsefulPprYear(cfg);

  const ageAtEnd = cfg.currentAge + cfg.years - 1;
  const mortgageStillRunningAtEnd =
    mortgageEndYear !== null && mortgageEndYear >= cfg.years;
  const legalExit =
    ageAtEnd >= PPR_LEGAL_EXIT_AGE || mortgageStillRunningAtEnd;

  /**
   * True when the mortgage ends inside the horizon and the participant is
   * still under 60 then: every euro contributed to the PPR after that point
   * has no cheap way out. This is the warning the UI must surface.
   */
  const ageAtMortgageEnd =
    mortgageEndYear === null ? null : cfg.currentAge + mortgageEndYear - 1;
  const pprAfterMortgageEnds =
    policy.primary === 'ppr' &&
    mortgageEndYear !== null &&
    mortgageEndYear < cfg.years &&
    ageAtMortgageEnd !== null &&
    ageAtMortgageEnd < PPR_LEGAL_EXIT_AGE;

  let tranches: Tranche[] = [];
  const entregas: { year: number; amount: number }[] = [];
  /** Each year's IRS deduction, kept for the clawback calculation. */
  const benefitYears: { year: number; amount: number }[] = [];

  let contributed = 0;
  let mortgagePaid = 0;
  let benefitTotal = 0;
  let taxPaid = 0;
  /** Entregas whose 20% was already above the age cap, so bought no deduction. */
  let contributionsWithoutBenefit = 0;
  /** Every commission paid across the horizon, tax excluded. */
  let feesPaid = 0;
  /** IRS deductions handed back for redeeming entregas younger than 5 years. */
  let redemptionClawback = 0;
  /** Audit trail: every tranche redeemed, in the year it was redeemed. */
  const redemptions: RedemptionEntry[] = [];
  /** Benefit earned last year, paid out this year and added to the PPR. */
  let pendingPprBenefit = 0;

  const rows: YearRow[] = [];

  /**
   * One year of growth plus the flat broker cost. Called either before or
   * after the year's contribution, depending on `contributionTiming`.
   */
  const applyGrowth = () => {
    // the percentage charges are the gap between gross and net growth
    const etfBefore = balanceOf(tranches, 'etf');
    const pprBefore = balanceOf(tranches, 'ppr');
    feesPaid +=
      (etfBefore * (cfg.etfFee + cfg.etfCustodyFee)) / 100 +
      (pprBefore *
        (cfg.pprFee + cfg.pprDepositaryFee + cfg.pprUnderlyingFee)) /
        100;

    tranches = growTranches(tranches, 'etf', etfNetRate);
    tranches = growTranches(tranches, 'ppr', pprNetRate);

    const beforeFlat = balanceOf(tranches, 'etf');
    tranches = chargeFixedCost(tranches, 'etf', cfg.etfAnnualCost);
    feesPaid += beforeFlat - balanceOf(tranches, 'etf');
  };

  for (let year = 1; year <= cfg.years; year++) {
    const age = cfg.currentAge + year - 1;

    // 1. with end-of-year contributions, existing money grows first and this
    //    year's deposit earns nothing until next year
    if (cfg.contributionTiming === 'end') applyGrowth();

    // 2. this year's contribution out of pocket
    //
    // The PPR window closes five years BEFORE the mortgage does, not with it:
    // an entrega must be five years old for EBF art. 21.º/4 to let the
    // deduction survive, so anything paid in later than that can never get out
    // through alínea g). `afterMortgage` decides what happens from then on.
    // 'stop' applies to every scenario, otherwise they stop costing the same.
    const pprWindowClosed = pprCutoffYear !== null && year > pprCutoffYear;
    const stopped = pprWindowClosed && cfg.afterMortgage === 'stop';
    const divertToEtf =
      pprWindowClosed &&
      cfg.afterMortgage === 'etf' &&
      policy.primary === 'ppr';

    const contribution = stopped
      ? 0
      : contributionForYear(
          cfg.contributionMode,
          age,
          cfg.annualInvestment,
          cfg.irsBandsEnabled,
          cfg.irsBenefitCap,
        );
    contributed += contribution;

    const destination: 'etf' | 'ppr' = divertToEtf ? 'etf' : policy.primary;
    const intoPrimary =
      destination === 'ppr' ? contribution + pendingPprBenefit : contribution;
    pendingPprBenefit = 0;

    if (intoPrimary > 0) {
      const invested = applyEntryFee(intoPrimary, destination, cfg);
      feesPaid += intoPrimary - invested;
      if (invested > 0) {
        tranches.push({
          yearDeposited: year,
          principal: invested,
          value: invested,
          product: destination,
        });
      }
      if (destination === 'ppr') {
        // the IRS deduction is on what you paid in, before the gestora's cut
        entregas.push({ year, amount: intoPrimary });
      }
    }

    // 3. the IRS deduction — only earned by money that actually went to the PPR
    let benefitThisYear = 0;
    if (destination === 'ppr' && contribution > 0) {
      const cap = irsCapForAge(age, cfg.irsBandsEnabled, cfg.irsBenefitCap);
      benefitThisYear = irsBenefit(contribution, cap);
      benefitTotal += benefitThisYear;
      // the slice of the entrega whose 20% exceeded the cap earns nothing
      contributionsWithoutBenefit += Math.max(
        0,
        contribution - cap / IRS_DEDUCTION_RATE,
      );
      if (benefitThisYear > 0) {
        benefitYears.push({ year, amount: benefitThisYear });
      }

      if (policy.reinvests && cfg.benefitDestination === 'etf') {
        const invested = applyEntryFee(benefitThisYear, 'etf', cfg);
        feesPaid += benefitThisYear - invested;
        tranches.push({
          yearDeposited: year,
          principal: invested,
          value: invested,
          product: 'etf',
        });
      } else if (policy.reinvests && cfg.benefitDestination === 'ppr') {
        // paid out with next year's IRS refund, so it joins next year's entrega
        pendingPprBenefit = benefitThisYear;
      }
    }

    // 4. with start-of-year contributions, this year's deposit and the IRS
    //    benefit are already in the market and grow immediately
    if (cfg.contributionTiming === 'start') applyGrowth();

    // 5. redeem PPR tranches to pay mortgage instalments
    let redeemedThisYear = 0;
    if (
      policy.primary === 'ppr' &&
      cfg.hasMortgage &&
      year >= cfg.mortgageStartYear &&
      mortgageEndYear !== null &&
      year <= mortgageEndYear &&
      entregas.length > 0
    ) {
      const result = redeemPprFifo(tranches, year, annualInstalments, {
        redeemYoungEntregas: cfg.redeemYoungEntregas,
        firstHalfShare: firstHalfShare(entregas, year),
        // the plan's own first entrega, from the full history. Redeeming does
        // not rejuvenate the contract, so this must not come from what is left.
        firstEntregaYear: entregas[0].year,
        redemptionFeePct: cfg.pprRedemptionFee,
        redemptionFeeYears: cfg.pprRedemptionFeeYears,
      });
      tranches = result.remaining;
      redeemedThisYear = result.grossRedeemed;
      feesPaid += result.fee;
      // only the NET proceeds can settle an instalment; the tax is withheld
      mortgagePaid += result.netProceeds;
      taxPaid += result.tax;

      // EBF art. 21.º/4 is assessed independently of DL 158/2002 art. 4.º.
      // Redeeming in legal conditions is not enough: the deduction survives
      // only if five years have ALSO passed since that particular entrega
      // ("e", not "ou"). Redeeming a young one hands the benefit back,
      // majorado 10% por cada ano decorrido since it was claimed.
      for (const slice of result.slices) {
        let clawback = 0;
        if (slice.ageYears < PPR_MIN_TRANCHE_AGE) {
          const claimed = benefitYears.find(
            (b) => b.year === slice.yearDeposited,
          );
          if (claimed) {
            clawback =
              claimed.amount *
              slice.fraction *
              (1 + CLAWBACK_MAJORATION_PER_YEAR * slice.ageYears);
            redemptionClawback += clawback;
          }
        }

        const earned = benefitYears.find((b) => b.year === slice.yearDeposited);
        redemptions.push({
          year,
          age,
          entregaYear: slice.yearDeposited,
          ageYears: slice.ageYears,
          gross: slice.gross,
          principal: slice.principal,
          profit: slice.profit,
          tax: slice.tax,
          fee: slice.fee,
          net: slice.net,
          benefitEarned: (earned?.amount ?? 0) * slice.fraction,
          clawback,
        });
      }

      if (policy.reinvests && cfg.reinvestRedemption && result.netProceeds > 0) {
        const invested = applyEntryFee(result.netProceeds, 'etf', cfg);
        feesPaid += result.netProceeds - invested;
        tranches.push({
          yearDeposited: year,
          principal: invested,
          value: invested,
          product: 'etf',
        });
      }
    }

    // 6. record the year
    const snapshot = liquidate(tranches, year, {
      etfTaxMode: cfg.etfTaxMode,
      marginalRate: cfg.marginalRate,
      etfSellFeePct: cfg.etfSellFee,
    });

    rows.push({
      year,
      age,
      etfBalance: balanceOf(tranches, 'etf'),
      pprBalance: balanceOf(tranches, 'ppr'),
      contributedThisYear: contribution,
      contributed,
      redeemedThisYear,
      mortgagePaid,
      irsBenefitThisYear: benefitThisYear,
      irsBenefit: benefitTotal,
      taxPaidToDate: taxPaid,
      netIfLiquidatedNow: snapshot.net,
      netWithBenefits:
        snapshot.net +
        valueInHand(policy, cfg, benefitTotal, mortgagePaid).total,
    });
  }

  const holdsPpr = tranches.some((t) => t.product === 'ppr');
  const penalisedExit = !legalExit && holdsPpr;

  const final = liquidate(tranches, cfg.years, {
    etfTaxMode: cfg.etfTaxMode,
    marginalRate: cfg.marginalRate,
    pprRegime: penalisedExit ? 'penalised' : 'legal',
    etfSellFeePct: cfg.etfSellFee,
  });
  feesPaid += final.fee;

  // EBF art. 21.º: redeeming outside legal conditions voids the deduction.
  // Every euro deducted goes back, majorado em 10% por cada ano decorrido.
  const exitClawback = penalisedExit
    ? benefitYears.reduce(
        (sum, b) =>
          sum + b.amount * (1 + CLAWBACK_MAJORATION_PER_YEAR * (cfg.years - b.year)),
        0,
      )
    : 0;
  const benefitClawback = exitClawback + redemptionClawback;

  // Mortgage instalments falling due inside the horizon. Identical for every
  // scenario, which is what makes the comparison fair: the household owes the
  // same mortgage whichever way it invests.
  // instalments falling due inside BOTH the mortgage window and the horizon
  const mortgageYearsInHorizon =
    mortgageEndYear === null
      ? 0
      : Math.max(
          0,
          Math.min(cfg.years, mortgageEndYear) - cfg.mortgageStartYear + 1,
        );
  const mortgageDueTotal = annualInstalments * mortgageYearsInHorizon;
  const mortgagePaidFromSalary = Math.max(0, mortgageDueTotal - mortgagePaid);

  // What actually leaves the household's pocket: the contributions, the
  // instalments the PPR did not cover, and — when the freed salary is
  // reinvested — that freed salary too. When it is reinvested this comes to
  // exactly `contributed + mortgageDueTotal` for every scenario.
  const reinvestedFreedSalary =
    policy.reinvests && cfg.reinvestRedemption ? mortgagePaid : 0;
  const totalOutOfPocket =
    contributed + mortgagePaidFromSalary + reinvestedFreedSalary;

  const inHand = valueInHand(policy, cfg, benefitTotal, mortgagePaid);
  const totalTax = final.etfTax + final.pprTax + taxPaid + benefitClawback;
  const totalGain = final.gross + mortgagePaid - contributed;

  return {
    id: policy.id,
    label: labelFor(policy.id, cfg),
    rows,
    redemptions,
    final: {
      grossValue: final.gross,
      etfTax: final.etfTax,
      pprTax: final.pprTax,
      pprTaxDuringRedemptions: taxPaid,
      irsBenefitTotal: benefitTotal,
      contributionsWithoutBenefit,
      mortgagePaidTotal: mortgagePaid,
      mortgageDueTotal,
      mortgagePaidFromSalary,
      freedSalaryReinvested: reinvestedFreedSalary,
      totalOutOfPocket,
      penalisedExit,
      mortgageEndYear,
      pprAfterMortgageEnds,
      benefitClawback,
      benefitInHand: inHand.benefit,
      mortgageInHand: inHand.mortgage,
      netValue: final.net - benefitClawback,
      netWithBenefits: final.net - benefitClawback + inHand.total,
      totalContributed: contributed,
      feesPaid,
      effectiveTaxRate: totalGain > 0 ? Math.min(1, totalTax / totalGain) : 0,
      bracketBreakdown: final.bracketBreakdown,
    },
  };
}

/**
 * Run all three scenarios. Pure: no I/O, no dates, no randomness. The same
 * config always produces the same output, which is what makes the URL a
 * complete description of a result.
 */
export function simulate(cfg: SimConfig): SimOutput {
  const scenarios = POLICIES.map((p) => runScenario(p, cfg));

  const etf = scenarios.find((s) => s.id === 'etf')!;
  const hybrid = scenarios.find((s) => s.id === 'hybrid')!;

  return {
    scenarios,
    breakEvenYear: findBreakEven(hybrid, etf),
    lastUsefulPprYear: lastUsefulPprYear(cfg),
  };
}

/**
 * Last year in which a PPR entrega can still be redeemed through alínea g),
 * and therefore the last year it is worth making one.
 *
 * The answer depends on which eligibility regime applies, and the two differ
 * by five whole years:
 *
 *  - art. 4.º/3 (the 35% test passes, which regular contributions satisfy):
 *    the whole plan is redeemable once it is five years old, so an entrega
 *    made in the mortgage's final year can be redeemed that same year.
 *  - art. 4.º/2 alone: each entrega must itself be five years old, so the last
 *    useful one is five years before the mortgage ends.
 */
function lastUsefulPprYear(cfg: SimConfig): number | null {
  if (!cfg.hasMortgage) return null;
  const mortgageEnd = cfg.mortgageStartYear + cfg.mortgageYears - 1;
  const last = cfg.redeemYoungEntregas
    ? mortgageEnd
    : mortgageEnd - PPR_MIN_TRANCHE_AGE;
  return last >= 1 ? last : null;
}

/**
 * The year from which the hybrid is ahead and never falls behind again.
 *
 * Returns null when there is no crossover to report — either because the
 * hybrid was already ahead in year 1 (it banks the IRS deduction immediately,
 * so it usually is) or because it never gets ahead. Calling year 1 a
 * "break-even" would be meaningless, which is the whole point of this
 * function existing rather than a plain first-match loop.
 *
 * Compared on total value created, the only basis on which scenarios that
 * deliver value through different channels are comparable.
 */
function findBreakEven(
  hybrid: ScenarioResult,
  etf: ScenarioResult,
): number | null {
  const ahead = hybrid.rows.map(
    (r, i) => r.netWithBenefits >= etf.rows[i].netWithBenefits,
  );

  if (ahead.length === 0 || ahead[0] || !ahead[ahead.length - 1]) return null;

  for (let i = 0; i < ahead.length; i++) {
    if (ahead.slice(i).every(Boolean)) return hybrid.rows[i].year;
  }
  return null;
}
