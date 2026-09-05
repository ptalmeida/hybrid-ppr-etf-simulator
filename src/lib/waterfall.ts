import type { ScenarioResult } from './types';

export interface WaterfallStep {
  name: string;
  /** Signed contribution of this step. */
  amount: number;
  /** [from, to] on the value axis, so the bar can float at the right height. */
  range: [number, number];
  positive: boolean;
  /** The closing bar, drawn from zero rather than floating. */
  isTotal?: boolean;
}

/**
 * Decompose a scenario's result into where the money came from and where it
 * went, closing exactly on the headline figure of its summary card.
 *
 * This is built from INFLOWS rather than from the gross portfolio. Starting at
 * "carteira bruta" hid the whole story: with everything reinvested the chart
 * collapsed to three bars and never showed the mortgage at all, even though
 * the salary freed by the PPR is precisely where the hybrid's advantage comes
 * from. Listing the inflows separately makes that visible in both scenarios.
 *
 * The steps MUST sum to `final.netWithBenefits`. Two traps make that easy to
 * get wrong, and both were live bugs here:
 *
 *  - Reinvested value must be counted once, as an inflow. Counting it again at
 *    the end as "mortgage paid" double counts it.
 *
 *  - Tax withheld on redemptions was never part of `grossValue`, so it cannot
 *    be subtracted from it. Against the inflows, though, it is a real cost and
 *    belongs in the PPR tax bar.
 */
export function buildWaterfall(scenario: ScenarioResult): WaterfallStep[] {
  const f = scenario.final;

  const totalTax =
    f.etfTax + f.pprTax + f.pprTaxDuringRedemptions + f.benefitClawback;

  // Everything the household put in, by source. This is the point of the
  // chart: the hybrid's edge comes from two inflows the ETF scenario never
  // gets — the instalments the PPR paid, and the IRS deduction.
  const contributions = f.totalContributed;
  const benefit = f.irsBenefitTotal;

  // `freedSalaryReinvested` and `mortgageInHand` are the SAME euros in two
  // roles — salary freed and reinvested, or instalments settled and kept. They
  // always sum to mortgagePaidTotal, so that single term counts it once,
  // whichever way the surplus was used.
  const mortgage = f.mortgagePaidTotal;

  // Whatever the market added, derived so the steps close exactly on the
  // headline figure rather than being computed a second, divergent way.
  const growth =
    f.netWithBenefits + totalTax - contributions - mortgage - benefit;

  const deltas: { name: string; amount: number }[] = [
    { name: 'Entregas do seu bolso', amount: contributions },
    { name: 'Prestações pagas pelo PPR', amount: mortgage },
    { name: 'Benefício de IRS', amount: benefit },
    { name: 'Rendimento dos investimentos', amount: growth },
    { name: 'Imposto ETF', amount: -f.etfTax },
    {
      name: 'Imposto PPR',
      amount: -(f.pprTax + f.pprTaxDuringRedemptions),
    },
    { name: 'Devolução de benefícios', amount: -f.benefitClawback },
  ];

  let running = 0;
  const steps: WaterfallStep[] = [];

  for (const [i, d] of deltas.entries()) {
    // keep the opening bar even at zero; drop the rest when they do nothing
    if (i > 0 && Math.abs(d.amount) < 0.005) continue;
    const start = running;
    running += d.amount;
    steps.push({
      name: d.name,
      amount: d.amount,
      range: [Math.min(start, running), Math.max(start, running)],
      positive: d.amount >= 0,
    });
  }

  steps.push({
    name: 'Total',
    amount: running,
    range: [Math.min(0, running), Math.max(0, running)],
    positive: running >= 0,
    isTotal: true,
  });

  return steps;
}
