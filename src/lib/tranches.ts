import type { BracketSlice, EtfTaxMode, Product, Tranche } from './types';
import {
  etfBracketLabel,
  etfRateForAge,
  penalisedPprRateForAge,
  pprTaxOnProfit,
  PPR_FIRST_HALF_THRESHOLD,
  PPR_LEGAL_EFFECTIVE_RATE,
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
  /**
   * Allow redeeming entregas younger than five years under art. 4.º/3.
   *
   * Legally possible when the 35% test passes, but EBF art. 21.º/4 then claws
   * back that entrega's IRS deduction, so the caller must account for it.
   */
  redeemYoungEntregas: boolean;
  /**
   * Share of total entregas made in the first half of the contract's life.
   * Only consulted when use35Rule is true. Defaults to 0.5, the value a
   * constant annual contribution always produces.
   */
  firstHalfShare?: number;
  /**
   * Year of the FIRST entrega ever made into the plan.
   *
   * Must be supplied by the caller from the full contribution history, NOT
   * derived from the surviving tranches: art. 4.º/3 counts five years from
   * "a data da primeira entrega", and redeeming does not rejuvenate the
   * contract. Deriving it from what is left restarts the clock every time the
   * plan is drained, which produces a spurious five-year on/off cycle.
   */
  firstEntregaYear: number;
}

/** One tranche consumed by a redemption, for the caller's clawback maths. */
export interface RedeemedSlice {
  yearDeposited: number;
  /** Whole years between the entrega and this redemption. */
  ageYears: number;
  /** Share of that tranche's remaining value taken, 0..1. */
  fraction: number;
}

export interface RedeemResult {
  remaining: Tranche[];
  grossRedeemed: number;
  tax: number;
  netProceeds: number;
  slices: RedeemedSlice[];
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
 * `netTarget` is the instalment value still to be paid this year — normally 12
 * monthly instalments. It is a NET target: tax is withheld on redemption, so
 * only the net proceeds can actually settle an instalment. Redeeming €12 000
 * gross does not pay €12 000 of mortgage.
 *
 * Alínea g) only permits paying instalments as they fall due, never early
 * amortisation of capital, so there is nothing else to redeem against.
 */
export function redeemPprFifo(
  tranches: Tranche[],
  currentYear: number,
  netTarget: number,
  opts: RedeemOptions,
): RedeemResult {
  if (netTarget <= 0) {
    return {
      remaining: tranches,
      grossRedeemed: 0,
      tax: 0,
      netProceeds: 0,
      slices: [],
    };
  }

  const firstHalfShare = opts.firstHalfShare ?? 0.5;

  const wholePlanEligible =
    opts.redeemYoungEntregas &&
    firstHalfShare >= PPR_FIRST_HALF_THRESHOLD &&
    currentYear - opts.firstEntregaYear >= PPR_MIN_TRANCHE_AGE;

  const isEligible = (t: Tranche) =>
    t.product === 'ppr' &&
    (wholePlanEligible || currentYear - t.yearDeposited >= PPR_MIN_TRANCHE_AGE);

  let netStillNeeded = netTarget;
  let grossRedeemed = 0;
  let tax = 0;
  const remaining: Tranche[] = [];
  const slices: RedeemedSlice[] = [];

  // tranches are held oldest-first, so a straight walk is FIFO
  for (const t of tranches) {
    if (netStillNeeded <= 0 || !isEligible(t) || t.value <= 0) {
      remaining.push(t);
      continue;
    }

    // Tax is 8% of the PROFIT portion only, so each euro redeemed from this
    // tranche yields `netPerGross` euros of spendable cash. Invert that to
    // find the gross needed to cover what is still owed on the instalments.
    const profitShare = Math.max(0, (t.value - t.principal) / t.value);
    const netPerGross = 1 - PPR_LEGAL_EFFECTIVE_RATE * profitShare;
    const grossNeeded =
      netPerGross > 0 ? netStillNeeded / netPerGross : Number.POSITIVE_INFINITY;

    const take = Math.min(t.value, grossNeeded);
    const principalTaken = t.principal * (take / t.value);
    const takeTax = pprTaxOnProfit(take - principalTaken);

    grossRedeemed += take;
    tax += takeTax;
    netStillNeeded -= take - takeTax;
    slices.push({
      yearDeposited: t.yearDeposited,
      ageYears: currentYear - t.yearDeposited,
      fraction: take / t.value,
    });

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
    slices,
  };
}

export interface LiquidateOptions {
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
  /**
   * How the PPR is cashed out at the end of the horizon.
   *
   * 'legal' — a situation art. 4.º DL 158/2002 allows (mortgage instalments,
   * retirement, age 60+): 8% of the profit, any holding period.
   *
   * 'penalised' — redemption outside those situations: 21.5% on the art. 5.º/3
   * taxable share, which falls with holding period (21.5% / 17.2% / 8.6%).
   * The caller must separately apply the IRS benefit clawback, which this
   * function cannot see.
   */
  pprRegime?: 'legal' | 'penalised';
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
      pprTax +=
        opts.pprRegime === 'penalised'
          ? profit * penalisedPprRateForAge(finalYear - t.yearDeposited)
          : pprTaxOnProfit(profit);
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
