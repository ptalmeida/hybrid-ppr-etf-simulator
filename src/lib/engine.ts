import type {
  ScenarioId,
  ScenarioResult,
  SimConfig,
  SimOutput,
  Tranche,
  YearRow,
} from './types';
import { contributionForYear, irsBenefit, irsCapForAge } from './tax';
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
  { id: 'ppr', primary: 'ppr', reinvests: false },
];

function labelFor(id: ScenarioId, cfg: SimConfig): string {
  switch (id) {
    case 'etf':
      return `Só ${cfg.etfName}`;
    case 'hybrid':
      return `Híbrido: ${cfg.pprName} + ${cfg.etfName}`;
    case 'ppr':
      return `Só ${cfg.pprName}`;
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
function firstHalfShare(entregas: { year: number; amount: number }[]): number {
  if (entregas.length === 0) return 0;
  const total = entregas.reduce((s, e) => s + e.amount, 0);
  if (total <= 0) return 0;
  const lastYear = Math.max(...entregas.map((e) => e.year));
  const midpoint = lastYear / 2;
  const inFirstHalf = entregas
    .filter((e) => e.year <= midpoint)
    .reduce((s, e) => s + e.amount, 0);
  return inFirstHalf / total;
}

function runScenario(policy: Policy, cfg: SimConfig): ScenarioResult {
  const etfNetRate = cfg.etfReturn - cfg.etfFee;
  const pprNetRate = cfg.pprReturn - cfg.pprFee - cfg.pprTrackingError;
  const annualCap = cfg.monthlyInstalment * 12;

  let tranches: Tranche[] = [];
  const entregas: { year: number; amount: number }[] = [];

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
    if (policy.primary === 'ppr' && year >= cfg.mortgageStartYear) {
      const result = redeemPprFifo(tranches, year, annualCap, {
        use35Rule: cfg.use35Rule,
        firstHalfShare: firstHalfShare(entregas),
      });
      tranches = result.remaining;
      redeemedThisYear = result.grossRedeemed;
      mortgagePaid += result.grossRedeemed;
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

    const benefitsStillInHand =
      cfg.benefitDestination === 'consumed' || !policy.reinvests
        ? benefitTotal
        : 0;

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
      netWithBenefits: snapshot.net + mortgagePaid + benefitsStillInHand,
    });
  }

  const final = liquidate(tranches, cfg.years, {
    etfTaxMode: cfg.etfTaxMode,
    marginalRate: cfg.marginalRate,
  });

  const totalTax = final.etfTax + final.pprTax + taxPaid;
  const totalGain = final.gross + mortgagePaid - contributed;

  const benefitsNotAlreadyInvested =
    cfg.benefitDestination === 'consumed' || !policy.reinvests
      ? benefitTotal
      : 0;

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
      netValue: final.net,
      netWithBenefits: final.net + mortgagePaid + benefitsNotAlreadyInvested,
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

  let breakEvenYear: number | null = null;
  for (let i = 0; i < hybrid.rows.length; i++) {
    if (hybrid.rows[i].netIfLiquidatedNow >= etf.rows[i].netIfLiquidatedNow) {
      breakEvenYear = hybrid.rows[i].year;
      break;
    }
  }
  // a hybrid that leads early but is overtaken later never really broke even
  if (breakEvenYear !== null && hybrid.final.netValue < etf.final.netValue) {
    breakEvenYear = null;
  }

  return { scenarios, breakEvenYear };
}
