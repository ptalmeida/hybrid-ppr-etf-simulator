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
| `useEnglobamento` | true | ETF holding-period ladder vs flat 28% |
| `irsBenefitCap` | 400 | € annual cap on the PPR IRS deduction |
| `etfName` | "ETF S&P 500" | user-editable label |
| `pprName` | "PPR" | user-editable label |

## Tax rules

### ETF — capital gains (Categoria G)

Two modes, user-selectable:

- **Flat (`useEnglobamento: false`)** — 28% on the gain of every tranche
  regardless of holding period. This is the default autonomous rate.
- **Ladder (`useEnglobamento: true`, default)** — art. 43.º/6 CIRS excludes a
  share of the gain by holding period, giving effective rates when combined with
  the 28% autonomous rate:

  | Age of tranche at liquidation | Gain considered | Effective rate |
  |---|---|---|
  | < 2 years | 100% | 28.0% |
  | 2 to < 5 years | 90% | 25.2% |
  | 5 to < 8 years | 80% | 22.4% |
  | ≥ 8 years | 70% | 19.6% |

  The UI must state that this reduction legally requires opting for
  *englobamento*, where the applicable rate is the taxpayer's marginal IRS rate
  rather than 28%, so these effective rates are a best case.

Loss offsetting is not modelled — returns are deterministic and positive.

### PPR — redemption for mortgage instalments

A PPR tranche may be redeemed without penalty to pay mortgage instalments when
both hold in year `T`:

- `T >= mortgageStartYear`, and
- the tranche's age (`T - yearDeposited`) is `>= 5`.

Tax on redemption: **8% of the profit only** (principal is untaxed).

Annual redemption is capped at `12 * monthlyInstalment`. Tranches are consumed
oldest-first. A tranche may be partially redeemed; the remainder stays invested
and is eligible again next year.

The cap is per-year only. The mortgage is assumed to outlast the horizon, so
there is no cumulative ceiling on redemptions.

Any PPR balance still held at the end of the horizon is liquidated at 8%. This
assumes the redemption is in legal conditions; the UI notes that redemption
outside legal conditions is taxed at 21.5% with clawback of past IRS benefits
plus a 10%/year penalty.

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
4. If `t >= mortgageStartYear`: redeem eligible PPR tranches oldest-first up to
   `12 * monthlyInstalment`, paying 8% on the profit portion of each redeemed
   amount; inject net proceeds into the ETF if the scenario reinvests.
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
  Advanced settings collapsible, containing fees, the ETF tax mode toggle, the
  IRS cap, and a plain-language statement of every rule the engine applies.
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
- flat-28% mode versus ladder mode
- PPR eligibility boundary (age 4 vs 5; year before vs at `mortgageStartYear`)
- instalment cap: partial tranche redemption and rollover to the next year
- IRS benefit cap: contribution below and above the 20%/€400 crossover (€2000)
- `reinvest: false` produces a hybrid result strictly worse than Scenario 1
- zero-year and zero-contribution edge cases do not throw
- URL round-trip: `parse(serialise(config))` equals `config`

## Known simplifications

Stated in the UI, not just here:

1. Deterministic constant returns. Real markets are not.
2. No inflation; all figures are nominal.
3. The englobamento ladder assumes a 28% base rate; under englobamento the real
   rate is the marginal IRS rate.
4. The IRS benefit cap is not age-banded automatically and ignores the global
   deduction cap and available coleta.
5. The mortgage is a fixed instalment for the whole horizon; no amortisation,
   no rate changes, no early repayment.
6. PPR redemption is assumed always to be in legal conditions.
7. Tax rules are those in force in 2026 and will change.

## Deployment

`npm run build` produces `dist/`. A GitHub Actions workflow publishes it to
GitHub Pages on push to `main`. `vite.config.ts` sets `base` so asset paths work
from a repository subpath.
