export type Product = 'etf' | 'ppr';
export type ScenarioId = 'etf' | 'hybrid';
export type ContributionMode = 'fixed' | 'maxDeductible';
export type EtfTaxMode = 'ladder' | 'flat28' | 'englobamento';
export type BenefitDestination = 'etf' | 'ppr' | 'consumed';
export type ContributionTiming = 'start' | 'end';

export interface SimConfig {
  currentAge: number;
  contributionMode: ContributionMode;
  contributionTiming: ContributionTiming;
  annualInvestment: number;
  years: number;
  etfReturn: number;
  pprReturn: number;
  etfFee: number;
  pprFee: number;
  pprTrackingError: number;
  etfAnnualCost: number;
  hasMortgage: boolean;
  mortgageStartYear: number;
  monthlyInstalment: number;
  benefitDestination: BenefitDestination;
  reinvestRedemption: boolean;
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
  use35Rule: boolean;
  irsBandsEnabled: boolean;
  irsBenefitCap: number;
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
  mortgagePaidTotal: number;
  mortgageDueTotal: number;
  mortgagePaidFromSalary: number;
  freedSalaryReinvested: number;
  totalOutOfPocket: number;
  penalisedExit: boolean;
  benefitClawback: number;
  netValue: number;
  netWithBenefits: number;
  totalContributed: number;
  effectiveTaxRate: number;
  bracketBreakdown: BracketSlice[];
}

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  rows: YearRow[];
  final: ScenarioFinal;
}

export interface SimOutput {
  scenarios: ScenarioResult[];
  breakEvenYear: number | null;
}
