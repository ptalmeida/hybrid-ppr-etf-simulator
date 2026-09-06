import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { useUrlConfig } from './hooks/useUrlConfig';
import { simulate } from './lib/engine';
import { buildExplanation } from './lib/explain';
import { ConfigPanel } from './components/ConfigPanel';
import { ComparisonTable } from './components/ComparisonTable';
import {
  MobileConfigBar,
  MobileConfigSheet,
} from './components/MobileConfigDrawer';
import { Explanation } from './components/Explanation';
import { Card } from './components/Card';
import { ScaleToggle } from './components/ScaleToggle';
import { RedemptionLedger } from './components/RedemptionLedger';
import {
  Disclaimer,
  LegalityNote,
  RiskEquivalenceWarning,
  RedirectedNote,
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const panel = (
    <ConfigPanel
      config={config}
      onChange={update}
      onReset={reset}
      onCopyLink={copyLink}
      copied={copied}
      coverage={coverage}
      lastUsefulPprYear={output.lastUsefulPprYear}
      wastedContributions={hybrid.final.contributionsWithoutBenefit}
    />
  );

  return (
    <div className="pb-20 lg:pb-0">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-2.5">
            <LineChart
              size={16}
              className="shrink-0 translate-y-0.5 text-brand-600 dark:text-brand-500"
            />
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              PPR + crédito habitação{' '}
              <span className="font-normal text-slate-400">vs.</span> ETF
            </h1>
            <span className="label hidden sm:inline">
              simulador · Portugal · 2026
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-[0.8125rem] leading-snug text-slate-500 dark:text-slate-400">
            Entregar ao PPR para captar o benefício de IRS, resgatá-lo a 8% para
            pagar prestações do crédito habitação e reinvestir a folga no ETF —
            comparado com investir tudo diretamente no ETF.{' '}
            <span className="text-slate-400 dark:text-slate-500">
              A híbrida nem sempre ganha: comissões altas, desvio face ao índice,
              não reinvestir a folga ou não chegar a ter crédito chegam para a
              pôr atrás.
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">

      <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* On a phone the panel lives in a sheet instead, reachable from the
            sticky bar — see MobileConfigDrawer for why. */}
        <aside className="hidden lg:sticky lg:top-5 lg:block lg:self-start">
          {panel}
        </aside>

        <main className="min-w-0 space-y-5">
          <ComparisonTable scenarios={output.scenarios} />

          {/* Warn only when money is actually stuck. The mortgage ending
              before 60 is just a fact; it is only a problem if a balance is
              left behind, which redirecting the contributions prevents. */}
          {hybrid.final.mortgageEndYear !== null &&
            hybrid.final.pprAfterMortgageEnds &&
            (hybrid.final.penalisedExit ? (
              <StrandedPprWarning
                pprName={config.pprName}
                etfName={config.etfName}
                mortgageEndYear={hybrid.final.mortgageEndYear}
                ageAtMortgageEnd={
                  config.currentAge + hybrid.final.mortgageEndYear - 1
                }
                strandedValue={hybrid.rows.at(-1)?.pprBalance ?? 0}
                clawback={hybrid.final.benefitClawback}
              />
            ) : (
              config.afterMortgage !== 'ppr' && (
                <RedirectedNote
                  pprName={config.pprName}
                  mortgageEndYear={hybrid.final.mortgageEndYear}
                  afterMortgage={config.afterMortgage}
                />
              )
            ))}

          {config.hasMortgage && (
            <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              A mesma prestação é devida em todos os cenários — a casa é a
              mesma. No cenário só com {config.etfName} ela sai inteira do
              salário; na estratégia híbrida parte dela é paga pelo{' '}
              {config.pprName}
              {config.reinvestRedemption
                ? ', e essa folga do salário é investida no ETF. É por isso que a linha «Total» de «sai do seu bolso» é igual nas duas colunas: a comparação é justa.'
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
              mortgageStartYear={config.hasMortgage ? config.mortgageStartYear : null}
              mortgageEndYear={hybrid.final.mortgageEndYear}
              yearAt60={60 - config.currentAge + 1}
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
            subtitle="De onde vem o valor final: o que entrou, o que o mercado acrescentou, e o que o imposto levou."
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

          <RedemptionLedger
            entries={hybrid.redemptions}
            pprName={config.pprName}
          />

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

      <MobileConfigBar
        delta={hybrid.final.netWithBenefits - etf.final.netWithBenefits}
        onOpen={() => setSettingsOpen(true)}
      />
      <MobileConfigSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        {panel}
      </MobileConfigSheet>
    </div>
  );
}
