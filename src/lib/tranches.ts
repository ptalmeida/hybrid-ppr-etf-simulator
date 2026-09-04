import type { BracketSlice, EtfTaxMode, Product, Tranche } from './types';
import {
  etfBracketLabel,
  etfRateForAge,
  pprTaxOnProfit,
  PPR_FIRST_HALF_THRESHOLD,
  PPR_MIN_TRANCHE_AGE,
} from './tax';

/** Apply one year of growth at `netRatePct` to every tranche of `product`. */
export function growTranches(
  tranches: Tranche[],
  product: Product,
  netRatePct: number,
): Tranche[] {
  const factor = 1 + netRatePct / 100;
  return tranches.map((t) =>
    t.product === product ? { ...t, value: t.value * factor } : t,
  );
}

/** Subtract a flat euro cost, spread pro-rata across that product's balance. */
export function chargeFixedCost(
  tranches: Tranche[],
  product: Product,
  cost: number,
): Tranche[] {
  if (cost <= 0) return tranches;
  const balance = tranches
    .filter((t) => t.product === product)
    .reduce((s, t) => s + t.value, 0);
  if (balance <= 0) return tranches;
  const charged = Math.min(cost, balance);
  return tranches.map((t) =>
    t.product === product
      ? { ...t, value: t.value - charged * (t.value / balance) }
      : t,
  );
}

export interface RedeemOptions {
  use35Rule: boolean;
  /**
   * Share of total entregas made in the first half of the contract's life.
   * Only consulted when use35Rule is true. Defaults to 0.5, the value a
   * constant annual contribution always produces.
   */
  firstHalfShare?: number;
}

export interface RedeemResult {
  remaining: Tranche[];
  grossRedeemed: number;
  tax: number;
  netProceeds: number;
}

/**
 * Redeem PPR tranches to pay mortgage instalments, oldest first.
 *
 * Eligibility (DL 158/2002 art. 4.º):
 *  - n.º 2: a tranche may be redeemed once five years have elapsed since that
 *    entrega.
 *  - n.º 3: once five years have elapsed since the FIRST entrega, the entire
 *    plan may be redeemed, provided entregas in the first half of the
 *    contract's life are at least 35% of the total.
 *
 * `cap` is the most that may be redeemed this year — 12 monthly instalments.
 * Alínea g) only permits paying instalments as they fall due, never early
 * amortisation of capital, so there is nothing else to redeem against.
 */
export function redeemPprFifo(
  tranches: Tranche[],
  currentYear: number,
  cap: number,
  opts: RedeemOptions,
): RedeemResult {
  if (cap <= 0) {
    return { remaining: tranches, grossRedeemed: 0, tax: 0, netProceeds: 0 };
  }

  const pprTranches = tranches.filter((t) => t.product === 'ppr');
  const firstEntregaYear = pprTranches.length
    ? Math.min(...pprTranches.map((t) => t.yearDeposited))
    : Infinity;
  const firstHalfShare = opts.firstHalfShare ?? 0.5;

  const wholePlanEligible =
    opts.use35Rule &&
    firstHalfShare >= PPR_FIRST_HALF_THRESHOLD &&
    currentYear - firstEntregaYear >= PPR_MIN_TRANCHE_AGE;

  const isEligible = (t: Tranche) =>
    t.product === 'ppr' &&
    (wholePlanEligible || currentYear - t.yearDeposited >= PPR_MIN_TRANCHE_AGE);

  let budget = cap;
  let grossRedeemed = 0;
  let tax = 0;
  const remaining: Tranche[] = [];

  // tranches are held oldest-first, so a straight walk is FIFO
  for (const t of tranches) {
    if (budget <= 0 || !isEligible(t) || t.value <= 0) {
      remaining.push(t);
      continue;
    }

    const take = Math.min(t.value, budget);
    const share = take / t.value;
    const principalTaken = t.principal * share;
    const profitTaken = take - principalTaken;

    grossRedeemed += take;
    tax += pprTaxOnProfit(profitTaken);
    budget -= take;

    if (take < t.value) {
      remaining.push({
        ...t,
        value: t.value - take,
        principal: t.principal - principalTaken,
      });
    }
  }

  return {
    remaining,
    grossRedeemed,
    tax,
    netProceeds: grossRedeemed - tax,
  };
}

export interface LiquidateOptions {
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
}

export interface LiquidateResult {
  gross: number;
  etfTax: number;
  pprTax: number;
  net: number;
  bracketBreakdown: BracketSlice[];
}

/** Sell everything at the end of the horizon, taxing each tranche by its age. */
export function liquidate(
  tranches: Tranche[],
  finalYear: number,
  opts: LiquidateOptions,
): LiquidateResult {
  let gross = 0;
  let etfTax = 0;
  let pprTax = 0;
  const buckets = new Map<string, BracketSlice>();

  for (const t of tranches) {
    gross += t.value;
    const profit = Math.max(0, t.value - t.principal);

    if (t.product === 'ppr') {
      pprTax += pprTaxOnProfit(profit);
      continue;
    }

    const age = finalYear - t.yearDeposited;
    const rate = etfRateForAge(age, opts.etfTaxMode, opts.marginalRate);
    const tax = profit * rate;
    etfTax += tax;

    const label = etfBracketLabel(age);
    const slice = buckets.get(label) ?? {
      bracket: label,
      ratePct: rate * 100,
      gain: 0,
      tax: 0,
    };
    slice.gain += profit;
    slice.tax += tax;
    buckets.set(label, slice);
  }

  return {
    gross,
    etfTax,
    pprTax,
    net: gross - etfTax - pprTax,
    bracketBreakdown: [...buckets.values()],
  };
}
