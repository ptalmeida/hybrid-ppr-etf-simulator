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
        {/* results first on mobile: a visitor should see the comparison
            before a long form. Side by side from lg up. */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-6 lg:self-start">
          <ConfigPanel
            config={config}
            onChange={update}
            onReset={reset}
            onCopyLink={copyLink}
            copied={copied}
          />
        </aside>

        <main className="order-1 min-w-0 space-y-6 lg:order-2">
          <SummaryCards scenarios={output.scenarios} />

          <RiskEquivalenceWarning />

          <Card
            title="Evolução do património"
            subtitle="Valor total criado por cada estratégia — carteira líquida de imposto, mais as prestações pagas e os benefícios recebidos que não foram reinvestidos."
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
