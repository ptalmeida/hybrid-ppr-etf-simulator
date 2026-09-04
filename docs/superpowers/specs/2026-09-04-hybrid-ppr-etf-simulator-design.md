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

Everything below is user-editable. Nothing the engine uses is hardcoded.

| Field | Default | Notes |
|---|---|---|
| `currentAge` | 30 | drives the IRS band and, in `maxDeductible` mode, the contribution |
| `contributionMode` | `'fixed'` | `'fixed'` \| `'maxDeductible'` |
| `annualInvestment` | 2000 | € per year — used when `contributionMode === 'fixed'` |
| `years` | 33 | simulation horizon |
| `etfReturn` | 7.97 | % gross annual |
| `pprReturn` | 5.70 | % gross annual |
| `etfFee` | 0.10 | % annual TER |
| `pprFee` | 0.75 | % annual management fee |
| `pprTrackingError` | 0 | % annual additional drag — see below |
| `etfAnnualCost` | 0 | € fixed annual broker cost (custody, connectivity) |
| `mortgageStartYear` | 3 | first year redemptions may occur |
| `monthlyInstalment` | 500 | € — caps annual PPR redemption at 12× |
| `benefitDestination` | `'etf'` | `'etf'` \| `'ppr'` \| `'consumed'` |
| `reinvestRedemption` | true | reinvest net mortgage-redemption proceeds into the ETF |
| `etfTaxMode` | `'ladder'` | `'ladder'` \| `'flat28'` \| `'englobamento'` |
| `marginalRate` | 35 | % — only used when `etfTaxMode === 'englobamento'` |
| `use35Rule` | true | art. 4.º/3 full-balance eligibility vs per-entrega |
| `irsBandsEnabled` | true | age-band the IRS cap automatically |
| `irsBenefitCap` | 400 | € — used when `irsBandsEnabled` is false |
| `etfName` | "ETF S&P 500" | user-editable label, appears in cards/charts/legends |
| `pprName` | "PPR" | user-editable label, appears in cards/charts/legends |

### Age bands

When `irsBandsEnabled` is true the annual deduction cap follows art. 21.º EBF
from the participant's age in each simulated year:

| Age in year `t` | Cap | Contribution in `maxDeductible` mode |
|---|---|---|
| under 35 | €400 | €2000 |
| 35 to 50 | €350 | €1750 |
| over 50 | €300 | €1500 |

`maxDeductible` mode contributes exactly `cap / 0.20` each year — the largest
contribution that is still fully matched by the 20% deduction. Contributing more
than this earns no additional benefit, which is the point the mode exists to
make. The three bands are editable constants in `tax.ts`, not literals scattered
through the engine.

### Fees and drag

The PPR is charged `pprFee + pprTrackingError` per year; the ETF is charged
`etfFee` per year plus `etfAnnualCost` in absolute euros.

`pprTrackingError` exists because a PPR fund's realised return can lag its own
stated benchmark by considerably more than its management fee — community
analysis of one popular ETF-based PPR put the gap near 2.6%/year. It defaults to
0 so the simulator does not editorialise, but it is surfaced in Advanced
Settings with that explanation, because at plausible values it eliminates the
entire tax advantage on its own.

### Benefit destination

The IRS deduction is real money received the following year. How it is treated
changes the result by several multiples, so it is an explicit choice rather than
a boolean:

- `'etf'` (default) — injected as a new ETF tranche, compounding at the ETF rate.
- `'ppr'` — added to next year's PPR contribution, so a €2000 contribution
  effectively becomes €2400. This is the more aggressive reading and produces
  markedly larger differences.
- `'consumed'` — spent. Still counted in "benefits received" totals, never
  compounded.

The UI must state that these are modelling choices, not tax rules, and that the
comparison is only fair if the same discipline is applied to every scenario.

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
`min(0.20 * contribution, capForAge(t))` as a deduction to collection, where
`capForAge` applies the age bands when `irsBandsEnabled`, or returns
`irsBenefitCap` otherwise.

The UI notes that this cap sits inside the global cap on collection deductions
and is limited by the taxpayer's actual coleta — neither of which is modelled.

## Scenario mechanics

All three scenarios receive the **same out-of-pocket contribution** each year,
computed once from `contributionMode` and the participant's age, so they are
directly comparable. Scenario 1 receives no IRS benefit because it makes no PPR
contribution; that asymmetry is the whole point of the comparison.

**Scenario 1 — ETF only.** Contribution goes to the ETF. No IRS benefit, no
redemptions. Final liquidation taxed by the ETF rule.

**Scenario 2 — Hybrid.** Contribution goes to the PPR. Then:
- the IRS benefit for the year is routed per `benefitDestination`;
- if `reinvestRedemption`, the **net** proceeds of any mortgage redemption
  (principal + profit − 8% tax) are added as a new ETF tranche that year,
  because the household saved that much salary that would otherwise have paid
  the mortgage.

With `benefitDestination: 'consumed'` and `reinvestRedemption: false` nothing
compounds and the scenario should lose to Scenario 1. The generated explanation
must say so explicitly rather than leaving the user to notice.

**Scenario 3 — PPR only.** Contribution goes to the PPR. The IRS benefit is
received and mortgage redemptions still occur, but nothing is ever reinvested —
both are consumed. This scenario ignores `benefitDestination` and
`reinvestRedemption` entirely. It is the "do nothing clever" baseline: it shows
that the PPR's tax advantages alone do not beat the ETF's higher return over a
long horizon.

### Reporting benefits consistently

The IRS benefit and mortgage payments are real value received even when not
reinvested, so every scenario reports net value two ways in its summary card:
**portfolio only**, and **portfolio plus cumulative benefits received**. Charts
use portfolio-only so all three scenarios sit on one basis, with the second
figure available in tooltips.

This is exactly the distinction that makes published comparisons of these two
strategies disagree with each other by several multiples, so the app shows both
rather than picking one.

## Yearly loop

For `t = 1..years`, for each scenario:

1. Grow every existing tranche by its product's net rate: ETF at
   `etfReturn - etfFee`, PPR at `pprReturn - pprFee - pprTrackingError`. Then
   subtract `etfAnnualCost` from the ETF balance, pro-rata across tranches.
2. Compute this year's contribution from `contributionMode` and the age in year
   `t`, and add it as a new tranche of the scenario's primary product.
3. If the scenario has a PPR: compute and record the IRS benefit, then route it
   per `benefitDestination` (new ETF tranche, added to next year's PPR
   contribution, or consumed).
4. If `t >= mortgageStartYear`: determine eligible PPR tranches per the
   `use35Rule` regime, redeem oldest-first up to `12 * monthlyInstalment`,
   paying 8% on the profit portion of each redeemed amount; add net proceeds as
   a new ETF tranche if `reinvestRedemption`.
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
- `benefitDestination: 'consumed'` with `reinvestRedemption: false` produces a
  hybrid result strictly worse than Scenario 1
- conservation: total contributed + all growth − all tax = final net value
- zero-year and zero-contribution edge cases do not throw
- URL round-trip: `parse(serialise(config))` equals `config`, and a mangled
  query string yields defaults rather than throwing
- age bands: contribution and cap step correctly at ages 35 and 50 mid-horizon
- all three `benefitDestination` values, asserting `'ppr'` > `'etf'` >
  `'consumed'` in final value when the PPR return exceeds the ETF return, and
  the reverse when it does not
- `pprTrackingError` at 2.6% erases the hybrid advantage

### Regression fixture

A published community comparison (`r/literaciafinanceira`, "Golden SGF PPR ETF
vs investimento direto em ETF") provides an independent set of numbers. Its
setup: start at age 30, 30 years, 6% net ETF return, PPR return 6% − 0.75%
management fee, contributions of €2000/€1750/€1500 by age band.

| | Their figure |
|---|---|
| ETF final portfolio | €149,571.35 |
| ETF gains | €98,321.35 |
| ETF net after tax | €130,300.36 |
| PPR final portfolio | €129,660.60 |
| PPR gains | €78,410.60 |
| PPR net after 8% | €123,387.75 |
| IRS benefits received | €10,250.00 |
| Total contributed | €51,250.00 |

The engine must reproduce total contributed (€51,250 = 5×2000 + 15×1750 +
10×1500), the benefits total (€10,250 = 5×400 + 15×350 + 10×300), both gross
portfolio values, and the PPR net figure.

It must **not** reproduce their ETF net figure. They applied 19.6% to the entire
gain, but under FIFO the final years' tranches are younger than 8 years and are
taxed at 22.4%, 25.2% and 28%. Our result should therefore be slightly **below**
€130,300.36. The test asserts that direction explicitly, with a comment
explaining why we diverge — this is a correctness check on our FIFO
implementation, not a discrepancy to fix.

## The risk-equivalence warning

This is the most important caveat in the app and gets a permanent, non-dismissable
callout next to the return inputs — not a footnote.

Comparing a 100% equity S&P 500 ETF against a PPR is **not a like-for-like
comparison**. Portuguese PPR funds are typically mixed portfolios: one popular
ETF-based PPR sits at roughly 75% equities, 22.5% bonds and 2.5% money market.
A lower expected return is the *consequence* of lower risk, not a defect.

The simulator cannot tell whether the two return figures entered represent
comparable risk. It compares whatever the user types. The callout says so and
suggests either entering returns for genuinely comparable allocations, or
setting both returns equal to isolate the pure tax effect — which is what the
app is actually good at showing.

The app also names the things it cannot price:

- **Liquidity.** A PPR cannot be redeemed for an unforeseen need without the
  21.5% penalty and benefit clawback. An ETF can be sold any day.
- **Optionality.** ETF holdings can be rebalanced, harvested, or exited ahead of
  an expected drawdown. PPR holdings cannot.
- **Concentration.** The PPR ties both the retirement plan and the mortgage
  strategy to one provider.

## Known simplifications

Stated in the UI, not just here:

1. Deterministic constant returns. Real markets are not, and sequence-of-returns
   risk is invisible in a model like this.
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

Consulted 2026-09-04.

The Reddit thread the user referenced — `r/literaciafinanceira`, "Golden SGF PPR
ETF vs investimento direto em ETF" by u/preladapt, ~2 years old, 21 upvotes, 28
comments — could not be fetched (reddit.com blocks the crawler and the mirrors
are behind bot protection). The user supplied it as screenshots. It contributed
the age-banded contribution schedule, the regression fixture above, the two
rival treatments of the IRS benefit, and three points from commenters: the
75/22.5/2.5 allocation of that PPR (u/freewebcoins), its 0.75% management fee
(u/freewebcoins), a reported ~2.6%/year tracking error against benchmark
(u/tdstdstds), and the liquidity/optionality cost of locking money in a PPR
(u/JRJordao).

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
