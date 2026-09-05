import type {
  AfterMortgage,
  BenefitDestination,
  ContributionMode,
  ContributionTiming,
  EtfTaxMode,
  SimConfig,
} from './types';
import { BOUNDS, DEFAULT_CONFIG, MAX_NAME_LENGTH } from './defaults';
import type { FeeRule } from './fees';

/**
 * Short, stable query keys. Never rename one: an old shared link must keep
 * working. To retire a field, stop writing it and keep parsing it.
 */
const KEYS: Record<Exclude<keyof SimConfig, 'extraFees'>, string> = {
  currentAge: 'age',
  contributionMode: 'cmode',
  contributionTiming: 'ctime',
  annualInvestment: 'inv',
  years: 'yrs',
  etfReturn: 'etfr',
  pprReturn: 'pprr',
  pprSubscriptionFee: 'pprsub',
  pprFee: 'pprf',
  pprDepositaryFee: 'pprdep',
  pprUnderlyingFee: 'pprund',
  pprRedemptionFee: 'pprred',
  pprRedemptionFeeYears: 'pprredy',
  pprTrackingError: 'pprte',
  etfFee: 'etff',
  etfCustodyFee: 'etfcust',
  etfBuyFee: 'etfbuy',
  etfBuyFeeFixed: 'etfbuyf',
  etfSellFee: 'etfsell',
  etfAnnualCost: 'etfc',
  hasMortgage: 'ch',
  mortgageStartYear: 'mstart',
  mortgageYears: 'mlen',
  afterMortgage: 'after',
  monthlyInstalment: 'minst',
  benefitDestination: 'bdest',
  reinvestRedemption: 'rred',
  etfTaxMode: 'etfTax',
  marginalRate: 'mrate',
  redeemYoungEntregas: 'young',
  irsBandsEnabled: 'bands',
  irsBenefitCap: 'cap',
  logScale: 'log',
  etfName: 'etfN',
  pprName: 'pprN',
};

const CONTRIBUTION_MODES: ContributionMode[] = ['fixed', 'maxDeductible'];
const CONTRIBUTION_TIMINGS: ContributionTiming[] = ['start', 'end'];
const AFTER_MORTGAGE: AfterMortgage[] = ['ppr', 'etf', 'stop'];
const ETF_TAX_MODES: EtfTaxMode[] = ['ladder', 'flat28', 'englobamento'];
const BENEFIT_DESTINATIONS: BenefitDestination[] = ['etf', 'ppr', 'consumed'];

function clampNumber(field: string, raw: string, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const bounds = BOUNDS[field];
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

/**
 * Irregular fee rules ride along as compact base64url JSON.
 *
 * They cannot be expressed as a scalar query parameter, and dropping them
 * would make a shared link compute a different answer from the page that
 * produced it — the one thing a shareable simulator must never do.
 */
function encodeFees(rules: FeeRule[]): string {
  const json = JSON.stringify(rules);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeFees(raw: string): FeeRule[] | undefined {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return Array.isArray(parsed) ? (parsed as FeeRule[]) : undefined;
  } catch {
    return undefined;
  }
}

/** Serialise only what differs from the defaults, so links stay readable. */
export function serialiseConfig(cfg: SimConfig): string {
  const params = new URLSearchParams();
  for (const field of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
    const value = cfg[field];
    if (value === DEFAULT_CONFIG[field]) continue;
    params.set(
      KEYS[field],
      typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
    );
  }
  const fees = cfg.extraFees ?? [];
  if (JSON.stringify(fees) !== JSON.stringify(DEFAULT_CONFIG.extraFees ?? [])) {
    params.set('xf', encodeFees(fees));
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

  const read = (field: keyof typeof KEYS): string | null => {
    try {
      return params.get(KEYS[field]);
    } catch {
      return null;
    }
  };

  const num = (field: keyof typeof KEYS): number => {
    const raw = read(field);
    const fallback = DEFAULT_CONFIG[field] as number;
    return raw === null ? fallback : clampNumber(field, raw, fallback);
  };

  let rawFees: string | null = null;
  try {
    rawFees = params.get('xf');
  } catch {
    rawFees = null;
  }

  const bool = (field: keyof typeof KEYS): boolean => {
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
    pprSubscriptionFee: num('pprSubscriptionFee'),
    pprFee: num('pprFee'),
    pprDepositaryFee: num('pprDepositaryFee'),
    pprUnderlyingFee: num('pprUnderlyingFee'),
    pprRedemptionFee: num('pprRedemptionFee'),
    pprRedemptionFeeYears: num('pprRedemptionFeeYears'),
    pprTrackingError: num('pprTrackingError'),
    etfFee: num('etfFee'),
    etfCustodyFee: num('etfCustodyFee'),
    etfBuyFee: num('etfBuyFee'),
    etfBuyFeeFixed: num('etfBuyFeeFixed'),
    etfSellFee: num('etfSellFee'),
    etfAnnualCost: num('etfAnnualCost'),
    hasMortgage: bool('hasMortgage'),
    mortgageStartYear: num('mortgageStartYear'),
    mortgageYears: num('mortgageYears'),
    afterMortgage: pickEnum(
      read('afterMortgage') ?? '',
      AFTER_MORTGAGE,
      DEFAULT_CONFIG.afterMortgage,
    ),
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
    redeemYoungEntregas: bool('redeemYoungEntregas'),
    irsBandsEnabled: bool('irsBandsEnabled'),
    irsBenefitCap: num('irsBenefitCap'),
    logScale: bool('logScale'),
    etfName: cleanName(read('etfName') ?? '', DEFAULT_CONFIG.etfName),
    pprName: cleanName(read('pprName') ?? '', DEFAULT_CONFIG.pprName),
    extraFees: rawFees === null ? DEFAULT_CONFIG.extraFees : decodeFees(rawFees) ?? [],
  };
}
