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
    title: `1. Entrega no ${cfg.pprName} em vez do ${cfg.etfName}`,
    body:
      `Todos os anos entrega ${formatEur(firstContribution)} ao ${cfg.pprName} ` +
      `em vez de os investir diretamente no ${cfg.etfName}. Ao longo de ` +
      `${cfg.years} anos são ${formatEur(hybrid.final.totalContributed)} saídos ` +
      `do seu bolso — exatamente o mesmo que no cenário só com ${cfg.etfName}, ` +
      `para a comparação ser justa.`,
  });

  const benefitLine =
    cfg.benefitDestination === 'etf'
      ? `esse dinheiro é investido no ${cfg.etfName}, onde volta a capitalizar`
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
      title: `3. Paga a prestação com o ${cfg.pprName} a 8%`,
      body:
        `A partir do ano ${firstRedemption?.year ?? cfg.mortgageStartYear} começa ` +
        `a resgatar o ${cfg.pprName} para pagar prestações do crédito habitação. ` +
        `Nessas condições o resgate é tributado a 8% do lucro — só 2/5 do ` +
        `rendimento à taxa de 20% — em vez dos 28% das mais-valias comuns. No ` +
        `total o ${cfg.pprName} paga ${formatEur(hybrid.final.mortgagePaidTotal)} ` +
        `de prestações, com ${formatEur(hybrid.final.pprTaxDuringRedemptions)} de ` +
        `imposto. O resgate está limitado a 12 prestações por ano porque a lei só ` +
        `permite pagar prestações à medida que se vencem, nunca amortizar capital.`,
    });

    steps.push({
      title: '4. Reinveste a folga no salário',
      body: cfg.reinvestRedemption
        ? `Como o ${cfg.pprName} paga a prestação, o seu salário deixa de a pagar. ` +
          `Esse valor líquido é investido no ${cfg.etfName} no mesmo ano. É este ` +
          `passo que faz a estratégia funcionar: sem ele, apenas trocou uma ` +
          `poupança por outra.`
        : `A folga que o salário passa a ter está a ser gasta em vez de investida. ` +
          `Sem reinvestimento, esta estratégia não tem como ganhar ao investimento ` +
          `direto no ${cfg.etfName}.`,
    });
  } else {
    steps.push({
      title: '3. Nesta configuração não há resgates',
      body:
        `O crédito começa no ano ${cfg.mortgageStartYear}, fora do horizonte de ` +
        `${cfg.years} anos simulados, ou não há saldo elegível para resgatar. Sem ` +
        `resgates, o ${cfg.pprName} é liquidado apenas no fim, também a 8%.`,
    });
  }

  const delta = hybrid.final.netWithBenefits - etf.final.netWithBenefits;
  const crossover =
    out.breakEvenYear !== null
      ? `, passando à frente no ano ${out.breakEvenYear}`
      : ', e esteve à frente desde o primeiro ano, porque a dedução do IRS entra logo';
  const verdict =
    delta >= 0
      ? `a estratégia híbrida termina ${formatEur(delta)} acima do investimento ` +
        `direto no ${cfg.etfName}${crossover}`
      : `a estratégia híbrida termina ${formatEur(Math.abs(delta))} abaixo do ` +
        `investimento direto no ${cfg.etfName}`;

  steps.push({
    title: '5. O resultado',
    body:
      `Com ${formatRate(cfg.etfReturn)} de rendibilidade no ${cfg.etfName} e ` +
      `${formatRate(cfg.pprReturn)} no ${cfg.pprName}, ${verdict}. A diferença de ` +
      `rendibilidade entre os dois produtos pesa mais do que a vantagem fiscal em ` +
      `horizontes longos: ponha as duas rendibilidades iguais para isolar só o ` +
      `efeito fiscal.`,
  });

  return steps;
}
