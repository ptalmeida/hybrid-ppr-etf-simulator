import type { SimConfig } from './types';
import type { FeeRule } from './fees';

/**
 * A product a user can pick instead of typing a fee schedule by hand.
 *
 * A preset owns the product's OWN characteristics: its name and what it
 * charges. It deliberately does NOT own the expected return, nor the broker
 * costs on the ETF side.
 *
 *  - Fees are verifiable facts about the product, published in its KID.
 *  - The expected return is a forecast the user makes. Auto-filling a 2.8-year
 *    bull-market figure as a 33-year assumption would be the exact error this
 *    simulator warns about everywhere else. Each preset carries its documented
 *    history instead, with the window attached, and applying it is one click.
 *  - Broker commission and custody belong to the user's broker, not the fund.
 */
export interface Preset<K extends keyof SimConfig> {
  id: string;
  /** Shown in the dropdown. */
  label: string;
  /** One line under the dropdown. */
  description: string;
  isin?: string;
  /** Exactly the config fields this preset sets. Matching compares only these. */
  values: Pick<SimConfig, K> & { extraFees?: FeeRule[] };
  history?: {
    /** Annualised, net of the product's own charges. */
    annualisedPct: number;
    /** Plain-language window, e.g. "5 anos, até jul 2026". */
    window: string;
    /** Years the window covers, used to warn about short samples. */
    years: number;
    /** Machine-comparable window, so mismatched periods can be detected. */
    from: string;
    to: string;
    /**
     * What a 100% global equity ETF returned over THIS product's window.
     *
     * Without it a reader compares two figures measured over different
     * periods and concludes the wrong thing — a mixed fund appearing to beat
     * pure equities is almost always this mistake, not a real result.
     */
    comparableEquity?: {
      annualisedPct: number;
      label: string;
      approximate?: boolean;
    };
    caution?: string;
  };
  sri?: number;
  inception?: string;
  sources: string[];
}

export type EtfPresetKey = 'etfName' | 'etfFee';
export type PprPresetKey =
  | 'pprName'
  | 'pprSubscriptionFee'
  | 'pprFee'
  | 'pprDepositaryFee'
  | 'pprUnderlyingFee'
  | 'pprRedemptionFee'
  | 'pprRedemptionFeeYears';

export type EtfPreset = Preset<EtfPresetKey>;
export type PprPreset = Preset<PprPresetKey>;

/**
 * Data as of the July 2026 issuer factsheets. See docs/research/etfs.md for
 * the sources and for every figure that could not be verified.
 */
export const ETF_PRESETS: EtfPreset[] = [
  {
    id: 'vwce',
    label: 'Vanguard FTSE All-World (VWCE)',
    description:
      'Ações de todo o mundo, desenvolvidas e emergentes, cerca de 3600 empresas. Acumulação, domiciliado na Irlanda.',
    isin: 'IE00BK5BQT80',
    values: { etfName: 'VWCE', etfFee: 0.14 },
    history: {
      annualisedPct: 10.84,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
    },
    sri: 4,
    inception: 'jul 2019',
    sources: ['https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQT80'],
  },
  {
    id: 'fwra',
    label: 'Invesco FTSE All-World (FWRA)',
    description:
      'O mesmo índice da VWCE, com um TER ligeiramente superior e um fundo bastante mais pequeno.',
    isin: 'IE000716YHJ7',
    values: { etfName: 'FWRA', etfFee: 0.15 },
    inception: 'jun 2023',
    sources: ['https://etf.invesco.com/'],
  },
  {
    id: 'webn',
    label: 'Amundi Prime All-Country World (WEBN)',
    description:
      'Ações globais ao TER mais baixo desta lista, mas com poucos anos de histórico.',
    isin: 'IE0003XJA0J9',
    values: { etfName: 'WEBN', etfFee: 0.07 },
    sri: 4,
    inception: 'jun 2024',
    sources: ['https://www.amundietf.pt/'],
  },
  {
    id: 'iwda',
    label: 'iShares Core MSCI World (IWDA)',
    description:
      'Só mercados desenvolvidos — não inclui emergentes, ao contrário das All-World.',
    isin: 'IE00B4L5Y983',
    values: { etfName: 'IWDA', etfFee: 0.2 },
    history: {
      annualisedPct: 11.26,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
    },
    inception: 'set 2009',
    sources: ['https://www.ishares.com/'],
  },
  {
    id: 'vuaa',
    label: 'Vanguard S&P 500 (VUAA)',
    description:
      '500 maiores empresas dos EUA. Muito mais concentrado do que um fundo global.',
    isin: 'IE00BFMXXD54',
    values: { etfName: 'VUAA', etfFee: 0.07 },
    history: {
      annualisedPct: 12.55,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
    },
    sri: 4,
    inception: 'mai 2019',
    sources: ['https://www.vanguard.co.uk/'],
  },
  {
    id: 'cspx',
    label: 'iShares Core S&P 500 (CSPX)',
    description: 'O mesmo índice da VUAA, ao mesmo TER, num fundo maior e mais antigo.',
    isin: 'IE00B5BMR087',
    values: { etfName: 'CSPX', etfFee: 0.07 },
    history: {
      annualisedPct: 12.55,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
    },
    sri: 4,
    inception: 'mai 2010',
    sources: ['https://www.ishares.com/'],
  },
  {
    id: 'spy5',
    label: 'SPDR S&P 500 (SPY5)',
    description:
      'O TER mais baixo do mercado para o S&P 500 em UCITS, mas distribui dividendos em vez de os acumular.',
    isin: 'IE00B6YX5C33',
    values: { etfName: 'SPY5', etfFee: 0.03 },
    history: {
      annualisedPct: 12.48,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
    },
    inception: 'mar 2012',
    sources: ['https://www.ssga.com/'],
  },
];

/**
 * Data from the gestoras' own pages and KIDs, plus the ASF/APFIPP ranking via
 * ativos.pt (2026-07-03). See docs/research/pprs.md, which marks every figure
 * that could not be verified.
 *
 * Worth knowing before reading these: no Portuguese PPR tracks the S&P 500.
 * The closest are equity-heavy mixed funds, so none of these is comparable to
 * a 100% equity ETF on risk.
 */
export const PPR_PRESETS: PprPreset[] = [
  {
    id: 'golden-etf',
    label: 'Golden SGF PPR ETF',
    description:
      'Cerca de 75% ações globais e 22,5% obrigações, através de ETF. A comissão de gestão desce de 1% para 0,75% a partir de 10 000 € investidos.',
    values: {
      pprName: 'Golden SGF PPR ETF',
      pprSubscriptionFee: 0,
      // the management fee is a balance tier, so it lives in extraFees
      pprFee: 0,
      pprDepositaryFee: 0.08,
      pprUnderlyingFee: 0.35,
      pprRedemptionFee: 1,
      pprRedemptionFeeYears: 1,
      extraFees: [
        {
          label: 'Gestão — Classe Start (abaixo de 10 000 €)',
          product: 'ppr',
          basis: 'annual',
          pct: 1,
          maxBalance: 10000,
        },
        {
          label: 'Gestão — Classe Plus (10 000 € ou mais)',
          product: 'ppr',
          basis: 'annual',
          pct: 0.75,
          minBalance: 10000,
        },
      ],
    },
    history: {
      annualisedPct: 12.4,
      window: '2,8 anos, de out 2023 a jul 2026',
      years: 2.8,
      from: '2023-10',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 21,
        label: 'VWCE',
        approximate: true,
      },
      caution:
        'Anualizado a partir do valor cumulativo de +37,95% publicado pela gestora. A janela começa no mínimo de outubro de 2023 e não apanha a queda de 2022, por isso não é comparável com os 5 anos dos ETF acima.',
    },
    sri: 4,
    inception: 'out 2023 (Classe Plus)',
    sources: [
      'https://ajuda.goldensgf.pt/docs/quais-as-comissoes-do-produto/',
      'https://novo-ppr-etf.goldensgf.pt/ppr-aditivado',
    ],
  },
  {
    id: 'stoik',
    label: 'SGF Stoik',
    description:
      'Ações globais via ETF com uma componente escolhida ativamente. Muito falado online: ficou em 30.º lugar do mercado a 5 anos.',
    values: {
      pprName: 'SGF Stoik',
      pprSubscriptionFee: 0,
      pprFee: 1,
      pprDepositaryFee: 0.08,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 1,
      pprRedemptionFeeYears: 1,
    },
    history: {
      annualisedPct: 3.1,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 10.84,
        label: 'VWCE',
      },
      caution:
        'Custos correntes dos ETF subjacentes não divulgados, por isso o custo real é superior ao que aqui está.',
    },
    sri: 4,
    sources: ['https://stoik.pt/custos-ppr'],
  },
  {
    id: 'optimize-agressivo',
    label: 'Optimize Capital Reforma Agressivo',
    description:
      'Fundo de ações gerido ativamente. Encargos correntes de 2,04% ao ano — dos mais altos do mercado.',
    values: {
      pprName: 'Optimize Agressivo',
      pprSubscriptionFee: 0,
      // the KID publishes one all-in ongoing charge, not a breakdown
      pprFee: 2.04,
      pprDepositaryFee: 0,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 0,
      pprRedemptionFeeYears: 0,
    },
    history: {
      annualisedPct: 4.82,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 10.84,
        label: 'VWCE',
      },
    },
    sri: 5,
    sources: ['https://www.optimize.pt/'],
  },
  {
    id: 'bpi-global-equities',
    label: 'BPI Reforma Global Equities',
    description: 'Fundo PPR de ações globais do BPI, gerido ativamente.',
    values: {
      pprName: 'BPI Reforma Global Equities',
      pprSubscriptionFee: 0,
      pprFee: 1.25,
      pprDepositaryFee: 0.08,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 0,
      pprRedemptionFeeYears: 0,
    },
    history: {
      annualisedPct: 3.77,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 10.84,
        label: 'VWCE',
      },
      caution: 'Comissão de gestão não confirmada em fonte primária.',
    },
    sri: 5,
    sources: ['https://www.bpi.pt/'],
  },
  {
    id: 'golden-dinamica',
    label: 'Golden SGF Poupança Dinâmica',
    description:
      'Fundo de pensões da mesma gestora, mais antigo e mais agressivo. Segundo melhor PPR do país a 5 anos.',
    values: {
      pprName: 'Golden SGF Poupança Dinâmica',
      pprSubscriptionFee: 0,
      pprFee: 1,
      pprDepositaryFee: 0.08,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 0,
      pprRedemptionFeeYears: 0,
    },
    history: {
      annualisedPct: 8.38,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 10.84,
        label: 'VWCE',
      },
      caution:
        'Comissões não confirmadas individualmente para este fundo; assumidas iguais às da casa.',
    },
    sri: 5,
    sources: ['https://www.ativos.pt/planos-poupanca-reforma'],
  },
  {
    id: 'media-mercado',
    label: 'Média do mercado português',
    description:
      'Não é um produto: é a média dos 1070 PPR analisados pela ASF e APFIPP. Serve de referência honesta.',
    values: {
      pprName: 'PPR médio do mercado',
      pprSubscriptionFee: 0,
      pprFee: 0.85,
      pprDepositaryFee: 0,
      pprUnderlyingFee: 0,
      pprRedemptionFee: 0,
      pprRedemptionFeeYears: 0,
    },
    history: {
      annualisedPct: 1.97,
      window: '5 anos, até jul 2026',
      years: 5,
      from: '2021-07',
      to: '2026-07',
      comparableEquity: {
        annualisedPct: 10.84,
        label: 'VWCE',
      },
      caution:
        'Média de 1070 produtos, a maioria de capital garantido. É o número que mostra o que um PPR escolhido ao acaso costuma render.',
    },
    sources: ['https://www.ativos.pt/planos-poupanca-reforma'],
  },
];

const ETF_KEYS: EtfPresetKey[] = ['etfName', 'etfFee'];
const PPR_KEYS: PprPresetKey[] = [
  'pprName',
  'pprSubscriptionFee',
  'pprFee',
  'pprDepositaryFee',
  'pprUnderlyingFee',
  'pprRedemptionFee',
  'pprRedemptionFeeYears',
];

function sameFees(a?: FeeRule[], b?: FeeRule[]): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/**
 * Which preset the current config corresponds to, or null for a custom setup.
 *
 * Derived rather than stored. Storing the selection means keeping two things
 * in step, and they drift the moment a field is edited from anywhere else.
 */
function matchPreset<K extends keyof SimConfig>(
  presets: Preset<K>[],
  keys: K[],
  cfg: SimConfig,
  compareFees: boolean,
): Preset<K> | null {
  return (
    presets.find((p) => {
      const fieldsMatch = keys.every((k) => cfg[k] === p.values[k]);
      if (!fieldsMatch) return false;
      return compareFees ? sameFees(cfg.extraFees, p.values.extraFees) : true;
    }) ?? null
  );
}

export const matchEtfPreset = (cfg: SimConfig) =>
  matchPreset(ETF_PRESETS, ETF_KEYS, cfg, false);

export const matchPprPreset = (cfg: SimConfig) =>
  matchPreset(PPR_PRESETS, PPR_KEYS, cfg, true);

/** The config changes a preset applies. Everything else is left alone. */
export function applyEtfPreset(p: EtfPreset): Partial<SimConfig> {
  return { ...p.values };
}

export function applyPprPreset(p: PprPreset): Partial<SimConfig> {
  // extraFees is replaced wholesale, including with [] so a flat-fee preset
  // clears a tiered one rather than inheriting its bands
  return { ...p.values, extraFees: p.values.extraFees ?? [] };
}

/**
 * The gross return that reproduces a preset's published history.
 *
 * Published fund returns are already net of the product's own annual charges,
 * while the engine works from a gross figure and subtracts them. Handing the
 * net number straight to the engine would charge those fees twice.
 */
export function grossReturnFor(
  p: EtfPreset | PprPreset,
): number | null {
  if (!p.history) return null;
  const values = p.values as Partial<SimConfig>;
  const annualDrag =
    (values.etfFee ?? 0) +
    (values.pprFee ?? 0) +
    (values.pprDepositaryFee ?? 0) +
    (values.pprUnderlyingFee ?? 0) +
    (values.extraFees ?? [])
      .filter((f) => f.basis === 'annual')
      // a balance-tiered fee has no single rate; take the highest band, which
      // is what a plan pays while it is small
      .reduce((max, f) => Math.max(max, f.pct ?? 0), 0);

  return Math.round((p.history.annualisedPct + annualDrag) * 100) / 100;
}
