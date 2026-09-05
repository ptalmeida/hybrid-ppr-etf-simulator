import type { FeeRule } from './fees';

export type Product = 'etf' | 'ppr';
export type ScenarioId = 'etf' | 'hybrid';
export type ContributionMode = 'fixed' | 'maxDeductible';
export type EtfTaxMode = 'ladder' | 'flat28' | 'englobamento';
export type BenefitDestination = 'etf' | 'ppr' | 'consumed';
export type ContributionTiming = 'start' | 'end';
export type AfterMortgage = 'ppr' | 'etf' | 'stop';

export interface SimConfig {
  currentAge: number;
  contributionMode: ContributionMode;
  contributionTiming: ContributionTiming;
  annualInvestment: number;
  years: number;
  etfReturn: number;
  pprReturn: number;
  // --- PPR charges -------------------------------------------------------
  /** % of each entrega taken before it reaches the plan. */
  pprSubscriptionFee: number;
  /** % a year on assets — the gestora's management commission. */
  pprFee: number;
  /** % a year on assets — the depositary/custodian. */
  pprDepositaryFee: number;
  /** % a year — running costs of the funds the PPR itself holds. */
  pprUnderlyingFee: number;
  /** % of the amount redeemed, charged only on young units. */
  pprRedemptionFee: number;
  /** Unit age below which the redemption fee applies, in years. */
  pprRedemptionFeeYears: number;
  /** % a year of realised underperformance versus the stated benchmark. */
  pprTrackingError: number;

  // --- ETF charges -------------------------------------------------------
  /** % a year — the fund's TER. */
  etfFee: number;
  /** % a year — broker custody, where charged as a percentage. */
  etfCustodyFee: number;
  /** % of each purchase — commission and FX spread. */
  etfBuyFee: number;
  /** € per purchase — flat dealing commission. */
  etfBuyFeeFixed: number;
  /** % of the sale — commission and FX spread on the way out. */
  etfSellFee: number;
  /** € a year — flat platform or connectivity costs. */
  etfAnnualCost: number;
  hasMortgage: boolean;
  mortgageStartYear: number;
  mortgageYears: number;
  afterMortgage: AfterMortgage;
  monthlyInstalment: number;
  benefitDestination: BenefitDestination;
  reinvestRedemption: boolean;
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
  redeemYoungEntregas: boolean;
  irsBandsEnabled: boolean;
  irsBenefitCap: number;
  /**
   * Irregular charges the flat fields above cannot express: tiered by balance,
   * stepped by holding period, limited to the first years, performance-based.
   * Presets populate this so the user never has to.
   */
  extraFees?: FeeRule[];
  logScale: boolean;
  etfName: string;
  pprName: string;
}

export interface Tranche {
  yearDeposited: number;
  principal: number;
  value: number;
  product: Product;
}

export interface YearRow {
  year: number;
  age: number;
  etfBalance: number;
  pprBalance: number;
  contributedThisYear: number;
  contributed: number;
  redeemedThisYear: number;
  mortgagePaid: number;
  irsBenefitThisYear: number;
  irsBenefit: number;
  taxPaidToDate: number;
  netIfLiquidatedNow: number;
  netWithBenefits: number;
}

/** One tranche redeemed in one year — a row of the audit ledger. */
export interface RedemptionEntry {
  /** Year the redemption happened. */
  year: number;
  /** Participant's age that year. */
  age: number;
  /** Year the redeemed entrega was made. */
  entregaYear: number;
  /** Whole years between the two. Must be >= 5 for the deduction to survive. */
  ageYears: number;
  gross: number;
  principal: number;
  profit: number;
  tax: number;
  /** Gestora's redemption commission on this slice. */
  fee: number;
  net: number;
  /** IRS deduction this entrega earned in the year it was made. */
  benefitEarned: number;
  /** IRS deduction handed back, non-zero only for entregas under five years. */
  clawback: number;
}

export interface BracketSlice {
  bracket: string;
  ratePct: number;
  gain: number;
  tax: number;
}

export interface ScenarioFinal {
  grossValue: number;
  etfTax: number;
  pprTax: number;
  pprTaxDuringRedemptions: number;
  irsBenefitTotal: number;
  /**
   * Money paid into the PPR that earned no deduction, because 20% of it was
   * already over the age cap. It sits locked up for nothing.
   */
  contributionsWithoutBenefit: number;
  mortgagePaidTotal: number;
  mortgageDueTotal: number;
  mortgagePaidFromSalary: number;
  freedSalaryReinvested: number;
  /** Benefit received and NOT reinvested — still in hand at the end. */
  benefitInHand: number;
  /** Mortgage paid by the PPR whose freed salary was NOT reinvested. */
  mortgageInHand: number;
  totalOutOfPocket: number;
  penalisedExit: boolean;
  mortgageEndYear: number | null;
  pprAfterMortgageEnds: boolean;
  benefitClawback: number;
  netValue: number;
  netWithBenefits: number;
  totalContributed: number;
  /** Every charge paid across the horizon, excluding tax. */
  feesPaid: number;
  effectiveTaxRate: number;
  bracketBreakdown: BracketSlice[];
}

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  rows: YearRow[];
  /** Every PPR redemption, oldest first. Empty for the ETF scenario. */
  redemptions: RedemptionEntry[];
  final: ScenarioFinal;
}

export interface SimOutput {
  scenarios: ScenarioResult[]; // always [etf, hybrid]
  breakEvenYear: number | null;
  /**
   * Last year a PPR entrega can still be redeemed through alínea g), i.e. the
   * last year it is worth contributing at all. Null when there is no mortgage.
   */
  lastUsefulPprYear: number | null;
}
