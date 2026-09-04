# Simulador Híbrido PPR + ETF — Design

Date: 2026-09-04
Status: Approved

## Purpose

An educational, shareable web app that compares three long-term investment
strategies for a Portuguese tax resident who expects to take out a mortgage
(crédito habitação):

1. **ETF only** — annual contributions into an accumulating S&P 500 ETF.
2. **Hybrid** — contributions into a PPR to capture the IRS deduction, redeeming
   matured PPR tranches at the reduced 8% rate to pay mortgage instalments, and
   reinvesting all freed-up capital into the ETF.
3. **PPR only** — contributions into a PPR, redeemed at the end.

The app is educational. It is not financial advice and must say so.

## Non-goals

- No backend, no accounts, no persistence beyond the URL.
- No inflation modelling, no salary modelling, no mortgage amortisation schedule.
  The mortgage is represented solely by a start year and a monthly instalment,
  because that is all the tax rules need.
- No englobamento marginal-rate modelling. See "Known simplifications".

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4 + Recharts + lucide-react.

Static SPA, no server. Builds to flat files, hosted on GitHub Pages.

Rationale: the app has zero server-side needs. Next.js would add routing,
rendering-mode and build config for no benefit. The brief permits a simpler
framework and explicitly asks for KISS.

## Architecture

```
src/
  lib/
    types.ts        # SimConfig, Tranche, YearRow, ScenarioResult
    tax.ts          # tax constants + pure tax primitives
    engine.ts       # simulate(config): SimOutput   — pure, no React
    engine.test.ts  # vitest unit tests for the maths
    url.ts          # SimConfig <-> URLSearchParams
    format.ts       # currency / percent formatting (pt-PT)
  components/
    ConfigPanel.tsx
    SummaryCards.tsx
    charts/WealthChart.tsx
    charts/CompositionChart.tsx
    charts/TaxWaterfall.tsx
    charts/BracketBar.tsx
    charts/DeltaChart.tsx
    Explanation.tsx
    AdvancedSettings.tsx
  App.tsx
  main.tsx
```

**Boundary rule:** `lib/` never imports from `components/`. `engine.ts` is a pure
function of `SimConfig` with no I/O, no dates, no randomness. Every chart is a
presentational component receiving already-computed rows.

This is the main lever for maintainability: the tax rules will change, and when
they do the change is confined to `tax.ts` and `engine.ts` with tests to prove
it still works.

## Data model

```ts
type Product = 'etf' | 'ppr';

interface Tranche {
  yearDeposited: number;   // 1-based
  principal: number;       // € originally deposited
  value: number;           // € current value, grows annually
  product: Product;
}
```

A scenario's state is an ordered array of tranches, oldest first. FIFO is
therefore structural: redemptions and liquidations walk the array from index 0.

```ts
interface YearRow {
  year: number;
  etfBalance: number;
  pprBalance: number;
  contributed: number;      // cumulative € out of pocket
  mortgagePaid: number;     // cumulative € of mortgage covered by PPR
  irsBenefit: number;       // cumulative € of IRS deductions received
  taxPaidToDate: number;    // cumulative € of tax actually paid (PPR redemptions)
  netIfLiquidatedNow: number;
}

interface ScenarioResult {
  id: 'etf' | 'hybrid' | 'ppr';
  label: string;            // user-editable product names feed into this
  rows: YearRow[];
  final: {
    grossValue: number;
    etfTax: number;
    pprTax: number;
    irsBenefitTotal: number;
    mortgagePaidTotal: number;
    netValue: number;
    totalContributed: number;
    effectiveTaxRate: number;
    bracketBreakdown: { bracket: string; gain: number; tax: number }[];
  };
}
```

## Configuration (SimConfig)

| Field | Default | Notes |
|---|---|---|
| `annualInvestment` | 2000 | € per year |
| `years` | 33 | simulation horizon |
| `etfReturn` | 7.97 | % gross annual |
| `pprReturn` | 5.70 | % gross annual |
| `etfFee` | 0.10 | % annual TER |
| `pprFee` | 1.20 | % annual management fee |
| `mortgageStartYear` | 3 | first year redemptions may occur |
| `monthlyInstalment` | 500 | € — caps annual PPR redemption at 12× |
| `reinvest` | true | reinvest IRS benefit + redemption proceeds into ETF |
| `etfTaxMode` | `'ladder'` | `'ladder'` \| `'flat28'` \| `'englobamento'` |
| `marginalRate` | 35 | % — only used when `etfTaxMode === 'englobamento'` |
| `use35Rule` | true | art. 4.º/3 full-balance eligibility vs per-entrega |
| `irsBenefitCap` | 400 | € annual cap on the PPR IRS deduction |
| `etfName` | "ETF S&P 500" | user-editable label, appears in cards/charts/legends |
| `pprName` | "PPR" | user-editable label, appears in cards/charts/legends |

`etfName` and `pprName` are free text, trimmed, capped at 40 characters, and
fall back to the defaults when empty. They are interpolated into scenario
labels, chart legends, tooltips and the generated explanation, so the app reads
as being about the user's actual products. They are escaped as text content
only — never rendered as HTML.

## Tax rules

### ETF — capital gains (Categoria G)

**Lei n.º 31/2024** (art. 43.º/5 CIRS) excludes a share of the gain from taxation
based on holding period. This exclusion applies **automatically alongside the 28%
autonomous rate** — it does *not* require opting for englobamento. The effective
rates are therefore the default treatment:

| Age of tranche at liquidation | Gain excluded | Gain taxed | Effective rate |
|---|---|---|---|
| < 2 years | 0% | 100% | 28.0% |
| 2 to < 5 years | 10% | 90% | 25.2% |
| 5 to < 8 years | 20% | 80% | 22.4% |
| ≥ 8 years | 30% | 70% | 19.6% |

`etfTaxMode` selects between:

- `'ladder'` (default) — the table above.
- `'flat28'` — 28% on all gains regardless of age. Models assets that do not
  qualify for the exclusion.
- `'englobamento'` — the same exclusion coefficients applied to a user-supplied
  marginal IRS rate (`marginalRate`, default 35%) instead of 28%. Only
  advantageous when the marginal rate is below 28%.

Qualifying conditions the UI must state (they are the reason `'flat28'` exists):
the exclusion requires securities admitted to trading on a **regulated market**
or units in collective investment undertakings. **Fractional shares and
fractional ETFs, derivatives, crypto-assets and instruments from tax havens do
not qualify.** Englobamento is mandatory for holdings under 365 days when
taxable income is €80,000 or more — irrelevant at this horizon, but noted.

Loss offsetting is not modelled — returns are deterministic and positive.

### PPR — redemption for mortgage instalments

Legal basis: art. 4.º of DL 158/2002, **alínea g)** — *pagamento de prestações de
contratos de crédito à habitação própria e permanente*.

**Eligibility.** Two regimes, selected by `use35Rule`:

- **Per-entrega (art. 4.º/2, `use35Rule: false`).** A tranche is eligible only
  once at least five years have elapsed since that specific entrega. Applies to
  alíneas a), e), f) and g).
- **Full balance (art. 4.º/3, `use35Rule: true`, default).** Once five years have
  elapsed since the **first** entrega, the participant may redeem the **entire**
  PPR under alínea g), provided entregas made in the first half of the contract's
  life represent at least 35% of total entregas.

  With a constant annual contribution the first half is always exactly 50% of
  total entregas, so the 35% test is satisfied by construction — which is why
  this is the default. The engine asserts this rather than assuming it: it
  computes the actual first-half share from the contribution schedule each year
  and only lifts the per-tranche restriction when the share is ≥ 35%. This keeps
  the rule correct if contributions ever become non-uniform.

**What may be redeemed.** Alínea g) permits paying *prestações vencidas* and each
*prestação vincenda* as and when it falls due. It does **not** permit early
amortisation of outstanding capital. (The exceptional regime that allowed
amortisation expired 31 December 2024.) The model therefore caps annual
redemption at `12 * monthlyInstalment` — not a statutory ceiling, but the
practical limit of what there is to pay.

Redemption additionally requires `T >= mortgageStartYear`.

Tranches are consumed oldest-first (FIFO). A tranche may be partially redeemed;
the remainder stays invested and is eligible again next year.

**Tax.** Redemption in legal conditions is taxed under art. 21.º/3 EBF: the
taxable base is **two fifths of the income**, taxed autonomously at **20%** — an
effective **8% of the profit**, independent of holding period. Principal is
untaxed.

**IRS benefit clawback (art. 21.º EBF).** Deducted amounts are added back to that
year's coleta, *majorados em 10% por cada ano ou fracção*, if a redemption
occurs — **unless** the redemption is both in legal conditions and at least five
years after the entrega. Every redemption the engine performs satisfies both
conditions, so no clawback is ever applied. The engine nonetheless computes and
displays the clawback that *would* apply, as an educational figure, so the user
can see the cost of redeeming early.

Any PPR balance still held at the end of the horizon is liquidated at 8%,
assuming a legal-condition redemption.

**Redemption outside legal conditions** (informational panel only, not a
scenario): taxed autonomously at **21.5%**, reduced by the art. 5.º/3 CIRS
coefficients where the 35% test is met — 100% of income under 5 years, 80% for 5
to 8 years (**17.2%** effective), 40% beyond 8 years (**8.6%** effective) — plus
the benefit clawback above. The UI shows these rates so the user understands the
cost of the mortgage never materialising.

### IRS benefit

Each year a PPR contribution is made, the taxpayer receives
`min(0.20 * contribution, irsBenefitCap)` as a deduction to collection.

The cap is editable (default €400) with a note that the statutory cap is age
banded — €400 under 35, €350 from 35 to 50, €300 over 50 — and sits inside the
global cap on collection deductions and the taxpayer's actual coleta.

## Scenario mechanics

All three scenarios receive the same `annualInvestment` out of pocket each year,
so they are directly comparable.

**Scenario 1 — ETF only.** Contribution goes to the ETF. No IRS benefit. Final
liquidation taxed by the ETF rule.

**Scenario 2 — Hybrid.** Contribution goes to the PPR. Then, if `reinvest`:
- the IRS benefit for that year is added as a new ETF tranche in the same year;
- when a PPR tranche is redeemed for the mortgage, the **net** proceeds
  (principal + profit − 8% tax) are added as a new ETF tranche in that year,
  because the household saved that amount of salary that would otherwise have
  paid the mortgage.

If `reinvest` is false, both amounts are consumed and never compound. The
scenario should then lose to Scenario 1, and the UI should say why.

**Scenario 3 — PPR only.** Contribution goes to the PPR. The IRS benefit is
received and mortgage redemptions still occur, but nothing is ever reinvested —
both are consumed. This scenario never touches the ETF and ignores the
`reinvest` toggle entirely. It is the "do nothing clever" baseline, and its
purpose is to show that the PPR's tax advantages alone do not beat the ETF's
higher return over a long horizon.

The IRS benefit and mortgage payments are still tracked and reported for
Scenario 3, because they are real value received even when not reinvested. Net
value is therefore reported two ways in the summary card: portfolio-only, and
portfolio plus cumulative benefits received. Charts use portfolio-only for
series 1 and 5 so that all three scenarios are compared on the same basis.

## Yearly loop

For `t = 1..years`, for each scenario:

1. Grow every existing tranche by its product's net rate
   (`return - fee`, as a percentage).
2. Add this year's contribution as a new tranche of the scenario's primary
   product.
3. If the scenario has a PPR: compute and record the IRS benefit; inject into
   the ETF if the scenario reinvests.
4. If `t >= mortgageStartYear`: determine eligible PPR tranches per the
   `use35Rule` regime, redeem oldest-first up to `12 * monthlyInstalment`,
   paying 8% on the profit portion of each redeemed amount; inject net proceeds
   into the ETF if the scenario reinvests.
5. Record a `YearRow`, where `netIfLiquidatedNow` liquidates all remaining
   tranches under current rules.

Growth happens before contribution, so a tranche deposited in year `t` has not
yet grown in year `t`. Age at liquidation is `years - yearDeposited`.

## UI

Portuguese (pt-PT) throughout. Clean financial dashboard: light and dark, greens
and slate blues, generous whitespace, `tabular-nums` on every figure.

- **Header** — title, one-paragraph explanation, disclaimer that this is
  educational and not financial advice.
- **Configuration panel** — sidebar on desktop, collapsible top sheet on mobile.
  Editable `etfName` / `pprName` at the top; every field from `SimConfig`.
  Advanced settings collapsible, containing fees, `etfTaxMode` (+ `marginalRate`
  when englobamento is selected), `use35Rule`, the IRS cap, and a plain-language
  statement of every rule the engine applies with its legal citation.
  A "copiar link" button copies the current URL.
- **Summary cards** — one per scenario: net final value, total tax paid,
  effective tax rate, delta versus Scenario 1.
- **Charts** (all Recharts, all responsive, all with accessible tooltips):
  1. *Evolução do património* — line, three net-value series, reference line at
     the mortgage start year.
  2. *Composição ao longo do tempo* — stacked area for the hybrid scenario
     showing PPR balance, ETF balance and cumulative mortgage paid.
  3. *Impacto fiscal* — waterfall per scenario: gross → −ETF tax → −PPR tax →
     +IRS benefit → net.
  4. *Escalões FIFO* — horizontal stacked bar showing the share of the final ETF
     gain falling in each tax bracket.
  5. *Diferença acumulada* — Scenario 2 minus Scenario 1 per year, with the
     break-even year annotated.
- **Explanation** — generated from the computed result, naming real numbers from
  the current configuration.

## URL state

`SimConfig` is serialised to the query string and is the single source of truth.
Reading the URL on mount hydrates the config; every change replaces the URL via
`history.replaceState`. A "copiar link" button copies the current URL.

Keys are short and stable (`inv`, `yrs`, `etfr`, `pprr`, …). Unknown or invalid
values fall back to defaults rather than throwing, so a mangled link still
loads. Numeric inputs are clamped to sane ranges on parse.

## Testing

Vitest on `lib/`. Coverage targets the maths, not the UI:

- each FIFO bracket boundary (ages 1, 2, 4, 5, 7, 8, 9)
- all three `etfTaxMode` values, including englobamento at a marginal rate above
  and below 28%
- PPR eligibility under both regimes: `use35Rule: false` age 4 vs 5;
  `use35Rule: true` year 4 vs 5 after the first entrega
- the 35% test itself: a contribution schedule that fails it (all contributions
  in the second half) must fall back to per-entrega eligibility
- the year before vs at `mortgageStartYear`
- instalment cap: partial tranche redemption and rollover to the next year
- redemption never exceeds the PPR balance, and the balance never goes negative
- PPR tax is 8% of profit only — a tranche with zero profit is taxed zero
- IRS benefit cap: contribution below and above the 20%/€400 crossover (€2000)
- `reinvest: false` produces a hybrid result strictly worse than Scenario 1
- conservation: total contributed + all growth − all tax = final net value
- zero-year and zero-contribution edge cases do not throw
- URL round-trip: `parse(serialise(config))` equals `config`, and a mangled
  query string yields defaults rather than throwing

## Known simplifications

Stated in the UI, not just here:

1. Deterministic constant returns. Real markets are not.
2. No inflation; all figures are nominal.
3. The IRS benefit cap is not age-banded automatically and ignores the global
   cap on collection deductions and the taxpayer's available coleta.
4. The mortgage is a fixed instalment for the whole horizon; no amortisation
   schedule, no rate changes, no early repayment, and it is assumed to outlast
   the simulation.
5. PPR redemption is assumed always to be in legal conditions, and the PPR is
   assumed to be for own permanent housing as alínea g) requires.
6. The ETF is assumed accumulating, UCITS, and admitted to trading on a
   regulated market, so it qualifies for the Lei 31/2024 exclusion and is taxed
   only on sale. Fractional units would not qualify.
7. Contributions are annual lump sums, not monthly. Real monthly contributions
   would age slightly differently across bracket boundaries.
8. The engine does not model the taxpayer having insufficient coleta to absorb
   the deduction, nor loss offsetting, nor Anexo J reporting obligations.
9. Tax rules are those in force in 2026 and will change. The relevant sources
   are DL 158/2002 art. 4.º, EBF art. 21.º, CIRS art. 5.º/3 and art. 43.º/5,
   and Lei n.º 31/2024.

## Sources

Consulted 2026-09-04. The Reddit thread the user referenced
(`r/literaciafinanceira`) could not be retrieved — reddit.com blocks the crawler
and mirrors are behind bot protection.

- [Artigo 21.º EBF — Portal das Finanças](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf_rep/Pages/ebf-artigo-21-ordm-.aspx) — deduction bands, 2/5 at 20%, clawback with 10%/year majoração
- [Artigo 43.º CIRS — Portal das Finanças](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs43.aspx) — holding-period exclusions
- [DL 158/2002 consolidado — Banco de Portugal](https://www.bportugal.pt/sites/default/files/anexos/legislacoes/dl158ano2002c.PDF) — art. 4.º reembolso, alínea g), the 5-year and 35% rules
- [ASF — O reembolso ao participante num PPR/E](https://www.asf.com.pt/w/o-reembolso-ao-participante-num-plano-poupan%C3%A7a-reforma-/-educa%C3%A7%C3%A3o) — art. 4.º/2 and 4.º/3 wording
- [All Finance Matters — IRS reduzido sobre mais-valias](https://afm.tax/irs-reduzido-sobre-mais-valias-em-acoes-e-etfs/?lang=pt-pt) — Lei 31/2024 applies automatically, qualifying and excluded assets
- [Doutor Finanças — Aspetos fiscais dos PPR](https://www.doutorfinancas.pt/financas-pessoais/aspetos-fiscais-dos-ppr-o-que-precisa-de-saber/) — 8% effective in legal conditions; 21.5/17.2/8.6 outside
- [Doutor Finanças — Resgates para crédito habitação são os únicos ilimitados](https://www.doutorfinancas.pt/financas-pessoais/poupanca/ppr-resgates-para-credito-habitacao-sao-os-unicos-ilimitados/) — no IAS cap for alínea g)
- [Conselhos do Consultor — PPR para pagar crédito habitação](https://conselhosdoconsultor.com/ppr-para-pagar-credito-habitacao/) — instalments only, no capital amortisation
- [DECO Proteste — Usar o PPR para reduzir o crédito da casa](https://www.deco.proteste.pt/dinheiro/comprar-vender-casa/noticias/usar-ppr-reduzir-credito-habitacao-que-mudou) — expiry of the exceptional amortisation regime

## Deployment

`npm run build` produces `dist/`. A GitHub Actions workflow publishes it to
GitHub Pages on push to `main`. `vite.config.ts` sets `base` so asset paths work
from a repository subpath.
