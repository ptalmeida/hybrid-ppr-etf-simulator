import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { useUrlConfig } from './hooks/useUrlConfig';
import { simulate } from './lib/engine';
import { buildExplanation } from './lib/explain';
import { ConfigPanel } from './components/ConfigPanel';
import { SummaryCards } from './components/SummaryCards';
import { Explanation } from './components/Explanation';
import { Card } from './components/Card';
import { ScaleToggle } from './components/ScaleToggle';
import {
  Disclaimer,
  LegalityNote,
  RiskEquivalenceWarning,
  StrandedPprWarning,
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

  // How much of the instalment the PPR actually covers. Raising the instalment
  // beyond what the PPR can supply changes nothing, and the panel says so.
  const coverage = useMemo(() => {
    const annualDue = config.monthlyInstalment * 12;
    const years = hybrid.rows.filter((r) => r.redeemedThisYear > 0).length;
    if (!config.hasMortgage || annualDue <= 0 || years === 0) return null;
    const avgPerYear = hybrid.final.mortgagePaidTotal / years;
    return {
      avgPerYear,
      annualDue,
      share: avgPerYear / annualDue,
      contributedPerYear: hybrid.final.totalContributed / config.years,
    };
  }, [config, hybrid]);

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
          Compara duas estratégias de longo prazo para quem vive em Portugal e
          conta ter crédito habitação: investir tudo diretamente num ETF, ou a
          estratégia híbrida — entregar ao PPR para captar o benefício de IRS,
          resgatá-lo a 8% para pagar as prestações, e reinvestir no ETF tudo o
          que isso liberta.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          A híbrida nem sempre ganha. Uma comissão de gestão alta, um desvio face
          ao índice, não reinvestir a folga, ou não chegar a ter crédito
          habitação chegam para a pôr atrás. Mexa nos parâmetros e veja onde a
          vantagem desaparece.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* results first on mobile: a visitor should see the comparison
            before a long form. Side by side from lg up. */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-6 lg:self-start">
          <ConfigPanel
            config={config}
            onChange={update}
            onReset={reset}
            onCopyLink={copyLink}
            copied={copied}
            coverage={coverage}
          />
        </aside>

        <main className="order-1 min-w-0 space-y-6 lg:order-2">
          <SummaryCards scenarios={output.scenarios} />

          {hybrid.final.pprAfterMortgageEnds &&
            hybrid.final.mortgageEndYear !== null && (
              <StrandedPprWarning
                pprName={config.pprName}
                mortgageEndYear={hybrid.final.mortgageEndYear}
                ageAtMortgageEnd={
                  config.currentAge + hybrid.final.mortgageEndYear - 1
                }
              />
            )}

          {config.hasMortgage && (
            <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              A mesma prestação é devida em todos os cenários — a casa é a
              mesma. No cenário só com {config.etfName} ela sai inteira do
              salário; na estratégia híbrida parte dela é paga pelo{' '}
              {config.pprName}
              {config.reinvestRedemption
                ? ', e essa folga do salário é investida no ETF. É por isso que a linha «Total» de «sai do seu bolso» é igual nos dois cartões: a comparação é justa.'
                : ', e essa folga do salário é gasta. Repare que o total que sai do bolso passa a ser menor na estratégia híbrida — está a comparar cenários que lhe custam valores diferentes.'}
            </p>
          )}

          <Card
            title="Evolução do património"
            subtitle="Valor total criado por cada estratégia — carteira líquida de imposto, mais as prestações pagas e os benefícios recebidos que não foram reinvestidos."
            action={
              <ScaleToggle
                value={config.logScale}
                onChange={(logScale) => update({ logScale })}
              />
            }
          >
            <WealthChart
              scenarios={output.scenarios}
              mortgageStartYear={config.mortgageStartYear}
              logScale={config.logScale}
            />
            {config.logScale && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Numa escala logarítmica, distâncias iguais são variações
                percentuais iguais. Os primeiros anos deixam de ficar esmagados
                contra a base e passa a ver-se a <em>taxa</em> de crescimento:
                linhas paralelas crescem ao mesmo ritmo, independentemente da
                distância entre elas.
              </p>
            )}
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

          {config.hasMortgage && <LegalityNote pprName={config.pprName} />}
          <RiskEquivalenceWarning />
          <WhatThisCannotPrice />
          <Disclaimer />
        </main>
      </div>
    </div>
  );
}
