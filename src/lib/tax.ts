import type { ContributionMode, EtfTaxMode } from './types';

/**
 * Every rate and threshold in Portuguese law that this simulator depends on.
 * A law change should be editable here alone.
 *
 * Sources:
 *  - CIRS art. 43.º/5 + Lei n.º 31/2024 — ETF holding-period exclusions
 *  - CIRS art. 72.º — 28% autonomous rate on mais-valias
 *  - EBF art. 21.º — PPR deduction bands, 2/5 at 20%, clawback majoração
 *  - CIRS art. 5.º/3 — coefficients for redemption outside legal conditions
 */

export const ETF_AUTONOMOUS_RATE = 0.28;

/** Share of the gain EXCLUDED from tax, by whole years held. Lei 31/2024. */
export const ETF_EXCLUSION_BANDS: { minAge: number; excluded: number }[] = [
  { minAge: 8, excluded: 0.3 },
  { minAge: 5, excluded: 0.2 },
  { minAge: 2, excluded: 0.1 },
  { minAge: 0, excluded: 0 },
];

/** EBF art. 21.º/3: 2/5 of the income, taxed autonomously at 20%. */
export const PPR_TAXABLE_FRACTION = 2 / 5;
export const PPR_AUTONOMOUS_RATE = 0.2;
export const PPR_LEGAL_EFFECTIVE_RATE =
  PPR_TAXABLE_FRACTION * PPR_AUTONOMOUS_RATE; // 0.08

/** Redemption OUTSIDE legal conditions: 21.5% on the art. 5.º/3 taxable share. */
export const PPR_PENALISED_RATE = 0.215;
export const PPR_PENALISED_BANDS: { minAge: number; taxable: number }[] = [
  { minAge: 8, taxable: 0.4 },
  { minAge: 5, taxable: 0.8 },
  { minAge: 0, taxable: 1 },
];

/** EBF art. 21.º: 20% of contributions, capped by age band. */
export const IRS_DEDUCTION_RATE = 0.2;
export const IRS_CAP_BANDS: { maxAge: number; cap: number }[] = [
  { maxAge: 34, cap: 400 },
  { maxAge: 50, cap: 350 },
  { maxAge: Infinity, cap: 300 },
];

/** EBF art. 21.º: benefits repaid majorados em 10% por cada ano ou fracção. */
export const CLAWBACK_MAJORATION_PER_YEAR = 0.1;

/** Minimum age of an entrega before it may be redeemed. DL 158/2002 art. 4.º/2. */
export const PPR_MIN_TRANCHE_AGE = 5;

/** DL 158/2002 art. 4.º/1 e): redemption allowed from this age. */
export const PPR_LEGAL_EXIT_AGE = 60;

/** DL 158/2002 art. 4.º/3: first-half share needed to redeem the whole plan. */
export const PPR_FIRST_HALF_THRESHOLD = 0.35;

export function etfExcludedShare(ageYears: number): number {
  return ETF_EXCLUSION_BANDS.find((b) => ageYears >= b.minAge)!.excluded;
}

/** Effective tax rate on an ETF gain, given the tranche's age in whole years. */
export function etfRateForAge(
  ageYears: number,
  mode: EtfTaxMode,
  marginalRatePct: number,
): number {
  if (mode === 'flat28') return ETF_AUTONOMOUS_RATE;
  const base =
    mode === 'englobamento' ? marginalRatePct / 100 : ETF_AUTONOMOUS_RATE;
  return base * (1 - etfExcludedShare(ageYears));
}

/** Human label for the bracket a tranche of this age falls into. */
export function etfBracketLabel(ageYears: number): string {
  if (ageYears >= 8) return '8 anos ou mais';
  if (ageYears >= 5) return '5 a 8 anos';
  if (ageYears >= 2) return '2 a 5 anos';
  return 'menos de 2 anos';
}

/** PPR redemption in legal conditions: 8% of the profit, any holding period. */
export function pprTaxOnProfit(profit: number): number {
  if (profit <= 0) return 0;
  return profit * PPR_LEGAL_EFFECTIVE_RATE;
}

/** Effective rate if the PPR were redeemed OUTSIDE legal conditions. */
export function penalisedPprRateForAge(ageYears: number): number {
  const band = PPR_PENALISED_BANDS.find((b) => ageYears >= b.minAge)!;
  return PPR_PENALISED_RATE * band.taxable;
}

/** Annual IRS deduction cap for a participant of this age. */
export function irsCapForAge(
  age: number,
  bandsEnabled: boolean,
  manualCap: number,
): number {
  if (!bandsEnabled) return manualCap;
  return IRS_CAP_BANDS.find((b) => age <= b.maxAge)!.cap;
}

/** The IRS deduction earned by a contribution: 20%, capped. */
export function irsBenefit(contribution: number, cap: number): number {
  return Math.min(contribution * IRS_DEDUCTION_RATE, cap);
}

/**
 * How much to contribute in a given year.
 * In maxDeductible mode this is cap/0.20 — the largest contribution still
 * fully matched by the 20% deduction. Contributing more earns nothing extra.
 */
export function contributionForYear(
  mode: ContributionMode,
  age: number,
  fixedAmount: number,
  bandsEnabled: boolean,
  manualCap: number,
): number {
  if (mode === 'fixed') return fixedAmount;
  return irsCapForAge(age, bandsEnabled, manualCap) / IRS_DEDUCTION_RATE;
}

/**
 * Benefits repayable if a tranche were redeemed now, majorados 10%/year.
 * Zero once the tranche is old enough to be redeemed in legal conditions.
 */
export function clawbackIfRedeemedNow(
  benefitReceived: number,
  trancheAgeYears: number,
): number {
  if (trancheAgeYears >= PPR_MIN_TRANCHE_AGE) return 0;
  return benefitReceived * (1 + CLAWBACK_MAJORATION_PER_YEAR * trancheAgeYears);
}
