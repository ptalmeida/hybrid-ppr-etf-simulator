import type {
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
  PPR_LEGAL_EXIT_AGE,
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
): number {
  const benefitReinvested =
    policy.reinvests && cfg.benefitDestination !== 'consumed';
  const redemptionReinvested = policy.reinvests && cfg.reinvestRedemption;

  return (
    (benefitReinvested ? 0 : benefitTotal) +
    (redemptionReinvested ? 0 : mortgagePaid)
  );
}

function runScenario(policy: Policy, cfg: SimConfig): ScenarioResult {
  const etfNetRate = cfg.etfReturn - cfg.etfFee;
  const pprNetRate = cfg.pprReturn - cfg.pprFee - cfg.pprTrackingError;
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
  /** Benefit earned last year, paid out this year and added to the PPR. */
  let pendingPprBenefit = 0;

  const rows: YearRow[] = [];

  /**
   * One year of growth plus the flat broker cost. Called either before or
   * after the year's contribution, depending on `contributionTiming`.
   */
  const applyGrowth = () => {
    tranches = growTranches(tranches, 'etf', etfNetRate);
    tranches = growTranches(tranches, 'ppr', pprNetRate);
    tranches = chargeFixedCost(tranches, 'etf', cfg.etfAnnualCost);
  };

  for (let year = 1; year <= cfg.years; year++) {
    const age = cfg.currentAge + year - 1;

    // 1. with end-of-year contributions, existing money grows first and this
    //    year's deposit earns nothing until next year
    if (cfg.contributionTiming === 'end') applyGrowth();

    // 2. this year's contribution out of pocket
    const contribution = contributionForYear(
      cfg.contributionMode,
      age,
      cfg.annualInvestment,
      cfg.irsBandsEnabled,
      cfg.irsBenefitCap,
    );
    contributed += contribution;

    const intoPrimary =
      policy.primary === 'ppr' ? contribution + pendingPprBenefit : contribution;
    pendingPprBenefit = 0;

    if (intoPrimary > 0) {
      tranches.push({
        yearDeposited: year,
        principal: intoPrimary,
        value: intoPrimary,
        product: policy.primary,
      });
      if (policy.primary === 'ppr') {
        entregas.push({ year, amount: intoPrimary });
      }
    }

    // 3. the IRS deduction, and where it goes
    let benefitThisYear = 0;
    if (policy.primary === 'ppr' && contribution > 0) {
      const cap = irsCapForAge(age, cfg.irsBandsEnabled, cfg.irsBenefitCap);
      benefitThisYear = irsBenefit(contribution, cap);
      benefitTotal += benefitThisYear;
      if (benefitThisYear > 0) {
        benefitYears.push({ year, amount: benefitThisYear });
      }

      if (policy.reinvests && cfg.benefitDestination === 'etf') {
        tranches.push({
          yearDeposited: year,
          principal: benefitThisYear,
          value: benefitThisYear,
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
        use35Rule: cfg.use35Rule,
        firstHalfShare: firstHalfShare(entregas, year),
        // the plan's own first entrega, from the full history. Redeeming does
        // not rejuvenate the contract, so this must not come from what is left.
        firstEntregaYear: entregas[0].year,
      });
      tranches = result.remaining;
      redeemedThisYear = result.grossRedeemed;
      // only the NET proceeds can settle an instalment; the tax is withheld
      mortgagePaid += result.netProceeds;
      taxPaid += result.tax;

      if (policy.reinvests && cfg.reinvestRedemption && result.netProceeds > 0) {
        tranches.push({
          yearDeposited: year,
          principal: result.netProceeds,
          value: result.netProceeds,
          product: 'etf',
        });
      }
    }

    // 6. record the year
    const snapshot = liquidate(tranches, year, {
      etfTaxMode: cfg.etfTaxMode,
      marginalRate: cfg.marginalRate,
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
        snapshot.net + valueInHand(policy, cfg, benefitTotal, mortgagePaid),
    });
  }

  const holdsPpr = tranches.some((t) => t.product === 'ppr');
  const penalisedExit = !legalExit && holdsPpr;

  const final = liquidate(tranches, cfg.years, {
    etfTaxMode: cfg.etfTaxMode,
    marginalRate: cfg.marginalRate,
    pprRegime: penalisedExit ? 'penalised' : 'legal',
  });

  // EBF art. 21.º: redeeming outside legal conditions voids the deduction.
  // Every euro deducted goes back, majorado em 10% por cada ano decorrido.
  const benefitClawback = penalisedExit
    ? benefitYears.reduce(
        (sum, b) => sum + b.amount * (1 + CLAWBACK_MAJORATION_PER_YEAR * (cfg.years - b.year)),
        0,
      )
    : 0;

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

  const totalTax = final.etfTax + final.pprTax + taxPaid + benefitClawback;
  const totalGain = final.gross + mortgagePaid - contributed;

  return {
    id: policy.id,
    label: labelFor(policy.id, cfg),
    rows,
    final: {
      grossValue: final.gross,
      etfTax: final.etfTax,
      pprTax: final.pprTax,
      pprTaxDuringRedemptions: taxPaid,
      irsBenefitTotal: benefitTotal,
      mortgagePaidTotal: mortgagePaid,
      mortgageDueTotal,
      mortgagePaidFromSalary,
      freedSalaryReinvested: reinvestedFreedSalary,
      totalOutOfPocket,
      penalisedExit,
      mortgageEndYear,
      pprAfterMortgageEnds,
      benefitClawback,
      netValue: final.net - benefitClawback,
      netWithBenefits:
        final.net -
        benefitClawback +
        valueInHand(policy, cfg, benefitTotal, mortgagePaid),
      totalContributed: contributed,
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

  return { scenarios, breakEvenYear: findBreakEven(hybrid, etf) };
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
