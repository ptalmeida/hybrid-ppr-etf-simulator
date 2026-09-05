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
 * Decompose a scenario's result into the steps that bridge the gross portfolio
 * to the headline figure on its summary card.
 *
 * The steps MUST sum to `final.netWithBenefits`. Two traps make that easy to
 * get wrong, and both were live bugs here:
 *
 *  - Reinvested value is already inside `grossValue`. Adding the mortgage paid
 *    or the IRS benefit back on top double counts it. Only the parts left in
 *    hand — `mortgageInHand` and `benefitInHand` — belong in the waterfall.
 *
 *  - Tax withheld on redemptions along the way was never part of `grossValue`,
 *    because that money left the plan years earlier. Subtracting it here would
 *    charge it twice. It is reported on the card instead.
 */
export function buildWaterfall(scenario: ScenarioResult): WaterfallStep[] {
  const f = scenario.final;

  const deltas: { name: string; amount: number }[] = [
    { name: 'Carteira bruta', amount: f.grossValue },
    { name: 'Imposto ETF', amount: -f.etfTax },
    { name: 'Imposto PPR', amount: -f.pprTax },
    { name: 'Devolução de benefícios', amount: -f.benefitClawback },
    { name: 'Prestações pagas', amount: f.mortgageInHand },
    { name: 'Benefício IRS', amount: f.benefitInHand },
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
