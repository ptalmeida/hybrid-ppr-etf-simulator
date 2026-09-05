import type { Product, SimConfig } from './types';

/**
 * When a charge is levied.
 *
 * Portuguese PPR pricing does not fit a handful of fixed percentages. Products
 * tier the management fee by balance, charge redemption only on young units,
 * run promotional rates for a year, add flat account fees, and take a share of
 * performance above a hurdle. Rather than grow a scalar field per variant, the
 * engine applies a list of rules and each product describes itself.
 */
export type FeeBasis =
  | 'contribution' // on each amount paid in
  | 'annual' // on the balance, once a year
  | 'redemption' // on each amount taken out along the way
  | 'exit' // on the final liquidation
  | 'performance'; // on gains above a hurdle, once a year

export interface FeeRule {
  /** Shown to the reader, so it must say what it is in plain Portuguese. */
  label: string;
  product: Product;
  basis: FeeBasis;
  /** Percentage component, applied to the basis amount. */
  pct?: number;
  /** Flat euro component. */
  fixed?: number;

  // --- conditions. All that are present must hold. ------------------------
  /** Applies only once the relevant age reaches this, in whole years. */
  minAgeYears?: number;
  /** Applies only while the relevant age is below this. */
  maxAgeYears?: number;
  /** Applies only when the product's balance is at least this. */
  minBalance?: number;
  /** Applies only when the product's balance is below this. */
  maxBalance?: number;
  /** Applies only from this simulation year onward. */
  fromYear?: number;
  /** Applies only up to and including this simulation year. */
  toYear?: number;
  /** performance only: charge applies to the gain above this % of balance. */
  hurdlePct?: number;
}

export interface FeeContext {
  product: Product;
  year: number;
  /** The product's balance when the charge is assessed. */
  balance: number;
  /** The amount the percentage applies to. */
  amount: number;
  /** Age of the tranche or plan, where the rule cares. */
  ageYears?: number;
  /** performance only: the year's gain in euros, before this charge. */
  gain?: number;
}

function applies(rule: FeeRule, ctx: FeeContext): boolean {
  if (rule.product !== ctx.product) return false;
  if (rule.fromYear !== undefined && ctx.year < rule.fromYear) return false;
  if (rule.toYear !== undefined && ctx.year > rule.toYear) return false;
  if (rule.minBalance !== undefined && ctx.balance < rule.minBalance)
    return false;
  if (rule.maxBalance !== undefined && ctx.balance >= rule.maxBalance)
    return false;

  if (rule.minAgeYears !== undefined || rule.maxAgeYears !== undefined) {
    // a rule that talks about age cannot apply to an event that has none
    if (ctx.ageYears === undefined) return false;
    if (rule.minAgeYears !== undefined && ctx.ageYears < rule.minAgeYears)
      return false;
    if (rule.maxAgeYears !== undefined && ctx.ageYears >= rule.maxAgeYears)
      return false;
  }
  return true;
}

/** Total euro charge for one event, from every rule that applies to it. */
export function chargeFor(
  rules: FeeRule[],
  basis: FeeBasis,
  ctx: FeeContext,
): number {
  let total = 0;
  for (const rule of rules) {
    if (rule.basis !== basis || !applies(rule, ctx)) continue;

    if (basis === 'performance') {
      const hurdle = ((rule.hurdlePct ?? 0) / 100) * ctx.balance;
      const above = Math.max(0, (ctx.gain ?? 0) - hurdle);
      total += (above * (rule.pct ?? 0)) / 100 + (rule.fixed ?? 0);
      continue;
    }

    total += (ctx.amount * (rule.pct ?? 0)) / 100 + (rule.fixed ?? 0);
  }
  return Math.max(0, total);
}

/**
 * The annual charge expressed as a percentage of the balance.
 *
 * Kept separate from `chargeFor` because the engine applies it as a drag on
 * the growth rate rather than as a lump deduction, which is how a management
 * fee accrued daily actually behaves.
 */
export function annualRatePct(rules: FeeRule[], ctx: FeeContext): number {
  let pct = 0;
  for (const rule of rules) {
    if (rule.basis !== 'annual' || !applies(rule, ctx)) continue;
    pct += rule.pct ?? 0;
  }
  return pct;
}

/** The flat euro part of the annual charges. */
export function annualFixed(rules: FeeRule[], ctx: FeeContext): number {
  let fixed = 0;
  for (const rule of rules) {
    if (rule.basis !== 'annual' || !applies(rule, ctx)) continue;
    fixed += rule.fixed ?? 0;
  }
  return fixed;
}

/**
 * Turn the simple percentage fields into rules.
 *
 * These cover the ordinary case and keep the URL short and readable. Anything
 * irregular — a fee that tiers by balance, steps down with holding period, or
 * only runs for the first year — goes in `extraFees` instead, and both end up
 * in the same list so the engine has one code path.
 */
export function scalarFeeRules(cfg: SimConfig): FeeRule[] {
  const rules: FeeRule[] = [];
  const add = (r: FeeRule) => {
    if ((r.pct ?? 0) > 0 || (r.fixed ?? 0) > 0) rules.push(r);
  };

  add({
    label: 'Comissão de subscrição',
    product: 'ppr',
    basis: 'contribution',
    pct: cfg.pprSubscriptionFee,
  });
  add({
    label: 'Comissão de gestão',
    product: 'ppr',
    basis: 'annual',
    pct: cfg.pprFee,
  });
  add({
    label: 'Comissão de depósito',
    product: 'ppr',
    basis: 'annual',
    pct: cfg.pprDepositaryFee,
  });
  add({
    label: 'Custos dos fundos subjacentes',
    product: 'ppr',
    basis: 'annual',
    pct: cfg.pprUnderlyingFee,
  });
  add({
    label: 'Desvio face ao índice',
    product: 'ppr',
    basis: 'annual',
    pct: cfg.pprTrackingError,
  });
  add({
    label: 'Comissão de reembolso',
    product: 'ppr',
    basis: 'redemption',
    pct: cfg.pprRedemptionFee,
    maxAgeYears: cfg.pprRedemptionFeeYears,
  });

  add({ label: 'TER', product: 'etf', basis: 'annual', pct: cfg.etfFee });
  add({
    label: 'Custódia',
    product: 'etf',
    basis: 'annual',
    pct: cfg.etfCustodyFee,
  });
  add({
    label: 'Custos anuais fixos',
    product: 'etf',
    basis: 'annual',
    fixed: cfg.etfAnnualCost,
  });
  add({
    label: 'Comissão de compra',
    product: 'etf',
    basis: 'contribution',
    pct: cfg.etfBuyFee,
    fixed: cfg.etfBuyFeeFixed,
  });
  add({
    label: 'Comissão de venda',
    product: 'etf',
    basis: 'exit',
    pct: cfg.etfSellFee,
  });

  return rules;
}

/** Every rule in force: the simple fields plus anything irregular. */
export function feeSchedule(cfg: SimConfig): FeeRule[] {
  return [...scalarFeeRules(cfg), ...(cfg.extraFees ?? [])];
}
