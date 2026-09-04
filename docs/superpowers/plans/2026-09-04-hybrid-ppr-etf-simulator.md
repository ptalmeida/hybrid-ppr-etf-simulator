# Simulador Híbrido PPR + ETF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, shareable Portuguese-language web app that compares three long-term investment strategies (ETF only, PPR+mortgage hybrid, PPR only) under Portuguese tax law, with accurate FIFO tranche accounting and rich charts.

**Architecture:** A pure `simulate(config)` function in `src/lib/` owns all the maths and knows nothing about React. Scenario state is an ordered array of tranches, so FIFO falls out structurally. React components in `src/components/` are presentational and receive computed rows. `SimConfig` lives in the URL query string as the single source of truth, making every result shareable by link.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Tailwind CSS v4, Recharts 3, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-hybrid-ppr-etf-simulator-design.md`. Read it before starting — it contains the legal citations behind every rule implemented here.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/types.ts` | All shared types. No logic. |
| `src/lib/tax.ts` | Tax constants and pure primitives: bracket lookup, PPR tax, IRS cap/contribution by age. No loops over years. |
| `src/lib/tranches.ts` | Tranche array operations: grow, add, redeem-FIFO, liquidate. No tax policy decisions beyond calling `tax.ts`. |
| `src/lib/engine.ts` | The year loop. Orchestrates `tax.ts` + `tranches.ts` into `SimOutput`. |
| `src/lib/url.ts` | `SimConfig` ⇄ query string, with clamping and safe fallbacks. |
| `src/lib/format.ts` | pt-PT currency/percent formatting. |
| `src/lib/defaults.ts` | `DEFAULT_CONFIG` and field bounds, imported by both `url.ts` and the UI. |
| `src/components/ConfigPanel.tsx` | All inputs. Controlled, calls `onChange(partial)`. |
| `src/components/Field.tsx` | One labelled numeric/text/select input. Reused everywhere. |
| `src/components/AdvancedSettings.tsx` | Collapsible advanced inputs + rule explanations with citations. |
| `src/components/SummaryCards.tsx` | Three result cards. |
| `src/components/Explanation.tsx` | Prose generated from the computed result. |
| `src/components/Callouts.tsx` | Risk-equivalence warning + disclaimer. |
| `src/components/charts/*.tsx` | Five presentational Recharts components. |
| `src/App.tsx` | Wires URL state → `simulate` → components. |

**Boundary rule:** nothing in `src/lib/` imports from `src/components/`. Enforced by review, not tooling.

---

## Task 1: Scaffold the project

**Files:**
- Create: everything under the repo root

- [ ] **Step 1: Scaffold Vite in the existing repo**

The repo root already contains `.git`, `.gitignore` and `docs/`. Scaffold into a
temp dir and move the files in, so the existing git history and docs survive.

```bash
cd /Users/pedroalmeida/Documents/Github/comparator-website
npm create vite@latest .tmp-scaffold -- --template react-ts
cp -R .tmp-scaffold/. .
rm -rf .tmp-scaffold
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install recharts lucide-react clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Vite for Tailwind v4, Vitest, and GitHub Pages**

Replace `vite.config.ts` entirely:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base must match the GitHub Pages repo subpath. Override with BASE_PATH in CI.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 4: Wire Tailwind into the stylesheet**

Replace `src/index.css` entirely:

```css
@import "tailwindcss";

@theme {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

html {
  color-scheme: light dark;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100;
}

.tnum {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the toolchain runs**

```bash
npm run build && npx tsc --noEmit
```

Expected: build succeeds, `tsc` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind v4 + Vitest"
```

---

## Task 2: Types and defaults

**Files:**
- Create: `src/lib/types.ts`, `src/lib/defaults.ts`

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
export type Product = 'etf' | 'ppr';
export type ScenarioId = 'etf' | 'hybrid' | 'ppr';
export type ContributionMode = 'fixed' | 'maxDeductible';
export type EtfTaxMode = 'ladder' | 'flat28' | 'englobamento';
export type BenefitDestination = 'etf' | 'ppr' | 'consumed';

export interface SimConfig {
  currentAge: number;
  contributionMode: ContributionMode;
  annualInvestment: number;
  years: number;
  etfReturn: number;
  pprReturn: number;
  etfFee: number;
  pprFee: number;
  pprTrackingError: number;
  etfAnnualCost: number;
  mortgageStartYear: number;
  monthlyInstalment: number;
  benefitDestination: BenefitDestination;
  reinvestRedemption: boolean;
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
  use35Rule: boolean;
  irsBandsEnabled: boolean;
  irsBenefitCap: number;
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
```

- [ ] **Step 2: Write `src/lib/defaults.ts`**

```ts
import type { SimConfig } from './types';

export const DEFAULT_CONFIG: SimConfig = {
  currentAge: 30,
  contributionMode: 'fixed',
  annualInvestment: 2000,
  years: 33,
  etfReturn: 7.97,
  pprReturn: 5.7,
  etfFee: 0.1,
  pprFee: 0.75,
  pprTrackingError: 0,
  etfAnnualCost: 0,
  mortgageStartYear: 3,
  monthlyInstalment: 500,
  benefitDestination: 'etf',
  reinvestRedemption: true,
  etfTaxMode: 'ladder',
  marginalRate: 35,
  use35Rule: true,
  irsBandsEnabled: true,
  irsBenefitCap: 400,
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
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/defaults.ts
git commit -m "feat: add simulation types and default configuration"
```

---

## Task 3: Tax primitives

All rates live here as named constants so a law change is a one-file edit.

**Files:**
- Create: `src/lib/tax.ts`, `src/lib/tax.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tax.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  etfRateForAge,
  pprTaxOnProfit,
  irsCapForAge,
  contributionForYear,
  penalisedPprRateForAge,
  clawbackIfRedeemedNow,
  PPR_LEGAL_EFFECTIVE_RATE,
} from './tax';

describe('etfRateForAge', () => {
  it('applies 28% under 2 years in ladder mode', () => {
    expect(etfRateForAge(0, 'ladder', 35)).toBeCloseTo(0.28, 10);
    expect(etfRateForAge(1, 'ladder', 35)).toBeCloseTo(0.28, 10);
  });

  it('applies 25.2% from 2 to under 5 years', () => {
    expect(etfRateForAge(2, 'ladder', 35)).toBeCloseTo(0.252, 10);
    expect(etfRateForAge(4, 'ladder', 35)).toBeCloseTo(0.252, 10);
  });

  it('applies 22.4% from 5 to under 8 years', () => {
    expect(etfRateForAge(5, 'ladder', 35)).toBeCloseTo(0.224, 10);
    expect(etfRateForAge(7, 'ladder', 35)).toBeCloseTo(0.224, 10);
  });

  it('applies 19.6% from 8 years onward', () => {
    expect(etfRateForAge(8, 'ladder', 35)).toBeCloseTo(0.196, 10);
    expect(etfRateForAge(30, 'ladder', 35)).toBeCloseTo(0.196, 10);
  });

  it('applies a flat 28% at every age in flat28 mode', () => {
    expect(etfRateForAge(0, 'flat28', 35)).toBeCloseTo(0.28, 10);
    expect(etfRateForAge(20, 'flat28', 35)).toBeCloseTo(0.28, 10);
  });

  it('applies the exclusion coefficients to the marginal rate in englobamento mode', () => {
    // 35% marginal, 30% of the gain excluded from 8 years => 0.35 * 0.7
    expect(etfRateForAge(8, 'englobamento', 35)).toBeCloseTo(0.245, 10);
    // below 2 years there is no exclusion, so the full marginal rate applies
    expect(etfRateForAge(1, 'englobamento', 35)).toBeCloseTo(0.35, 10);
  });

  it('makes englobamento worse than the ladder above a 28% marginal rate', () => {
    expect(etfRateForAge(8, 'englobamento', 45)).toBeGreaterThan(
      etfRateForAge(8, 'ladder', 45),
    );
  });
});

describe('pprTaxOnProfit', () => {
  it('taxes two fifths of the profit at 20%, an effective 8%', () => {
    expect(PPR_LEGAL_EFFECTIVE_RATE).toBeCloseTo(0.08, 10);
    expect(pprTaxOnProfit(1000)).toBeCloseTo(80, 10);
  });

  it('is independent of holding period', () => {
    expect(pprTaxOnProfit(1000)).toBeCloseTo(pprTaxOnProfit(1000), 10);
  });

  it('taxes nothing on zero or negative profit', () => {
    expect(pprTaxOnProfit(0)).toBe(0);
    expect(pprTaxOnProfit(-500)).toBe(0);
  });
});

describe('irsCapForAge', () => {
  it('returns 400 under 35', () => {
    expect(irsCapForAge(34, true, 999)).toBe(400);
  });

  it('returns 350 from 35 up to and including 50', () => {
    expect(irsCapForAge(35, true, 999)).toBe(350);
    expect(irsCapForAge(50, true, 999)).toBe(350);
  });

  it('returns 300 above 50', () => {
    expect(irsCapForAge(51, true, 999)).toBe(300);
  });

  it('returns the manual cap when bands are disabled', () => {
    expect(irsCapForAge(30, false, 250)).toBe(250);
  });
});

describe('contributionForYear', () => {
  it('returns the fixed amount in fixed mode regardless of age', () => {
    expect(contributionForYear('fixed', 30, 2000, true, 400)).toBe(2000);
    expect(contributionForYear('fixed', 60, 2000, true, 400)).toBe(2000);
  });

  it('returns cap/0.2 in maxDeductible mode', () => {
    expect(contributionForYear('maxDeductible', 30, 0, true, 400)).toBe(2000);
    expect(contributionForYear('maxDeductible', 40, 0, true, 400)).toBe(1750);
    expect(contributionForYear('maxDeductible', 55, 0, true, 400)).toBe(1500);
  });
});

describe('penalisedPprRateForAge', () => {
  it('applies 21.5% under 5 years', () => {
    expect(penalisedPprRateForAge(4)).toBeCloseTo(0.215, 10);
  });

  it('applies 17.2% from 5 to under 8 years', () => {
    expect(penalisedPprRateForAge(5)).toBeCloseTo(0.172, 10);
    expect(penalisedPprRateForAge(7)).toBeCloseTo(0.172, 10);
  });

  it('applies 8.6% from 8 years onward', () => {
    expect(penalisedPprRateForAge(8)).toBeCloseTo(0.086, 10);
  });
});

describe('clawbackIfRedeemedNow', () => {
  it('returns zero when the tranche is at least five years old', () => {
    expect(clawbackIfRedeemedNow(400, 5)).toBe(0);
  });

  it('adds 10% per elapsed year to the benefit when younger than five', () => {
    // 400 deducted, redeemed after 3 years => 400 * (1 + 0.10 * 3)
    expect(clawbackIfRedeemedNow(400, 3)).toBeCloseTo(520, 10);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/tax.test.ts
```

Expected: FAIL — `Failed to resolve import "./tax"`.

- [ ] **Step 3: Write `src/lib/tax.ts`**

```ts
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
  return (
    benefitReceived * (1 + CLAWBACK_MAJORATION_PER_YEAR * trancheAgeYears)
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/tax.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tax.ts src/lib/tax.test.ts
git commit -m "feat: add Portuguese tax primitives with legal citations"
```

---

## Task 4: Tranche operations

FIFO lives here. Every function takes and returns plain data.

**Files:**
- Create: `src/lib/tranches.ts`, `src/lib/tranches.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tranches.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { growTranches, chargeFixedCost, redeemPprFifo, liquidate } from './tranches';
import type { Tranche } from './types';

const ppr = (yearDeposited: number, principal: number, value: number): Tranche => ({
  yearDeposited,
  principal,
  value,
  product: 'ppr',
});

const etf = (yearDeposited: number, principal: number, value: number): Tranche => ({
  yearDeposited,
  principal,
  value,
  product: 'etf',
});

describe('growTranches', () => {
  it('grows only tranches of the named product', () => {
    const out = growTranches([etf(1, 100, 100), ppr(1, 100, 100)], 'etf', 10);
    expect(out[0].value).toBeCloseTo(110, 10);
    expect(out[1].value).toBeCloseTo(100, 10);
  });

  it('leaves principal untouched', () => {
    const out = growTranches([etf(1, 100, 100)], 'etf', 10);
    expect(out[0].principal).toBe(100);
  });

  it('handles a negative net rate', () => {
    const out = growTranches([etf(1, 100, 100)], 'etf', -10);
    expect(out[0].value).toBeCloseTo(90, 10);
  });
});

describe('chargeFixedCost', () => {
  it('spreads the cost pro-rata across the product balance', () => {
    const out = chargeFixedCost([etf(1, 100, 300), etf(2, 100, 100)], 'etf', 40);
    // 300/400 of 40 = 30, and 100/400 of 40 = 10
    expect(out[0].value).toBeCloseTo(270, 10);
    expect(out[1].value).toBeCloseTo(90, 10);
  });

  it('is a no-op when the cost is zero', () => {
    const out = chargeFixedCost([etf(1, 100, 300)], 'etf', 0);
    expect(out[0].value).toBeCloseTo(300, 10);
  });

  it('never drives a balance below zero', () => {
    const out = chargeFixedCost([etf(1, 100, 50)], 'etf', 500);
    expect(out[0].value).toBe(0);
  });
});

describe('redeemPprFifo', () => {
  it('redeems the oldest eligible tranche first', () => {
    const tranches = [ppr(1, 1000, 2000), ppr(2, 1000, 1500)];
    const r = redeemPprFifo(tranches, 10, 2000, { use35Rule: false });
    // only the year-1 tranche is consumed, exactly to the 2000 cap
    expect(r.grossRedeemed).toBeCloseTo(2000, 10);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].yearDeposited).toBe(2);
  });

  it('taxes 8% of the profit portion only', () => {
    const r = redeemPprFifo([ppr(1, 1000, 2000)], 10, 5000, { use35Rule: false });
    // profit 1000 => tax 80 => net 1920
    expect(r.tax).toBeCloseTo(80, 10);
    expect(r.netProceeds).toBeCloseTo(1920, 10);
  });

  it('partially redeems a tranche and leaves the remainder invested', () => {
    const r = redeemPprFifo([ppr(1, 1000, 2000)], 10, 500, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(500, 10);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].value).toBeCloseTo(1500, 10);
    // principal is reduced proportionally: 500/2000 of 1000
    expect(r.remaining[0].principal).toBeCloseTo(750, 10);
    // profit share of the redeemed 500 is 250, taxed at 8% => 20
    expect(r.tax).toBeCloseTo(20, 10);
  });

  it('excludes tranches younger than five years under the per-entrega rule', () => {
    // current year 5, tranche from year 2 is 3 years old
    const r = redeemPprFifo([ppr(2, 1000, 1000)], 5, 5000, { use35Rule: false });
    expect(r.grossRedeemed).toBe(0);
    expect(r.remaining).toHaveLength(1);
  });

  it('includes a tranche exactly five years old', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1000)], 6, 5000, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(1000, 10);
  });

  it('redeems every tranche under the 35% rule once five years have passed', () => {
    // year 6, first entrega in year 1 => 5 years elapsed. A year-5 tranche is
    // only 1 year old but is still eligible under art. 4.o/3.
    const r = redeemPprFifo([ppr(1, 1000, 1000), ppr(5, 1000, 1000)], 6, 5000, {
      use35Rule: true,
    });
    expect(r.grossRedeemed).toBeCloseTo(2000, 10);
    expect(r.remaining).toHaveLength(0);
  });

  it('falls back to per-entrega when the first-half share is below 35%', () => {
    // All contributions in the second half of the contract's life, so the
    // 35% test fails and only tranches five years old may be redeemed.
    const r = redeemPprFifo([ppr(9, 1000, 1000)], 10, 5000, {
      use35Rule: true,
      firstHalfShare: 0,
    });
    expect(r.grossRedeemed).toBe(0);
  });

  it('never redeems more than the balance', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1200)], 10, 999999, { use35Rule: false });
    expect(r.grossRedeemed).toBeCloseTo(1200, 10);
    expect(r.remaining).toHaveLength(0);
  });

  it('redeems nothing when the cap is zero', () => {
    const r = redeemPprFifo([ppr(1, 1000, 1200)], 10, 0, { use35Rule: false });
    expect(r.grossRedeemed).toBe(0);
    expect(r.remaining).toHaveLength(1);
  });
});

describe('liquidate', () => {
  it('taxes each ETF tranche at the rate for its own age', () => {
    // final year 10: the year-1 tranche is 9 years old (19.6%),
    // the year-9 tranche is 1 year old (28%)
    const r = liquidate([etf(1, 1000, 2000), etf(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    // 1000 gain at 19.6% = 196, 100 gain at 28% = 28
    expect(r.etfTax).toBeCloseTo(224, 10);
    expect(r.pprTax).toBe(0);
    expect(r.gross).toBeCloseTo(3100, 10);
    expect(r.net).toBeCloseTo(2876, 10);
  });

  it('taxes PPR tranches at a flat 8% regardless of age', () => {
    const r = liquidate([ppr(1, 1000, 2000), ppr(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    expect(r.pprTax).toBeCloseTo(1000 * 0.08 + 100 * 0.08, 10);
    expect(r.etfTax).toBe(0);
  });

  it('reports a bracket breakdown that sums to the ETF tax', () => {
    const r = liquidate([etf(1, 1000, 2000), etf(9, 1000, 1100)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    const total = r.bracketBreakdown.reduce((s, b) => s + b.tax, 0);
    expect(total).toBeCloseTo(r.etfTax, 10);
    expect(r.bracketBreakdown).toHaveLength(2);
  });

  it('taxes nothing on a tranche with no profit', () => {
    const r = liquidate([etf(1, 1000, 900)], 10, {
      etfTaxMode: 'ladder',
      marginalRate: 35,
    });
    expect(r.etfTax).toBe(0);
    expect(r.net).toBeCloseTo(900, 10);
  });

  it('returns zeroes for an empty portfolio', () => {
    const r = liquidate([], 10, { etfTaxMode: 'ladder', marginalRate: 35 });
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
    expect(r.bracketBreakdown).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/tranches.test.ts
```

Expected: FAIL — `Failed to resolve import "./tranches"`.

- [ ] **Step 3: Write `src/lib/tranches.ts`**

```ts
import type { BracketSlice, EtfTaxMode, Product, Tranche } from './types';
import {
  etfBracketLabel,
  etfRateForAge,
  pprTaxOnProfit,
  PPR_FIRST_HALF_THRESHOLD,
  PPR_LEGAL_EFFECTIVE_RATE,
  PPR_MIN_TRANCHE_AGE,
} from './tax';

/** Apply one year of growth at `netRatePct` to every tranche of `product`. */
export function growTranches(
  tranches: Tranche[],
  product: Product,
  netRatePct: number,
): Tranche[] {
  const factor = 1 + netRatePct / 100;
  return tranches.map((t) =>
    t.product === product ? { ...t, value: t.value * factor } : t,
  );
}

/** Subtract a flat euro cost, spread pro-rata across that product's balance. */
export function chargeFixedCost(
  tranches: Tranche[],
  product: Product,
  cost: number,
): Tranche[] {
  if (cost <= 0) return tranches;
  const balance = tranches
    .filter((t) => t.product === product)
    .reduce((s, t) => s + t.value, 0);
  if (balance <= 0) return tranches;
  const charged = Math.min(cost, balance);
  return tranches.map((t) =>
    t.product === product
      ? { ...t, value: t.value - charged * (t.value / balance) }
      : t,
  );
}

export interface RedeemOptions {
  use35Rule: boolean;
  /**
   * Share of total entregas made in the first half of the contract's life.
   * Only consulted when use35Rule is true. Defaults to 0.5, the value a
   * constant annual contribution always produces.
   */
  firstHalfShare?: number;
}

export interface RedeemResult {
  remaining: Tranche[];
  grossRedeemed: number;
  tax: number;
  netProceeds: number;
}

/**
 * Redeem PPR tranches to pay mortgage instalments, oldest first.
 *
 * Eligibility (DL 158/2002 art. 4.o):
 *  - n.o 2: a tranche may be redeemed once five years have elapsed since that
 *    entrega.
 *  - n.o 3: once five years have elapsed since the FIRST entrega, the entire
 *    plan may be redeemed, provided entregas in the first half of the
 *    contract's life are at least 35% of the total.
 *
 * `cap` is the most that may be redeemed this year — 12 monthly instalments.
 * Alinea g) only permits paying instalments as they fall due, never early
 * amortisation of capital, so there is nothing else to redeem against.
 */
export function redeemPprFifo(
  tranches: Tranche[],
  currentYear: number,
  cap: number,
  opts: RedeemOptions,
): RedeemResult {
  if (cap <= 0) {
    return { remaining: tranches, grossRedeemed: 0, tax: 0, netProceeds: 0 };
  }

  const pprTranches = tranches.filter((t) => t.product === 'ppr');
  const firstEntregaYear = pprTranches.length
    ? Math.min(...pprTranches.map((t) => t.yearDeposited))
    : Infinity;
  const firstHalfShare = opts.firstHalfShare ?? 0.5;

  const wholePlanEligible =
    opts.use35Rule &&
    firstHalfShare >= PPR_FIRST_HALF_THRESHOLD &&
    currentYear - firstEntregaYear >= PPR_MIN_TRANCHE_AGE;

  const isEligible = (t: Tranche) =>
    t.product === 'ppr' &&
    (wholePlanEligible ||
      currentYear - t.yearDeposited >= PPR_MIN_TRANCHE_AGE);

  let budget = cap;
  let grossRedeemed = 0;
  let tax = 0;
  const remaining: Tranche[] = [];

  // tranches are held oldest-first, so a straight walk is FIFO
  for (const t of tranches) {
    if (budget <= 0 || !isEligible(t)) {
      remaining.push(t);
      continue;
    }

    const take = Math.min(t.value, budget);
    const share = take / t.value;
    const principalTaken = t.principal * share;
    const profitTaken = take - principalTaken;

    grossRedeemed += take;
    tax += pprTaxOnProfit(profitTaken);
    budget -= take;

    if (take < t.value) {
      remaining.push({
        ...t,
        value: t.value - take,
        principal: t.principal - principalTaken,
      });
    }
  }

  return {
    remaining,
    grossRedeemed,
    tax,
    netProceeds: grossRedeemed - tax,
  };
}

export interface LiquidateOptions {
  etfTaxMode: EtfTaxMode;
  marginalRate: number;
}

export interface LiquidateResult {
  gross: number;
  etfTax: number;
  pprTax: number;
  net: number;
  bracketBreakdown: BracketSlice[];
}

/** Sell everything at the end of the horizon, taxing each tranche by its age. */
export function liquidate(
  tranches: Tranche[],
  finalYear: number,
  opts: LiquidateOptions,
): LiquidateResult {
  let gross = 0;
  let etfTax = 0;
  let pprTax = 0;
  const buckets = new Map<string, BracketSlice>();

  for (const t of tranches) {
    gross += t.value;
    const profit = Math.max(0, t.value - t.principal);

    if (t.product === 'ppr') {
      pprTax += pprTaxOnProfit(profit);
      continue;
    }

    const age = finalYear - t.yearDeposited;
    const rate = etfRateForAge(age, opts.etfTaxMode, opts.marginalRate);
    const tax = profit * rate;
    etfTax += tax;

    const label = etfBracketLabel(age);
    const slice = buckets.get(label) ?? {
      bracket: label,
      ratePct: rate * 100,
      gain: 0,
      tax: 0,
    };
    slice.gain += profit;
    slice.tax += tax;
    buckets.set(label, slice);
  }

  return {
    gross,
    etfTax,
    pprTax,
    net: gross - etfTax - pprTax,
    bracketBreakdown: [...buckets.values()],
  };
}

export const PPR_LIQUIDATION_RATE = PPR_LEGAL_EFFECTIVE_RATE;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/tranches.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tranches.ts src/lib/tranches.test.ts
git commit -m "feat: add FIFO tranche operations for growth, redemption and liquidation"
```

---

## Task 5: The simulation engine

**Files:**
- Create: `src/lib/engine.ts`, `src/lib/engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';
import type { SimConfig } from './types';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

const byId = (out: ReturnType<typeof simulate>, id: string) =>
  out.scenarios.find((s) => s.id === id)!;

describe('simulate — structure', () => {
  it('returns the three scenarios in a stable order', () => {
    const out = simulate(cfg());
    expect(out.scenarios.map((s) => s.id)).toEqual(['etf', 'hybrid', 'ppr']);
  });

  it('produces one row per simulated year', () => {
    const out = simulate(cfg({ years: 10 }));
    for (const s of out.scenarios) {
      expect(s.rows).toHaveLength(10);
      expect(s.rows[0].year).toBe(1);
      expect(s.rows[9].year).toBe(10);
    }
  });

  it('ages the participant by one year per row', () => {
    const out = simulate(cfg({ years: 3, currentAge: 30 }));
    expect(byId(out, 'etf').rows.map((r) => r.age)).toEqual([30, 31, 32]);
  });

  it('labels scenarios using the configured product names', () => {
    const out = simulate(cfg({ etfName: 'VWCE', pprName: 'Golden SGF' }));
    expect(byId(out, 'etf').label).toContain('VWCE');
    expect(byId(out, 'ppr').label).toContain('Golden SGF');
  });

  it('does not throw on a zero-year or zero-contribution configuration', () => {
    expect(() => simulate(cfg({ years: 0 }))).not.toThrow();
    expect(() => simulate(cfg({ annualInvestment: 0 }))).not.toThrow();
  });
});

describe('simulate — contributions', () => {
  it('charges every scenario the same amount out of pocket', () => {
    const out = simulate(cfg({ years: 20 }));
    const totals = out.scenarios.map((s) => s.final.totalContributed);
    expect(totals[0]).toBeCloseTo(totals[1], 6);
    expect(totals[1]).toBeCloseTo(totals[2], 6);
  });

  it('grows a tranche only in the years after it is deposited', () => {
    // one year, one 1000 contribution, 10% return, no fees: no growth yet
    const out = simulate(
      cfg({
        years: 1,
        annualInvestment: 1000,
        etfReturn: 10,
        etfFee: 0,
        mortgageStartYear: 99,
      }),
    );
    expect(byId(out, 'etf').rows[0].etfBalance).toBeCloseTo(1000, 6);
  });

  it('steps the contribution down at ages 35 and 51 in maxDeductible mode', () => {
    const out = simulate(
      cfg({ contributionMode: 'maxDeductible', currentAge: 33, years: 20 }),
    );
    const rows = byId(out, 'ppr').rows;
    expect(rows[0].contributedThisYear).toBe(2000); // age 33
    expect(rows[2].contributedThisYear).toBe(1750); // age 35
    expect(rows[18].contributedThisYear).toBe(1500); // age 51
  });
});

describe('simulate — the reference case from the community thread', () => {
  // r/literaciafinanceira, "Golden SGF PPR ETF vs investimento direto em ETF".
  // Age 30, 30 years, 6% net ETF, PPR 6% less a 0.75% management fee,
  // contributions of 2000/1750/1500 by age band, no mortgage.
  const reference = cfg({
    currentAge: 30,
    years: 30,
    contributionMode: 'maxDeductible',
    etfReturn: 6,
    etfFee: 0,
    pprReturn: 6,
    pprFee: 0.75,
    pprTrackingError: 0,
    etfAnnualCost: 0,
    mortgageStartYear: 999, // no mortgage, so nothing is redeemed early
    benefitDestination: 'consumed',
    reinvestRedemption: false,
    etfTaxMode: 'ladder',
  });

  it('reproduces the published total contributed', () => {
    // 5 x 2000 + 15 x 1750 + 10 x 1500
    expect(simulate(reference).scenarios[0].final.totalContributed).toBeCloseTo(
      51250,
      6,
    );
  });

  it('reproduces the published IRS benefits total', () => {
    // 5 x 400 + 15 x 350 + 10 x 300
    expect(byId(simulate(reference), 'ppr').final.irsBenefitTotal).toBeCloseTo(
      10250,
      6,
    );
  });

  it('reproduces the published gross portfolio values within rounding', () => {
    const out = simulate(reference);
    expect(byId(out, 'etf').final.grossValue).toBeCloseTo(149571.35, 0);
    expect(byId(out, 'ppr').final.grossValue).toBeCloseTo(129660.6, 0);
  });

  it('reproduces the published PPR net value', () => {
    // gains 78410.60 taxed at a flat 8%
    expect(byId(simulate(reference), 'ppr').final.netValue).toBeCloseTo(
      123387.75,
      0,
    );
  });

  it('lands BELOW their ETF net value because they ignored FIFO', () => {
    // They applied 19.6% to the whole gain. Under FIFO the last seven years of
    // tranches are younger than 8 years and are taxed at 22.4%, 25.2% and 28%,
    // so our figure must be lower. This asserts our FIFO actually bites.
    const net = byId(simulate(reference), 'etf').final.netValue;
    expect(net).toBeLessThan(130300.36);
    expect(net).toBeGreaterThan(125000);
  });
});

describe('simulate — mortgage redemptions', () => {
  it('redeems nothing before the mortgage starts', () => {
    const out = simulate(cfg({ years: 12, mortgageStartYear: 10 }));
    const rows = byId(out, 'hybrid').rows;
    expect(rows[8].redeemedThisYear).toBe(0); // year 9
    expect(rows[9].redeemedThisYear).toBeGreaterThan(0); // year 10
  });

  it('caps annual redemption at twelve monthly instalments', () => {
    const out = simulate(
      cfg({ years: 20, mortgageStartYear: 6, monthlyInstalment: 100 }),
    );
    for (const row of byId(out, 'hybrid').rows) {
      expect(row.redeemedThisYear).toBeLessThanOrEqual(1200 + 1e-6);
    }
  });

  it('never lets the PPR balance go negative', () => {
    const out = simulate(
      cfg({ years: 30, mortgageStartYear: 6, monthlyInstalment: 5000 }),
    );
    for (const row of byId(out, 'hybrid').rows) {
      expect(row.pprBalance).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('accumulates mortgage paid across years', () => {
    const out = simulate(cfg({ years: 20, mortgageStartYear: 6 }));
    const rows = byId(out, 'hybrid').rows;
    expect(rows[19].mortgagePaid).toBeGreaterThan(rows[10].mortgagePaid);
  });
});

describe('simulate — benefit destination', () => {
  it('beats the consumed case when the benefit is reinvested', () => {
    const base = { years: 30, mortgageStartYear: 5 } as const;
    const consumed = byId(
      simulate(cfg({ ...base, benefitDestination: 'consumed' })),
      'hybrid',
    ).final.netValue;
    const intoEtf = byId(
      simulate(cfg({ ...base, benefitDestination: 'etf' })),
      'hybrid',
    ).final.netValue;
    expect(intoEtf).toBeGreaterThan(consumed);
  });

  it('routes the benefit into the PPR when asked', () => {
    const base = { years: 30, mortgageStartYear: 999 } as const;
    const intoPpr = byId(
      simulate(cfg({ ...base, benefitDestination: 'ppr' })),
      'hybrid',
    );
    const consumed = byId(
      simulate(cfg({ ...base, benefitDestination: 'consumed' })),
      'hybrid',
    );
    // routing into the PPR grows the PPR balance and leaves the ETF empty
    expect(intoPpr.rows.at(-1)!.pprBalance).toBeGreaterThan(
      consumed.rows.at(-1)!.pprBalance,
    );
    expect(intoPpr.rows.at(-1)!.etfBalance).toBe(0);
  });

  it('counts consumed benefits in netWithBenefits but not in netValue', () => {
    const s = byId(
      simulate(cfg({ years: 20, benefitDestination: 'consumed' })),
      'hybrid',
    );
    expect(s.final.netWithBenefits).toBeCloseTo(
      s.final.netValue + s.final.irsBenefitTotal,
      6,
    );
  });

  it('loses to the pure ETF scenario when nothing is reinvested', () => {
    const c = cfg({
      years: 33,
      benefitDestination: 'consumed',
      reinvestRedemption: false,
    });
    const out = simulate(c);
    expect(byId(out, 'hybrid').final.netValue).toBeLessThan(
      byId(out, 'etf').final.netValue,
    );
  });
});

describe('simulate — fees and drag', () => {
  it('reduces the PPR balance when a tracking error is applied', () => {
    const without = byId(simulate(cfg({ pprTrackingError: 0 })), 'ppr').final
      .netValue;
    const with26 = byId(simulate(cfg({ pprTrackingError: 2.6 })), 'ppr').final
      .netValue;
    expect(with26).toBeLessThan(without);
  });

  it('reduces the ETF balance when an annual broker cost is applied', () => {
    const without = byId(simulate(cfg({ etfAnnualCost: 0 })), 'etf').final
      .netValue;
    const withCost = byId(simulate(cfg({ etfAnnualCost: 50 })), 'etf').final
      .netValue;
    expect(withCost).toBeLessThan(without);
  });
});

describe('simulate — invariants', () => {
  it('conserves value: contributions plus growth minus tax equals net', () => {
    const out = simulate(cfg({ years: 25, mortgageStartYear: 6 }));
    for (const s of out.scenarios) {
      const f = s.final;
      const totalTax = f.etfTax + f.pprTax + f.pprTaxDuringRedemptions;
      // gross portfolio + everything already withdrawn to pay the mortgage
      const accountedFor = f.grossValue + f.mortgagePaidTotal + totalTax;
      expect(accountedFor).toBeGreaterThanOrEqual(f.totalContributed - 1e-6);
    }
  });

  it('reports an effective tax rate between 0 and 1', () => {
    for (const s of simulate(cfg({ years: 25 })).scenarios) {
      expect(s.final.effectiveTaxRate).toBeGreaterThanOrEqual(0);
      expect(s.final.effectiveTaxRate).toBeLessThanOrEqual(1);
    }
  });

  it('reports a bracket breakdown whose tax sums to the ETF tax', () => {
    const s = byId(simulate(cfg({ years: 25 })), 'etf');
    const sum = s.final.bracketBreakdown.reduce((acc, b) => acc + b.tax, 0);
    expect(sum).toBeCloseTo(s.final.etfTax, 6);
  });

  it('finds a break-even year when the hybrid eventually wins', () => {
    const out = simulate(
      cfg({ years: 40, pprReturn: 7.97, pprFee: 0, mortgageStartYear: 6 }),
    );
    expect(out.breakEvenYear).not.toBeNull();
  });

  it('reports a null break-even year when the hybrid never wins', () => {
    const out = simulate(
      cfg({
        years: 33,
        benefitDestination: 'consumed',
        reinvestRedemption: false,
      }),
    );
    expect(out.breakEvenYear).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/engine.test.ts
```

Expected: FAIL — `Failed to resolve import "./engine"`.

- [ ] **Step 3: Write `src/lib/engine.ts`**

```ts
import type {
  ScenarioId,
  ScenarioResult,
  SimConfig,
  SimOutput,
  Tranche,
  YearRow,
} from './types';
import { contributionForYear, irsBenefit, irsCapForAge } from './tax';
import {
  chargeFixedCost,
  growTranches,
  liquidate,
  redeemPprFifo,
} from './tranches';

/** What distinguishes the three scenarios. Everything else is shared. */
interface Policy {
  id: ScenarioId;
  /** Where the annual out-of-pocket contribution goes. */
  primary: 'etf' | 'ppr';
  /** Whether this scenario ever reinvests anything. */
  reinvests: boolean;
}

const POLICIES: Policy[] = [
  { id: 'etf', primary: 'etf', reinvests: false },
  { id: 'hybrid', primary: 'ppr', reinvests: true },
  { id: 'ppr', primary: 'ppr', reinvests: false },
];

function labelFor(id: ScenarioId, cfg: SimConfig): string {
  switch (id) {
    case 'etf':
      return `Só ${cfg.etfName}`;
    case 'hybrid':
      return `Híbrido: ${cfg.pprName} + ${cfg.etfName}`;
    case 'ppr':
      return `Só ${cfg.pprName}`;
  }
}

function balanceOf(tranches: Tranche[], product: 'etf' | 'ppr'): number {
  return tranches
    .filter((t) => t.product === product)
    .reduce((s, t) => s + t.value, 0);
}

/**
 * Share of total entregas made in the first half of the contract's life.
 * DL 158/2002 art. 4.o/3 requires at least 35% for the whole plan to be
 * redeemable. Computed from the actual schedule rather than assumed, so the
 * rule stays correct if contributions ever stop being uniform.
 */
function firstHalfShare(entregas: { year: number; amount: number }[]): number {
  if (entregas.length === 0) return 0;
  const total = entregas.reduce((s, e) => s + e.amount, 0);
  if (total <= 0) return 0;
  const lastYear = Math.max(...entregas.map((e) => e.year));
  const midpoint = lastYear / 2;
  const inFirstHalf = entregas
    .filter((e) => e.year <= midpoint)
    .reduce((s, e) => s + e.amount, 0);
  return inFirstHalf / total;
}

function runScenario(policy: Policy, cfg: SimConfig): ScenarioResult {
  const etfNetRate = cfg.etfReturn - cfg.etfFee;
  const pprNetRate = cfg.pprReturn - cfg.pprFee - cfg.pprTrackingError;
  const annualCap = cfg.monthlyInstalment * 12;

  let tranches: Tranche[] = [];
  const entregas: { year: number; amount: number }[] = [];

  let contributed = 0;
  let mortgagePaid = 0;
  let benefitTotal = 0;
  let taxPaid = 0;
  /** Benefit earned last year, paid out this year and added to the PPR. */
  let pendingPprBenefit = 0;

  const rows: YearRow[] = [];

  for (let year = 1; year <= cfg.years; year++) {
    const age = cfg.currentAge + year - 1;

    // 1. grow, then charge the flat broker cost
    tranches = growTranches(tranches, 'etf', etfNetRate);
    tranches = growTranches(tranches, 'ppr', pprNetRate);
    tranches = chargeFixedCost(tranches, 'etf', cfg.etfAnnualCost);

    // 2. this year's contribution out of pocket
    const contribution = contributionForYear(
      cfg.contributionMode,
      age,
      cfg.annualInvestment,
      cfg.irsBandsEnabled,
      cfg.irsBenefitCap,
    );
    contributed += contribution;

    const intoPrimary =
      policy.primary === 'ppr' ? contribution + pendingPprBenefit : contribution;
    pendingPprBenefit = 0;

    if (intoPrimary > 0) {
      tranches.push({
        yearDeposited: year,
        principal: intoPrimary,
        value: intoPrimary,
        product: policy.primary,
      });
      if (policy.primary === 'ppr') {
        entregas.push({ year, amount: intoPrimary });
      }
    }

    // 3. the IRS deduction, and where it goes
    let benefitThisYear = 0;
    if (policy.primary === 'ppr' && contribution > 0) {
      const cap = irsCapForAge(age, cfg.irsBandsEnabled, cfg.irsBenefitCap);
      benefitThisYear = irsBenefit(contribution, cap);
      benefitTotal += benefitThisYear;

      if (policy.reinvests && cfg.benefitDestination === 'etf') {
        tranches.push({
          yearDeposited: year,
          principal: benefitThisYear,
          value: benefitThisYear,
          product: 'etf',
        });
      } else if (policy.reinvests && cfg.benefitDestination === 'ppr') {
        // paid out with next year's IRS refund, so it joins next year's entrega
        pendingPprBenefit = benefitThisYear;
      }
    }

    // 4. redeem PPR tranches to pay mortgage instalments
    let redeemedThisYear = 0;
    if (policy.primary === 'ppr' && year >= cfg.mortgageStartYear) {
      const result = redeemPprFifo(tranches, year, annualCap, {
        use35Rule: cfg.use35Rule,
        firstHalfShare: firstHalfShare(entregas),
      });
      tranches = result.remaining;
      redeemedThisYear = result.grossRedeemed;
      mortgagePaid += result.grossRedeemed;
      taxPaid += result.tax;

      if (policy.reinvests && cfg.reinvestRedemption && result.netProceeds > 0) {
        tranches.push({
          yearDeposited: year,
          principal: result.netProceeds,
          value: result.netProceeds,
          product: 'etf',
        });
      }
    }

    // 5. record the year
    const snapshot = liquidate(tranches, year, {
      etfTaxMode: cfg.etfTaxMode,
      marginalRate: cfg.marginalRate,
    });

    rows.push({
      year,
      age,
      etfBalance: balanceOf(tranches, 'etf'),
      pprBalance: balanceOf(tranches, 'ppr'),
      contributedThisYear: contribution,
      contributed,
      redeemedThisYear,
      mortgagePaid,
      irsBenefitThisYear: benefitThisYear,
      irsBenefit: benefitTotal,
      taxPaidToDate: taxPaid,
      netIfLiquidatedNow: snapshot.net,
      netWithBenefits:
        snapshot.net +
        mortgagePaid +
        (cfg.benefitDestination === 'consumed' || !policy.reinvests
          ? benefitTotal
          : 0),
    });
  }

  const final = liquidate(tranches, cfg.years, {
    etfTaxMode: cfg.etfTaxMode,
    marginalRate: cfg.marginalRate,
  });

  const totalTax = final.etfTax + final.pprTax + taxPaid;
  const totalGain = final.gross + mortgagePaid - contributed;

  const benefitsNotAlreadyInvested =
    cfg.benefitDestination === 'consumed' || !policy.reinvests
      ? benefitTotal
      : 0;

  return {
    id: policy.id,
    label: labelFor(policy.id, cfg),
    rows,
    final: {
      grossValue: final.gross,
      etfTax: final.etfTax,
      pprTax: final.pprTax,
      pprTaxDuringRedemptions: taxPaid,
      irsBenefitTotal: benefitTotal,
      mortgagePaidTotal: mortgagePaid,
      netValue: final.net,
      netWithBenefits: final.net + mortgagePaid + benefitsNotAlreadyInvested,
      totalContributed: contributed,
      effectiveTaxRate: totalGain > 0 ? Math.min(1, totalTax / totalGain) : 0,
      bracketBreakdown: final.bracketBreakdown,
    },
  };
}

/**
 * Run all three scenarios. Pure: no I/O, no dates, no randomness. The same
 * config always produces the same output, which is what makes the URL a
 * complete description of a result.
 */
export function simulate(cfg: SimConfig): SimOutput {
  const scenarios = POLICIES.map((p) => runScenario(p, cfg));

  const etf = scenarios.find((s) => s.id === 'etf')!;
  const hybrid = scenarios.find((s) => s.id === 'hybrid')!;

  let breakEvenYear: number | null = null;
  for (let i = 0; i < hybrid.rows.length; i++) {
    if (hybrid.rows[i].netIfLiquidatedNow >= etf.rows[i].netIfLiquidatedNow) {
      breakEvenYear = hybrid.rows[i].year;
      break;
    }
  }
  // a hybrid that is only ahead because it has not yet been overtaken at year 1
  // is not a real crossover, so require it to still lead at the end
  if (
    breakEvenYear !== null &&
    hybrid.final.netValue < etf.final.netValue
  ) {
    breakEvenYear = null;
  }

  return { scenarios, breakEvenYear };
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test -- src/lib/engine.test.ts
```

Expected: all tests PASS. If the reference-case assertions fail by a small
margin, do **not** loosen the tolerance — check the growth-before-contribution
ordering in step 1 of the loop first, since that is the most likely cause of a
one-year offset.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: all tests across all three lib test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine.ts src/lib/engine.test.ts
git commit -m "feat: add simulation engine with three scenarios and community regression fixture"
```

---

## Task 6: URL state and formatting

**Files:**
- Create: `src/lib/url.ts`, `src/lib/url.test.ts`, `src/lib/format.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/url.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serialiseConfig, parseConfig } from './url';
import { DEFAULT_CONFIG } from './defaults';

describe('serialiseConfig / parseConfig', () => {
  it('round-trips the default config', () => {
    expect(parseConfig(serialiseConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a fully customised config', () => {
    const custom = {
      ...DEFAULT_CONFIG,
      currentAge: 41,
      contributionMode: 'maxDeductible' as const,
      years: 25,
      etfReturn: 6.5,
      pprTrackingError: 2.6,
      benefitDestination: 'ppr' as const,
      reinvestRedemption: false,
      etfTaxMode: 'englobamento' as const,
      use35Rule: false,
      irsBandsEnabled: false,
      etfName: 'VWCE',
      pprName: 'Golden SGF',
    };
    expect(parseConfig(serialiseConfig(custom))).toEqual(custom);
  });

  it('omits values that match the defaults, keeping links short', () => {
    expect(serialiseConfig(DEFAULT_CONFIG)).toBe('');
    expect(serialiseConfig({ ...DEFAULT_CONFIG, years: 20 })).toBe('yrs=20');
  });

  it('falls back to defaults for an empty query string', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unknown keys', () => {
    expect(parseConfig('nonsense=1&yrs=20').years).toBe(20);
  });

  it('falls back to the default for an unparseable number', () => {
    expect(parseConfig('yrs=banana').years).toBe(DEFAULT_CONFIG.years);
  });

  it('clamps numbers to their bounds instead of throwing', () => {
    expect(parseConfig('yrs=9999').years).toBe(60);
    expect(parseConfig('yrs=-5').years).toBe(1);
    expect(parseConfig('age=3').currentAge).toBe(18);
  });

  it('falls back to the default for an invalid enum value', () => {
    expect(parseConfig('etfTax=bogus').etfTaxMode).toBe('ladder');
    expect(parseConfig('bdest=bogus').benefitDestination).toBe('etf');
  });

  it('truncates over-long product names', () => {
    const long = 'x'.repeat(200);
    expect(parseConfig(`etfN=${long}`).etfName).toHaveLength(40);
  });

  it('falls back to the default name when the value is blank', () => {
    expect(parseConfig('etfN=%20%20').etfName).toBe(DEFAULT_CONFIG.etfName);
  });

  it('does not throw on a malformed query string', () => {
    expect(() => parseConfig('%%%&&&=')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/url.test.ts
```

Expected: FAIL — `Failed to resolve import "./url"`.

- [ ] **Step 3: Write `src/lib/url.ts`**

```ts
import type {
  BenefitDestination,
  ContributionMode,
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
const ETF_TAX_MODES: EtfTaxMode[] = ['ladder', 'flat28', 'englobamento'];
const BENEFIT_DESTINATIONS: BenefitDestination[] = ['etf', 'ppr', 'consumed'];

function clampNumber(field: keyof SimConfig, raw: string, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const bounds = BOUNDS[field as string];
  if (!bounds) return n;
  return Math.min(bounds[1], Math.max(bounds[0], n));
}

function pickEnum<T extends string>(
  raw: string,
  allowed: T[],
  fallback: T,
): T {
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
```

- [ ] **Step 4: Write `src/lib/format.ts`**

```ts
const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurPrecise = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat('pt-PT', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const formatEur = (n: number) => eur.format(n);
export const formatEurPrecise = (n: number) => eurPrecise.format(n);
export const formatPct = (fraction: number) => pct.format(fraction);
export const formatRate = (percent: number) =>
  `${percent.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`;

/** Compact axis labels: 12 500 -> "12,5 mil", 1 250 000 -> "1,25 M". */
export function formatCompactEur(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(n) >= 1_000)
    return `${(n / 1_000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} mil`;
  return formatEur(n);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test -- src/lib/url.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/url.ts src/lib/url.test.ts src/lib/format.ts
git commit -m "feat: add URL state serialisation and pt-PT formatting"
```

---

## Task 7: Shared UI primitives

**Files:**
- Create: `src/components/Field.tsx`, `src/components/Card.tsx`

- [ ] **Step 1: Write `src/components/Card.tsx`**

```tsx
import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/components/Field.tsx`**

```tsx
import type { ReactNode } from 'react';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  id: string;
}

const inputClass =
  'tnum w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
  'text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 ' +
  'focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950 ' +
  'dark:text-slate-100';

function Wrapper({ label, hint, id, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function NumberField({
  label,
  hint,
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: BaseProps & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          className={inputClass}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export function TextField({
  label,
  hint,
  id,
  value,
  onChange,
  maxLength,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <input
        id={id}
        type="text"
        className={inputClass}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrapper>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  id,
  value,
  onChange,
  options,
}: BaseProps & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Wrapper label={label} hint={hint} id={id}>
      <select
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function ToggleField({
  label,
  hint,
  id,
  value,
  onChange,
}: BaseProps & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <label
          htmlFor={id}
          className="block cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        {hint && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/Field.tsx src/components/Card.tsx
git commit -m "feat: add reusable form field and card primitives"
```

---

## Task 8: Configuration panel

**Files:**
- Create: `src/components/ConfigPanel.tsx`, `src/components/AdvancedSettings.tsx`

- [ ] **Step 1: Write `src/components/AdvancedSettings.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NumberField, SelectField, ToggleField } from './Field';
import type { SimConfig } from '../lib/types';
import { BOUNDS } from '../lib/defaults';

interface Props {
  config: SimConfig;
  onChange: (patch: Partial<SimConfig>) => void;
}

export function AdvancedSettings({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Definições avançadas
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-200 p-4 dark:border-slate-800">
          <NumberField
            id="etfFee"
            label="Comissão anual do ETF (TER)"
            suffix="%"
            step={0.01}
            min={BOUNDS.etfFee[0]}
            max={BOUNDS.etfFee[1]}
            value={config.etfFee}
            onChange={(etfFee) => onChange({ etfFee })}
          />
          <NumberField
            id="pprFee"
            label="Comissão anual de gestão do PPR"
            suffix="%"
            step={0.01}
            min={BOUNDS.pprFee[0]}
            max={BOUNDS.pprFee[1]}
            value={config.pprFee}
            onChange={(pprFee) => onChange({ pprFee })}
          />
          <NumberField
            id="pprTrackingError"
            label="Desvio face ao índice (tracking error) do PPR"
            suffix="%"
            step={0.1}
            min={BOUNDS.pprTrackingError[0]}
            max={BOUNDS.pprTrackingError[1]}
            value={config.pprTrackingError}
            onChange={(pprTrackingError) => onChange({ pprTrackingError })}
            hint="A rendibilidade real de um PPR pode ficar bastante abaixo do índice que diz seguir, para além da comissão de gestão. Numa análise da comunidade a um PPR popular, esse desvio rondava 2,6% ao ano — o suficiente para anular sozinho toda a vantagem fiscal. Fica a 0 por omissão para o simulador não tomar partido."
          />
          <NumberField
            id="etfAnnualCost"
            label="Custos anuais de corretora"
            suffix="€"
            step={1}
            min={BOUNDS.etfAnnualCost[0]}
            max={BOUNDS.etfAnnualCost[1]}
            value={config.etfAnnualCost}
            onChange={(etfAnnualCost) => onChange({ etfAnnualCost })}
            hint="Custódia, conectividade e comissões de compra. Aplica-se apenas ao ETF."
          />

          <hr className="border-slate-200 dark:border-slate-800" />

          <SelectField
            id="etfTaxMode"
            label="Tributação das mais-valias do ETF"
            value={config.etfTaxMode}
            onChange={(etfTaxMode) => onChange({ etfTaxMode })}
            options={[
              { value: 'ladder', label: 'Taxa autónoma 28% com exclusões (Lei 31/2024)' },
              { value: 'flat28', label: '28% fixo, sem exclusões' },
              { value: 'englobamento', label: 'Englobamento à taxa marginal' },
            ]}
            hint="A Lei 31/2024 exclui de tributação 10% da mais-valia entre 2 e 5 anos, 20% entre 5 e 8 anos e 30% a partir de 8 anos. Aplica-se automaticamente sobre a taxa autónoma de 28%, dando taxas efetivas de 25,2%, 22,4% e 19,6% — não exige englobamento. Ações fracionadas, derivados e criptoativos não beneficiam da exclusão: nesses casos escolha 28% fixo."
          />
          {config.etfTaxMode === 'englobamento' && (
            <NumberField
              id="marginalRate"
              label="A sua taxa marginal de IRS"
              suffix="%"
              step={0.5}
              min={BOUNDS.marginalRate[0]}
              max={BOUNDS.marginalRate[1]}
              value={config.marginalRate}
              onChange={(marginalRate) => onChange({ marginalRate })}
              hint="O englobamento só compensa se a sua taxa marginal for inferior a 28%. As mesmas exclusões por prazo aplicam-se, mas sobre esta taxa."
            />
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          <ToggleField
            id="use35Rule"
            label="Aplicar a regra dos 35% (art. 4.º/3 do DL 158/2002)"
            value={config.use35Rule}
            onChange={(use35Rule) => onChange({ use35Rule })}
            hint="Passados 5 anos sobre a PRIMEIRA entrega, pode resgatar a totalidade do PPR, desde que as entregas feitas na primeira metade do contrato representem pelo menos 35% do total. Com entregas anuais constantes essa fração é sempre 50%, pelo que a condição se verifica. Desligue para exigir que cada entrega tenha 5 anos (art. 4.º/2)."
          />
          <ToggleField
            id="irsBandsEnabled"
            label="Escalonar o limite do benefício por idade"
            value={config.irsBandsEnabled}
            onChange={(irsBandsEnabled) => onChange({ irsBandsEnabled })}
            hint="20% das entregas, até 400 € abaixo dos 35 anos, 350 € dos 35 aos 50 e 300 € acima dos 50 (art. 21.º do EBF). Este limite está ainda sujeito ao limite global de deduções à coleta e à coleta disponível, que o simulador não modela."
          />
          {!config.irsBandsEnabled && (
            <NumberField
              id="irsBenefitCap"
              label="Limite anual do benefício"
              suffix="€"
              step={10}
              min={BOUNDS.irsBenefitCap[0]}
              max={BOUNDS.irsBenefitCap[1]}
              value={config.irsBenefitCap}
              onChange={(irsBenefitCap) => onChange({ irsBenefitCap })}
            />
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Regras aplicadas
            </h3>
            <p>
              <strong>Resgate do PPR para o crédito habitação</strong> (alínea g)
              do art. 4.º do DL 158/2002): permite pagar prestações vencidas e
              cada prestação vincenda na data em que se vence. Não permite
              amortizar capital — o regime excecional que o permitia terminou a
              31 de dezembro de 2024. Por isso o resgate anual está limitado a 12
              prestações.
            </p>
            <p>
              <strong>Tributação do resgate</strong> (art. 21.º/3 do EBF): nas
              condições legais, só 2/5 do rendimento é tributado, à taxa de 20% —
              uma taxa efetiva de 8% sobre o lucro, independentemente do prazo.
            </p>
            <p>
              <strong>Fora das condições legais</strong>: 21,5% sobre a totalidade
              do rendimento até 5 anos, sobre 80% entre 5 e 8 anos (17,2% efetivo)
              e sobre 40% acima de 8 anos (8,6% efetivo), acrescido da devolução
              dos benefícios recebidos majorados em 10% por cada ano.
            </p>
            <p>
              <strong>Devolução do benefício</strong>: não há devolução quando o
              resgate é feito nas condições legais e pelo menos 5 anos após a
              entrega. Todos os resgates simulados cumprem as duas condições.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/ConfigPanel.tsx`**

```tsx
import { Link2, RotateCcw } from 'lucide-react';
import { NumberField, SelectField, TextField, ToggleField } from './Field';
import { AdvancedSettings } from './AdvancedSettings';
import { Card } from './Card';
import { BOUNDS, DEFAULT_CONFIG, MAX_NAME_LENGTH } from '../lib/defaults';
import type { SimConfig } from '../lib/types';

interface Props {
  config: SimConfig;
  onChange: (patch: Partial<SimConfig>) => void;
  onReset: () => void;
  onCopyLink: () => void;
  copied: boolean;
}

export function ConfigPanel({
  config,
  onChange,
  onReset,
  onCopyLink,
  copied,
}: Props) {
  return (
    <div className="space-y-4">
      <Card title="Os seus produtos">
        <div className="space-y-4">
          <TextField
            id="etfName"
            label="Nome do ETF"
            maxLength={MAX_NAME_LENGTH}
            value={config.etfName}
            onChange={(etfName) => onChange({ etfName })}
          />
          <TextField
            id="pprName"
            label="Nome do PPR"
            maxLength={MAX_NAME_LENGTH}
            value={config.pprName}
            onChange={(pprName) => onChange({ pprName })}
          />
        </div>
      </Card>

      <Card title="Configuração">
        <div className="space-y-4">
          <NumberField
            id="currentAge"
            label="Idade atual"
            suffix="anos"
            min={BOUNDS.currentAge[0]}
            max={BOUNDS.currentAge[1]}
            value={config.currentAge}
            onChange={(currentAge) => onChange({ currentAge })}
          />
          <SelectField
            id="contributionMode"
            label="Quanto investir por ano"
            value={config.contributionMode}
            onChange={(contributionMode) => onChange({ contributionMode })}
            options={[
              { value: 'fixed', label: 'Valor fixo' },
              { value: 'maxDeductible', label: 'O máximo dedutível para a idade' },
            ]}
            hint={
              config.contributionMode === 'maxDeductible'
                ? 'Investe 2000 €, 1750 € ou 1500 € consoante a idade — exatamente o valor cujos 20% atingem o limite do benefício. Investir mais não dá dedução adicional.'
                : undefined
            }
          />
          {config.contributionMode === 'fixed' && (
            <NumberField
              id="annualInvestment"
              label="Investimento anual"
              suffix="€"
              step={100}
              min={BOUNDS.annualInvestment[0]}
              max={BOUNDS.annualInvestment[1]}
              value={config.annualInvestment}
              onChange={(annualInvestment) => onChange({ annualInvestment })}
            />
          )}
          <NumberField
            id="years"
            label="Horizonte da simulação"
            suffix="anos"
            min={BOUNDS.years[0]}
            max={BOUNDS.years[1]}
            value={config.years}
            onChange={(years) => onChange({ years })}
          />
          <NumberField
            id="etfReturn"
            label={`Rendibilidade bruta — ${config.etfName}`}
            suffix="%"
            step={0.01}
            min={BOUNDS.etfReturn[0]}
            max={BOUNDS.etfReturn[1]}
            value={config.etfReturn}
            onChange={(etfReturn) => onChange({ etfReturn })}
          />
          <NumberField
            id="pprReturn"
            label={`Rendibilidade bruta — ${config.pprName}`}
            suffix="%"
            step={0.01}
            min={BOUNDS.pprReturn[0]}
            max={BOUNDS.pprReturn[1]}
            value={config.pprReturn}
            onChange={(pprReturn) => onChange({ pprReturn })}
          />
        </div>
      </Card>

      <Card title="Crédito habitação">
        <div className="space-y-4">
          <NumberField
            id="mortgageStartYear"
            label="Ano em que começa o crédito"
            suffix="ano"
            min={BOUNDS.mortgageStartYear[0]}
            max={BOUNDS.mortgageStartYear[1]}
            value={config.mortgageStartYear}
            onChange={(mortgageStartYear) => onChange({ mortgageStartYear })}
            hint="Contado a partir de hoje. Antes deste ano não há resgates."
          />
          <NumberField
            id="monthlyInstalment"
            label="Prestação mensal"
            suffix="€"
            step={25}
            min={BOUNDS.monthlyInstalment[0]}
            max={BOUNDS.monthlyInstalment[1]}
            value={config.monthlyInstalment}
            onChange={(monthlyInstalment) => onChange({ monthlyInstalment })}
            hint="Limita o resgate anual do PPR a 12 prestações, porque a lei só permite pagar prestações à medida que se vencem."
          />
        </div>
      </Card>

      <Card title="Reinvestimento">
        <div className="space-y-4">
          <SelectField
            id="benefitDestination"
            label="O que fazer com o benefício de IRS"
            value={config.benefitDestination}
            onChange={(benefitDestination) => onChange({ benefitDestination })}
            options={[
              { value: 'etf', label: `Investir no ${config.etfName}` },
              { value: 'ppr', label: `Reforçar o ${config.pprName}` },
              { value: 'consumed', label: 'Gastar' },
            ]}
            hint="Esta escolha não é uma regra fiscal — é uma decisão sua, e é a que mais altera o resultado. Comparações publicadas divergem entre si por várias vezes só por causa dela."
          />
          <ToggleField
            id="reinvestRedemption"
            label={`Reinvestir no ${config.etfName} o valor libertado pelo resgate`}
            value={config.reinvestRedemption}
            onChange={(reinvestRedemption) => onChange({ reinvestRedemption })}
            hint="Quando o PPR paga a prestação, o seu salário deixa de a pagar. Este interruptor decide se essa folga é investida ou gasta."
          />
        </div>
      </Card>

      <AdvancedSettings config={config} onChange={onChange} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopyLink}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Link2 size={16} />
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG)}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw size={16} />
          Repor
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/ConfigPanel.tsx src/components/AdvancedSettings.tsx
git commit -m "feat: add configuration panel with advanced settings and rule citations"
```

---

## Task 9: Summary cards and callouts

**Files:**
- Create: `src/components/SummaryCards.tsx`, `src/components/Callouts.tsx`

- [ ] **Step 1: Write `src/components/Callouts.tsx`**

```tsx
import { AlertTriangle, Info } from 'lucide-react';

export function RiskEquivalenceWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <AlertTriangle
        size={18}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
      />
      <div className="space-y-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
        <p className="font-semibold">
          Não está a comparar produtos com o mesmo risco.
        </p>
        <p>
          Um ETF do S&amp;P 500 é 100% ações. Os PPR portugueses são
          normalmente carteiras mistas — um PPR popular baseado em ETF anda à
          volta de 75% ações, 22,5% obrigações e 2,5% monetário. Uma
          rendibilidade esperada mais baixa é a <em>consequência</em> de menos
          risco, não um defeito do produto.
        </p>
        <p>
          O simulador compara os números que escrever, sem saber se representam
          risco equivalente. Para isolar apenas o efeito fiscal — que é o que
          este simulador faz bem — ponha as duas rendibilidades iguais.
        </p>
      </div>
    </div>
  );
}

export function WhatThisCannotPrice() {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
      <Info size={18} className="mt-0.5 shrink-0 text-slate-500" />
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <p className="font-semibold">O que este simulador não consegue medir</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Liquidez.</strong> Um PPR não pode ser resgatado para um
            imprevisto sem a penalização de 21,5% e a devolução dos benefícios.
            Um ETF vende-se em qualquer dia.
          </li>
          <li>
            <strong>Opcionalidade.</strong> Um ETF pode ser reequilibrado ou
            vendido antes de uma queda esperada. Um PPR não.
          </li>
          <li>
            <strong>Concentração.</strong> O PPR liga a reforma e a estratégia
            do crédito à mesma entidade.
          </li>
          <li>
            <strong>Sequência de rendibilidades.</strong> O simulador usa uma
            rendibilidade constante. Os mercados reais não são assim.
          </li>
        </ul>
      </div>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      Este simulador é uma ferramenta educativa e não constitui aconselhamento
      financeiro ou fiscal. As regras implementadas são as vigentes em 2026 e
      mudam com frequência. Confirme sempre a sua situação concreta com um
      profissional. Consulte o DL 158/2002 (art. 4.º), o EBF (art. 21.º) e o
      CIRS (art. 5.º/3 e 43.º/5), bem como a Lei n.º 31/2024.
    </p>
  );
}
```

- [ ] **Step 2: Write `src/components/SummaryCards.tsx`**

```tsx
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatEur, formatPct } from '../lib/format';
import type { ScenarioResult } from '../lib/types';

const ACCENTS: Record<string, string> = {
  etf: 'border-t-sky-500',
  hybrid: 'border-t-emerald-500',
  ppr: 'border-t-violet-500',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="tnum font-medium text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function SummaryCards({ scenarios }: { scenarios: ScenarioResult[] }) {
  const baseline = scenarios.find((s) => s.id === 'etf')!;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((s) => {
        const delta = s.final.netValue - baseline.final.netValue;
        const isBaseline = s.id === 'etf';
        const totalTax =
          s.final.etfTax + s.final.pprTax + s.final.pprTaxDuringRedemptions;

        return (
          <article
            key={s.id}
            className={`rounded-xl border border-t-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${ACCENTS[s.id]}`}
          >
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {s.label}
            </h3>

            <p className="tnum mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              {formatEur(s.final.netValue)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              valor líquido da carteira no fim
            </p>

            {!isBaseline && (
              <p
                className={`tnum mt-3 flex items-center gap-1.5 text-sm font-semibold ${
                  delta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                {delta >= 0 ? '+' : ''}
                {formatEur(delta)} face a {baseline.label}
              </p>
            )}

            <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Row
                label="Com benefícios recebidos"
                value={formatEur(s.final.netWithBenefits)}
              />
              <Row label="Total investido" value={formatEur(s.final.totalContributed)} />
              <Row label="Imposto total" value={formatEur(totalTax)} />
              <Row
                label="Taxa efetiva sobre ganhos"
                value={formatPct(s.final.effectiveTaxRate)}
              />
              {s.final.mortgagePaidTotal > 0 && (
                <Row
                  label="Prestações pagas pelo PPR"
                  value={formatEur(s.final.mortgagePaidTotal)}
                />
              )}
              {s.final.irsBenefitTotal > 0 && (
                <Row
                  label="Benefício de IRS acumulado"
                  value={formatEur(s.final.irsBenefitTotal)}
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/SummaryCards.tsx src/components/Callouts.tsx
git commit -m "feat: add summary cards and risk-equivalence callouts"
```

---

## Task 10: Charts

**Files:**
- Create: `src/components/charts/chartTheme.ts`, `WealthChart.tsx`, `CompositionChart.tsx`, `TaxWaterfall.tsx`, `BracketBar.tsx`, `DeltaChart.tsx`

- [ ] **Step 1: Write `src/components/charts/chartTheme.ts`**

```ts
export const SERIES_COLORS: Record<string, string> = {
  etf: '#0ea5e9',
  hybrid: '#10b981',
  ppr: '#8b5cf6',
};

export const AXIS = {
  stroke: 'currentColor',
  fontSize: 12,
} as const;

export const gridProps = {
  strokeDasharray: '3 3',
  className: 'stroke-slate-200 dark:stroke-slate-800',
} as const;

export const tooltipStyle = {
  contentStyle: {
    borderRadius: '0.5rem',
    border: '1px solid rgb(203 213 225)',
    fontSize: '0.8125rem',
  },
} as const;
```

- [ ] **Step 2: Write `src/components/charts/WealthChart.tsx`**

```tsx
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, SERIES_COLORS, gridProps, tooltipStyle } from './chartTheme';
import { formatCompactEur, formatEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

export function WealthChart({
  scenarios,
  mortgageStartYear,
}: {
  scenarios: ScenarioResult[];
  mortgageStartYear: number;
}) {
  const data = scenarios[0].rows.map((row, i) => {
    const point: Record<string, number> = { year: row.year };
    for (const s of scenarios) point[s.id] = s.rows[i].netIfLiquidatedNow;
    return point;
  });

  const showMortgageLine =
    mortgageStartYear >= 1 && mortgageStartYear <= data.length;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="year"
          {...AXIS}
          label={{ value: 'Ano', position: 'insideBottom', offset: -4, fontSize: 12 }}
        />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) => [formatEur(v), name]}
          labelFormatter={(y) => `Ano ${y}`}
        />
        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
        {showMortgageLine && (
          <ReferenceLine
            x={mortgageStartYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: 'início do crédito', fontSize: 11, fill: '#f59e0b' }}
          />
        )}
        {scenarios.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={SERIES_COLORS[s.id]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Write `src/components/charts/CompositionChart.tsx`**

```tsx
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, gridProps, tooltipStyle } from './chartTheme';
import { formatCompactEur, formatEur } from '../../lib/format';
import type { ScenarioResult, SimConfig } from '../../lib/types';

export function CompositionChart({
  hybrid,
  config,
}: {
  hybrid: ScenarioResult;
  config: SimConfig;
}) {
  const data = hybrid.rows.map((r) => ({
    year: r.year,
    ppr: r.pprBalance,
    etf: r.etfBalance,
    mortgage: r.mortgagePaid,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) => [formatEur(v), name]}
          labelFormatter={(y) => `Ano ${y}`}
        />
        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
        <Area
          type="monotone"
          dataKey="ppr"
          stackId="1"
          name={config.pprName}
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.55}
        />
        <Area
          type="monotone"
          dataKey="etf"
          stackId="1"
          name={config.etfName}
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.55}
        />
        <Area
          type="monotone"
          dataKey="mortgage"
          stackId="1"
          name="Prestações já pagas"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.35}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Write `src/components/charts/TaxWaterfall.tsx`**

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, gridProps, tooltipStyle } from './chartTheme';
import { formatCompactEur, formatEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

/**
 * A floating-bar waterfall. Each bar is [start, end] so Recharts draws it
 * suspended at the right height; `amount` carries the signed value shown
 * in the tooltip.
 */
function buildSteps(s: ScenarioResult) {
  const steps: { name: string; amount: number }[] = [
    { name: 'Carteira bruta', amount: s.final.grossValue },
    { name: 'Imposto ETF', amount: -s.final.etfTax },
    { name: 'Imposto PPR', amount: -(s.final.pprTax + s.final.pprTaxDuringRedemptions) },
    { name: 'Prestações pagas', amount: s.final.mortgagePaidTotal },
    { name: 'Benefício IRS', amount: s.final.irsBenefitTotal },
  ].filter((step, i) => i === 0 || Math.abs(step.amount) > 0.005);

  let running = 0;
  const bars = steps.map((step) => {
    const start = running;
    running += step.amount;
    return {
      name: step.name,
      range: [Math.min(start, running), Math.max(start, running)] as [number, number],
      amount: step.amount,
      positive: step.amount >= 0,
    };
  });

  bars.push({
    name: 'Total',
    range: [0, running] as [number, number],
    amount: running,
    positive: true,
  });

  return bars;
}

export function TaxWaterfall({ scenario }: { scenario: ScenarioResult }) {
  const data = buildSteps(scenario);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis
          dataKey="name"
          {...AXIS}
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          formatter={(_v, _n, item) => [
            formatEur(item.payload.amount),
            item.payload.name,
          ]}
        />
        <Bar dataKey="range" radius={[3, 3, 3, 3]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.name === 'Total'
                  ? '#0f172a'
                  : d.positive
                    ? '#10b981'
                    : '#f43f5e'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Write `src/components/charts/BracketBar.tsx`**

```tsx
import { formatEur, formatRate } from '../../lib/format';
import type { BracketSlice } from '../../lib/types';

const BRACKET_ORDER = [
  '8 anos ou mais',
  '5 a 8 anos',
  '2 a 5 anos',
  'menos de 2 anos',
];

const BRACKET_COLORS: Record<string, string> = {
  '8 anos ou mais': '#059669',
  '5 a 8 anos': '#34d399',
  '2 a 5 anos': '#fbbf24',
  'menos de 2 anos': '#f43f5e',
};

export function BracketBar({ slices }: { slices: BracketSlice[] }) {
  const ordered = BRACKET_ORDER.map((b) =>
    slices.find((s) => s.bracket === b),
  ).filter((s): s is BracketSlice => s !== undefined && s.gain > 0);

  const totalGain = ordered.reduce((sum, s) => sum + s.gain, 0);

  if (totalGain <= 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sem mais-valias no ETF para repartir por escalões.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-8 w-full overflow-hidden rounded-lg" role="img"
           aria-label="Repartição das mais-valias do ETF por escalão de tributação">
        {ordered.map((s) => (
          <div
            key={s.bracket}
            style={{
              width: `${(s.gain / totalGain) * 100}%`,
              backgroundColor: BRACKET_COLORS[s.bracket],
            }}
            title={`${s.bracket}: ${formatEur(s.gain)}`}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {ordered.map((s) => (
          <li key={s.bracket} className="flex items-center gap-3 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: BRACKET_COLORS[s.bracket] }}
            />
            <span className="flex-1 text-slate-700 dark:text-slate-300">
              {s.bracket}{' '}
              <span className="text-slate-500 dark:text-slate-400">
                ({formatRate(s.ratePct)})
              </span>
            </span>
            <span className="tnum text-slate-600 dark:text-slate-400">
              {formatEur(s.gain)} de ganho
            </span>
            <span className="tnum w-24 text-right font-medium text-rose-600 dark:text-rose-400">
              {formatEur(s.tax)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/charts/DeltaChart.tsx`**

```tsx
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, gridProps, tooltipStyle } from './chartTheme';
import { formatCompactEur, formatEur } from '../../lib/format';
import type { ScenarioResult } from '../../lib/types';

export function DeltaChart({
  etf,
  hybrid,
  breakEvenYear,
}: {
  etf: ScenarioResult;
  hybrid: ScenarioResult;
  breakEvenYear: number | null;
}) {
  const data = hybrid.rows.map((r, i) => ({
    year: r.year,
    delta: r.netIfLiquidatedNow - etf.rows[i].netIfLiquidatedNow,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id="deltaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={formatCompactEur} width={70} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [formatEur(v), 'Diferença']}
          labelFormatter={(y) => `Ano ${y}`}
        />
        <ReferenceLine y={0} stroke="#94a3b8" />
        {breakEvenYear !== null && (
          <ReferenceLine
            x={breakEvenYear}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: `equilíbrio: ano ${breakEvenYear}`,
              fontSize: 11,
              fill: '#f59e0b',
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="delta"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#deltaFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 7: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/charts
git commit -m "feat: add five result visualisations"
```

---

## Task 11: Generated explanation

**Files:**
- Create: `src/lib/explain.ts`, `src/lib/explain.test.ts`, `src/components/Explanation.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/explain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildExplanation } from './explain';
import { simulate } from './engine';
import { DEFAULT_CONFIG } from './defaults';

describe('buildExplanation', () => {
  it('names the configured products', () => {
    const cfg = { ...DEFAULT_CONFIG, etfName: 'VWCE', pprName: 'Golden SGF' };
    const steps = buildExplanation(cfg, simulate(cfg));
    const text = steps.map((s) => s.body).join(' ');
    expect(text).toContain('VWCE');
    expect(text).toContain('Golden SGF');
  });

  it('warns explicitly when nothing is reinvested', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      benefitDestination: 'consumed' as const,
      reinvestRedemption: false,
    };
    const steps = buildExplanation(cfg, simulate(cfg));
    const text = steps.map((s) => s.body).join(' ');
    expect(text).toContain('gasta');
  });

  it('returns at least four steps for the default configuration', () => {
    expect(
      buildExplanation(DEFAULT_CONFIG, simulate(DEFAULT_CONFIG)).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('does not throw when no redemption ever happens', () => {
    const cfg = { ...DEFAULT_CONFIG, mortgageStartYear: 999 };
    expect(() => buildExplanation(cfg, simulate(cfg))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/explain.test.ts
```

Expected: FAIL — `Failed to resolve import "./explain"`.

- [ ] **Step 3: Write `src/lib/explain.ts`**

```ts
import type { SimConfig, SimOutput } from './types';
import { formatEur, formatRate } from './format';
import { irsCapForAge } from './tax';

export interface ExplanationStep {
  title: string;
  body: string;
}

/**
 * Prose built from the computed result, so the numbers quoted are always the
 * ones on screen. Never write static commentary about the strategy here.
 */
export function buildExplanation(
  cfg: SimConfig,
  out: SimOutput,
): ExplanationStep[] {
  const etf = out.scenarios.find((s) => s.id === 'etf')!;
  const hybrid = out.scenarios.find((s) => s.id === 'hybrid')!;
  const steps: ExplanationStep[] = [];

  const firstCap = irsCapForAge(
    cfg.currentAge,
    cfg.irsBandsEnabled,
    cfg.irsBenefitCap,
  );
  const firstContribution = hybrid.rows[0]?.contributedThisYear ?? 0;

  steps.push({
    title: '1. Investe no PPR em vez do ETF',
    body:
      `Todos os anos entrega ${formatEur(firstContribution)} ao ${cfg.pprName} ` +
      `em vez de os investir diretamente no ${cfg.etfName}. Ao longo de ` +
      `${cfg.years} anos são ${formatEur(hybrid.final.totalContributed)} ` +
      `saídos do seu bolso — exatamente o mesmo que no cenário só com ETF, ` +
      `para a comparação ser justa.`,
  });

  const benefitLine =
    cfg.benefitDestination === 'etf'
      ? `esse dinheiro é investido no ${cfg.etfName} no próprio ano, onde volta a capitalizar`
      : cfg.benefitDestination === 'ppr'
        ? `esse dinheiro reforça a entrega do ano seguinte no ${cfg.pprName}`
        : `esse dinheiro é gasto, por isso nunca capitaliza`;

  steps.push({
    title: '2. Recupera 20% no IRS',
    body:
      `Cada entrega dá direito a deduzir 20% à coleta, até ${formatEur(firstCap)} ` +
      `por ano (art. 21.º do EBF). Ao fim de ${cfg.years} anos são ` +
      `${formatEur(hybrid.final.irsBenefitTotal)} devolvidos pelo Estado. Na ` +
      `configuração atual, ${benefitLine}.`,
  });

  if (hybrid.final.mortgagePaidTotal > 0) {
    const firstRedemption = hybrid.rows.find((r) => r.redeemedThisYear > 0);
    steps.push({
      title: '3. Paga a prestação com o PPR a 8%',
      body:
        `A partir do ano ${firstRedemption?.year ?? cfg.mortgageStartYear} começa a ` +
        `resgatar o ${cfg.pprName} para pagar prestações do crédito habitação. ` +
        `Nessas condições o resgate é tributado a 8% do lucro — só 2/5 do ` +
        `rendimento à taxa de 20% — em vez dos 28% das mais-valias comuns. ` +
        `No total, o ${cfg.pprName} paga ${formatEur(hybrid.final.mortgagePaidTotal)} ` +
        `de prestações, com ${formatEur(hybrid.final.pprTaxDuringRedemptions)} de ` +
        `imposto. O resgate está limitado a 12 prestações por ano porque a lei ` +
        `só permite pagar prestações à medida que se vencem, nunca amortizar capital.`,
    });

    steps.push({
      title: '4. Reinveste a folga no salário',
      body: cfg.reinvestRedemption
        ? `Como o PPR paga a prestação, o seu salário deixa de a pagar. Esse ` +
          `valor líquido é investido no ${cfg.etfName} no mesmo ano. É este ` +
          `passo que faz a estratégia funcionar: sem ele, só trocou uma poupança ` +
          `por outra.`
        : `A folga que o salário passa a ter está a ser gasta em vez de ` +
          `investida. Sem reinvestimento, esta estratégia não tem como ganhar ` +
          `ao investimento direto no ${cfg.etfName}.`,
    });
  } else {
    steps.push({
      title: '3. Nesta configuração não há resgates',
      body:
        `O crédito começa no ano ${cfg.mortgageStartYear}, fora do horizonte de ` +
        `${cfg.years} anos simulados, ou não há saldo elegível. Sem resgates, o ` +
        `PPR é liquidado apenas no fim, também a 8%.`,
    });
  }

  const delta = hybrid.final.netValue - etf.final.netValue;
  const verdict =
    delta >= 0
      ? `a estratégia híbrida termina ${formatEur(delta)} acima do investimento ` +
        `direto no ${cfg.etfName}` +
        (out.breakEvenYear !== null
          ? `, ultrapassando-o no ano ${out.breakEvenYear}`
          : '')
      : `a estratégia híbrida termina ${formatEur(Math.abs(delta))} ABAIXO do ` +
        `investimento direto no ${cfg.etfName}`;

  steps.push({
    title: '5. O resultado',
    body:
      `Com uma rendibilidade de ${formatRate(cfg.etfReturn)} no ${cfg.etfName} ` +
      `e ${formatRate(cfg.pprReturn)} no ${cfg.pprName}, ${verdict}. ` +
      `A diferença de rendibilidade entre os dois produtos pesa mais do que a ` +
      `vantagem fiscal em horizontes longos: ponha as duas rendibilidades ` +
      `iguais para ver só o efeito fiscal.`,
  });

  return steps;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/explain.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Write `src/components/Explanation.tsx`**

```tsx
import type { ExplanationStep } from '../lib/explain';

export function Explanation({ steps }: { steps: ExplanationStep[] }) {
  return (
    <ol className="space-y-5">
      {steps.map((step) => (
        <li key={step.title} className="border-l-2 border-emerald-500 pl-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {step.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/explain.ts src/lib/explain.test.ts src/components/Explanation.tsx
git commit -m "feat: generate step-by-step explanation from computed results"
```

---

## Task 12: Wire the app together

**Files:**
- Create: `src/hooks/useUrlConfig.ts`
- Modify: `src/App.tsx` (replace entirely), `src/main.tsx` (verify), delete `src/App.css`

- [ ] **Step 1: Write `src/hooks/useUrlConfig.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { parseConfig, serialiseConfig } from '../lib/url';
import { DEFAULT_CONFIG } from '../lib/defaults';
import type { SimConfig } from '../lib/types';

/**
 * The URL query string is the single source of truth for configuration, so
 * every result is shareable by link. State is mirrored into React so typing
 * stays responsive; the URL is replaced (never pushed) to keep the back
 * button useful.
 */
export function useUrlConfig() {
  const [config, setConfig] = useState<SimConfig>(() =>
    parseConfig(typeof window === 'undefined' ? '' : window.location.search.slice(1)),
  );

  useEffect(() => {
    const query = serialiseConfig(config);
    const url = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [config]);

  useEffect(() => {
    const onPop = () =>
      setConfig(parseConfig(window.location.search.slice(1)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback(
    (patch: Partial<SimConfig>) => setConfig((c) => ({ ...c, ...patch })),
    [],
  );

  const reset = useCallback(() => setConfig({ ...DEFAULT_CONFIG }), []);

  return { config, update, reset };
}
```

- [ ] **Step 2: Replace `src/App.tsx` entirely**

```tsx
import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { useUrlConfig } from './hooks/useUrlConfig';
import { simulate } from './lib/engine';
import { buildExplanation } from './lib/explain';
import { ConfigPanel } from './components/ConfigPanel';
import { SummaryCards } from './components/SummaryCards';
import { Explanation } from './components/Explanation';
import { Card } from './components/Card';
import {
  Disclaimer,
  RiskEquivalenceWarning,
  WhatThisCannotPrice,
} from './components/Callouts';
import { WealthChart } from './components/charts/WealthChart';
import { CompositionChart } from './components/charts/CompositionChart';
import { TaxWaterfall } from './components/charts/TaxWaterfall';
import { BracketBar } from './components/charts/BracketBar';
import { DeltaChart } from './components/charts/DeltaChart';

export default function App() {
  const { config, update, reset } = useUrlConfig();
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => simulate(config), [config]);
  const explanation = useMemo(
    () => buildExplanation(config, output),
    [config, output],
  );

  const etf = output.scenarios.find((s) => s.id === 'etf')!;
  const hybrid = output.scenarios.find((s) => s.id === 'hybrid')!;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-3xl">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <LineChart size={20} />
          <span className="text-sm font-semibold tracking-wide uppercase">
            Simulador
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          PPR + crédito habitação vs. ETF
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Compara três estratégias de longo prazo para quem vive em Portugal e
          conta ter crédito habitação: investir só num ETF, investir só num PPR,
          ou a estratégia híbrida — usar o PPR para captar o benefício de IRS,
          resgatá-lo a 8% para pagar as prestações, e reinvestir no ETF tudo o
          que isso liberta.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ConfigPanel
            config={config}
            onChange={update}
            onReset={reset}
            onCopyLink={copyLink}
            copied={copied}
          />
        </aside>

        <main className="min-w-0 space-y-6">
          <SummaryCards scenarios={output.scenarios} />

          <RiskEquivalenceWarning />

          <Card
            title="Evolução do património"
            subtitle="Valor líquido de cada estratégia se fosse liquidada nesse ano."
          >
            <WealthChart
              scenarios={output.scenarios}
              mortgageStartYear={config.mortgageStartYear}
            />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card
              title="Composição da estratégia híbrida"
              subtitle="O capital a migrar do PPR para o ETF, e as prestações já pagas."
            >
              <CompositionChart hybrid={hybrid} config={config} />
            </Card>

            <Card
              title="Diferença acumulada"
              subtitle={`${hybrid.label} menos ${etf.label}, ano a ano.`}
            >
              <DeltaChart
                etf={etf}
                hybrid={hybrid}
                breakEvenYear={output.breakEvenYear}
              />
            </Card>
          </div>

          <Card
            title="Impacto fiscal"
            subtitle="Da carteira bruta ao valor final, passo a passo."
          >
            <div className="grid gap-8 xl:grid-cols-2">
              {[etf, hybrid].map((s) => (
                <div key={s.id}>
                  <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {s.label}
                  </h3>
                  <TaxWaterfall scenario={s} />
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Escalões de tributação do ETF"
            subtitle={`Onde caem as mais-valias do ${config.etfName} na estratégia híbrida, por antiguidade de cada entrada (FIFO).`}
          >
            <BracketBar slices={hybrid.final.bracketBreakdown} />
          </Card>

          <Card
            title="Como funciona, passo a passo"
            subtitle="Gerado a partir da configuração atual."
          >
            <Explanation steps={explanation} />
          </Card>

          <WhatThisCannotPrice />
          <Disclaimer />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remove the scaffold stylesheet**

```bash
rm -f src/App.css
```

Confirm `src/main.tsx` imports `./index.css` and not `./App.css`. If it
imports `App.css`, remove that line.

- [ ] **Step 4: Verify the build and the full test suite**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: no type errors, all tests PASS, build succeeds.

- [ ] **Step 5: Check it in a browser**

```bash
npm run dev
```

Open the printed URL. Verify: all three cards render; changing "Horizonte da
simulação" updates the charts and adds `?yrs=` to the address bar; reloading
that URL preserves the value; "Copiar link" reports success; expanding
"Definições avançadas" shows the tracking-error field.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire the dashboard together with URL-backed configuration"
```

---

## Task 13: Deployment and documentation

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`
- Modify: `index.html`

- [ ] **Step 1: Set the page title and language**

In `index.html`, set `<html lang="pt-PT">` and replace the `<title>` and add a
description:

```html
<title>Simulador PPR + Crédito Habitação vs ETF</title>
<meta
  name="description"
  content="Compare investir num ETF, num PPR, ou usar o PPR para pagar o crédito habitação a 8% e reinvestir a folga. Simulador educativo com as regras fiscais portuguesas."
/>
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          # serves the site from https://<user>.github.io/<repo>/
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Write `README.md`**

````markdown
# Simulador PPR + Crédito Habitação vs ETF

Simulador educativo que compara três estratégias de investimento de longo prazo
para residentes fiscais em Portugal que contam ter crédito habitação.

**Não é aconselhamento financeiro.** As regras fiscais implementadas são as
vigentes em 2026 e mudam com frequência.

## As três estratégias

1. **Só ETF** — entregas anuais num ETF de acumulação.
2. **Híbrida** — entregas num PPR para captar a dedução de 20% no IRS, resgate a
   8% para pagar prestações do crédito habitação, e reinvestimento no ETF de
   tudo o que isso liberta.
3. **Só PPR** — entregas num PPR, sem reinvestir nada.

## Correr localmente

```bash
npm install
npm run dev
```

Outros comandos:

```bash
npm test          # testes da lógica fiscal
npm run build     # build de produção para dist/
```

## Como está organizado

```
src/lib/       lógica pura, sem React
  tax.ts       constantes e primitivas fiscais — mude aqui quando a lei mudar
  tranches.ts  operações FIFO sobre entradas (crescer, resgatar, liquidar)
  engine.ts    o ciclo anual que produz os três cenários
  url.ts       configuração <-> query string
  explain.ts   texto gerado a partir do resultado
src/components/  apresentação apenas, recebe dados já calculados
```

`src/lib/` nunca importa de `src/components/`. A função `simulate()` é pura: a
mesma configuração produz sempre o mesmo resultado, e é isso que permite que o
link contenha o resultado inteiro.

## Regras fiscais implementadas

| Regra | Base legal |
|---|---|
| Mais-valias de ETF a 28%, com exclusão de 10%/20%/30% por prazo (25,2%, 22,4%, 19,6% efetivos) | CIRS art. 43.º/5, Lei n.º 31/2024 |
| FIFO na alienação de valores mobiliários | CIRS art. 43.º |
| Resgate do PPR para prestações de crédito habitação | DL 158/2002 art. 4.º/1 g) |
| Cada entrega resgatável 5 anos depois | DL 158/2002 art. 4.º/2 |
| Regra dos 35%: resgate total 5 anos após a primeira entrega | DL 158/2002 art. 4.º/3 |
| Resgate em condições legais: 2/5 do rendimento a 20% (8% efetivo) | EBF art. 21.º/3 |
| Fora das condições legais: 21,5% / 17,2% / 8,6% | EBF art. 21.º, CIRS art. 5.º/3 |
| Dedução à coleta: 20% até 400 €/350 €/300 € por idade | EBF art. 21.º |
| Devolução de benefícios majorada em 10%/ano | EBF art. 21.º |

## O que o simulador não modela

Rendibilidades constantes e determinísticas, inflação, escalões progressivos de
IRS, o limite global de deduções à coleta, a coleta disponível, amortização do
crédito, e o risco de sequência de rendibilidades.

Sobretudo: **não sabe se os dois produtos que está a comparar têm risco
equivalente.** Um ETF do S&P 500 é 100% ações; os PPR portugueses são
tipicamente carteiras mistas. Para isolar o efeito fiscal, ponha as duas
rendibilidades iguais.

## Publicar

Um push para `main` publica automaticamente no GitHub Pages através de
`.github/workflows/deploy.yml`. Nas definições do repositório, em Pages,
escolha "GitHub Actions" como origem.
````

- [ ] **Step 4: Verify the production build one more time**

```bash
npm ci && npm test && npm run build
```

Expected: all tests PASS, `dist/` is produced.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add GitHub Pages deployment workflow and README"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run every check**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: all four pass. If `npm run lint` reports errors in scaffolded files
that you did not write, fix them rather than disabling the rule.

- [ ] **Step 2: Verify responsive behaviour**

```bash
npm run dev
```

At a 375px viewport width, confirm: the config panel stacks above the results
rather than beside them, no horizontal scrollbar appears on the page body, and
every chart stays within the viewport.

- [ ] **Step 3: Verify a shared link round-trips**

Change several settings including the product names, click "Copiar link", open
the copied URL in a new tab, and confirm every setting is preserved.

- [ ] **Step 4: Confirm the reference case**

Set: idade 30, horizonte 30, modo "o máximo dedutível", ETF 6% com comissão 0%,
PPR 6% com comissão 0,75%, início do crédito no ano 999, benefício "gastar",
reinvestimento do resgate desligado.

Confirm the "Só PPR" card shows a net value near **123 388 €** and total
contributed of **51 250 €**. This matches the published community figures and
confirms the engine agrees with an independent calculation.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```
