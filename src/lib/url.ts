import type {
  BenefitDestination,
  ContributionMode,
  ContributionTiming,
  EtfTaxMode,
  SimConfig,
} from './types';
import { BOUNDS, DEFAULT_CONFIG, MAX_NAME_LENGTH } from './defaults';

/**
 * Short, stable query keys. Never rename one: an old shared link must keep
 * working. To retire a field, stop writing it and keep parsing it.
 */
const KEYS: Record<keyof SimConfig, string> = {
  currentAge: 'age',
  contributionMode: 'cmode',
  contributionTiming: 'ctime',
  annualInvestment: 'inv',
  years: 'yrs',
  etfReturn: 'etfr',
  pprReturn: 'pprr',
  etfFee: 'etff',
  pprFee: 'pprf',
  pprTrackingError: 'pprte',
  etfAnnualCost: 'etfc',
  mortgageStartYear: 'mstart',
  monthlyInstalment: 'minst',
  benefitDestination: 'bdest',
  reinvestRedemption: 'rred',
  etfTaxMode: 'etfTax',
  marginalRate: 'mrate',
  use35Rule: 'r35',
  irsBandsEnabled: 'bands',
  irsBenefitCap: 'cap',
  etfName: 'etfN',
  pprName: 'pprN',
};

const CONTRIBUTION_MODES: ContributionMode[] = ['fixed', 'maxDeductible'];
const CONTRIBUTION_TIMINGS: ContributionTiming[] = ['start', 'end'];
const ETF_TAX_MODES: EtfTaxMode[] = ['ladder', 'flat28', 'englobamento'];
const BENEFIT_DESTINATIONS: BenefitDestination[] = ['etf', 'ppr', 'consumed'];

function clampNumber(field: keyof SimConfig, raw: string, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const bounds = BOUNDS[field as string];
  if (!bounds) return n;
  return Math.min(bounds[1], Math.max(bounds[0], n));
}

function pickEnum<T extends string>(raw: string, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(raw) ? (raw as T) : fallback;
}

function cleanName(raw: string, fallback: string): string {
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Serialise only what differs from the defaults, so links stay readable. */
export function serialiseConfig(cfg: SimConfig): string {
  const params = new URLSearchParams();
  for (const field of Object.keys(KEYS) as (keyof SimConfig)[]) {
    const value = cfg[field];
    if (value === DEFAULT_CONFIG[field]) continue;
    params.set(
      KEYS[field],
      typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
    );
  }
  return params.toString();
}

/** Parse a query string into a config. Never throws; bad input yields defaults. */
export function parseConfig(query: string): SimConfig {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return { ...DEFAULT_CONFIG };
  }

  const read = (field: keyof SimConfig): string | null => {
    try {
      return params.get(KEYS[field]);
    } catch {
      return null;
    }
  };

  const num = (field: keyof SimConfig): number => {
    const raw = read(field);
    const fallback = DEFAULT_CONFIG[field] as number;
    return raw === null ? fallback : clampNumber(field, raw, fallback);
  };

  const bool = (field: keyof SimConfig): boolean => {
    const raw = read(field);
    if (raw === null) return DEFAULT_CONFIG[field] as boolean;
    return raw === '1' || raw === 'true';
  };

  return {
    currentAge: num('currentAge'),
    contributionMode: pickEnum(
      read('contributionMode') ?? '',
      CONTRIBUTION_MODES,
      DEFAULT_CONFIG.contributionMode,
    ),
    contributionTiming: pickEnum(
      read('contributionTiming') ?? '',
      CONTRIBUTION_TIMINGS,
      DEFAULT_CONFIG.contributionTiming,
    ),
    annualInvestment: num('annualInvestment'),
    years: num('years'),
    etfReturn: num('etfReturn'),
    pprReturn: num('pprReturn'),
    etfFee: num('etfFee'),
    pprFee: num('pprFee'),
    pprTrackingError: num('pprTrackingError'),
    etfAnnualCost: num('etfAnnualCost'),
    mortgageStartYear: num('mortgageStartYear'),
    monthlyInstalment: num('monthlyInstalment'),
    benefitDestination: pickEnum(
      read('benefitDestination') ?? '',
      BENEFIT_DESTINATIONS,
      DEFAULT_CONFIG.benefitDestination,
    ),
    reinvestRedemption: bool('reinvestRedemption'),
    etfTaxMode: pickEnum(
      read('etfTaxMode') ?? '',
      ETF_TAX_MODES,
      DEFAULT_CONFIG.etfTaxMode,
    ),
    marginalRate: num('marginalRate'),
    use35Rule: bool('use35Rule'),
    irsBandsEnabled: bool('irsBandsEnabled'),
    irsBenefitCap: num('irsBenefitCap'),
    etfName: cleanName(read('etfName') ?? '', DEFAULT_CONFIG.etfName),
    pprName: cleanName(read('pprName') ?? '', DEFAULT_CONFIG.pprName),
  };
}
