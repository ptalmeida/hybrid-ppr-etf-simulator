import type { SimConfig } from './types';

export const DEFAULT_CONFIG: SimConfig = {
  currentAge: 30,
  contributionMode: 'fixed',
  contributionTiming: 'start',
  annualInvestment: 2000,
  years: 33,
  etfReturn: 7.97,
  pprReturn: 5.7,
  etfFee: 0.1,
  pprFee: 0.75,
  pprTrackingError: 0,
  etfAnnualCost: 0,
  hasMortgage: true,
  mortgageStartYear: 3,
  monthlyInstalment: 1000,
  benefitDestination: 'etf',
  reinvestRedemption: true,
  etfTaxMode: 'ladder',
  marginalRate: 35,
  use35Rule: true,
  irsBandsEnabled: true,
  irsBenefitCap: 400,
  logScale: false,
  etfName: 'ETF S&P 500',
  pprName: 'PPR',
};

/** Inclusive [min, max] bounds for every numeric field. Used by url.ts and the UI. */
export const BOUNDS: Record<string, [number, number]> = {
  currentAge: [18, 80],
  annualInvestment: [0, 100000],
  years: [1, 60],
  etfReturn: [-20, 30],
  pprReturn: [-20, 30],
  etfFee: [0, 5],
  pprFee: [0, 5],
  pprTrackingError: [0, 10],
  etfAnnualCost: [0, 5000],
  mortgageStartYear: [1, 60],
  monthlyInstalment: [0, 10000],
  marginalRate: [0, 53],
  irsBenefitCap: [0, 2000],
};

export const MAX_NAME_LENGTH = 40;
