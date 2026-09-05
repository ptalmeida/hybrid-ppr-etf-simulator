import { Link2, RotateCcw } from 'lucide-react';
import { NumberField, SelectField, TextField, ToggleField } from './Field';
import { AdvancedSettings } from './AdvancedSettings';
import { Card } from './Card';
import { BOUNDS, DEFAULT_CONFIG, MAX_NAME_LENGTH } from '../lib/defaults';
import { formatEur, formatPct } from '../lib/format';
import type { SimConfig } from '../lib/types';

/** How much of the instalment the PPR actually manages to cover. */
export interface Coverage {
  avgPerYear: number;
  annualDue: number;
  share: number;
  contributedPerYear: number;
}

interface Props {
  config: SimConfig;
  onChange: (patch: Partial<SimConfig>) => void;
  onReset: () => void;
  onCopyLink: () => void;
  copied: boolean;
  coverage: Coverage | null;
  lastUsefulPprYear: number | null;
}

export function ConfigPanel({
  config,
  onChange,
  onReset,
  onCopyLink,
  copied,
  coverage,
  lastUsefulPprYear,
}: Props) {
  const isDefault =
    JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG);

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
              {
                value: 'maxDeductible',
                label: 'O máximo dedutível para a idade',
              },
            ]}
            hint={
              config.contributionMode === 'maxDeductible'
                ? 'Entrega 2000 €, 1750 € ou 1500 € consoante a idade — exatamente o valor cujos 20% atingem o limite do benefício. Entregar mais não dá dedução adicional.'
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
          <ToggleField
            id="hasMortgage"
            label="Vou ter crédito habitação"
            value={config.hasMortgage}
            onChange={(hasMortgage) => onChange({ hasMortgage })}
            hint={
              config.hasMortgage
                ? undefined
                : `Sem crédito habitação não há resgates a 8%. O ${config.pprName} só sai em condições legais a partir dos 60 anos; antes disso paga 21,5% / 17,2% / 8,6% conforme o prazo e devolve os benefícios de IRS majorados em 10% por ano.`
            }
          />
          {config.hasMortgage && (
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
          )}
          {config.hasMortgage && (
          <NumberField
            id="mortgageYears"
            label="Duração do crédito"
            suffix="anos"
            min={BOUNDS.mortgageYears[0]}
            max={BOUNDS.mortgageYears[1]}
            value={config.mortgageYears}
            onChange={(mortgageYears) => onChange({ mortgageYears })}
            hint="Quando o crédito acaba, a alínea g) deixa de existir e o PPR só volta a ter saída sem penalização aos 60 anos."
          />
          )}
          {config.hasMortgage && (
          <NumberField
            id="monthlyInstalment"
            label="Prestação mensal"
            suffix="€"
            step={25}
            min={BOUNDS.monthlyInstalment[0]}
            max={BOUNDS.monthlyInstalment[1]}
            value={config.monthlyInstalment}
            onChange={(monthlyInstalment) => onChange({ monthlyInstalment })}
            hint={
              coverage === null ? (
                'Limita o resgate anual do PPR a 12 prestações, porque a lei só permite pagar prestações à medida que se vencem.'
              ) : (
                <>
                  <span className="block">
                    Nos anos com crédito, o {config.pprName} cobre em média{' '}
                    <strong>{formatEur(coverage.avgPerYear)}</strong> dos{' '}
                    {formatEur(coverage.annualDue)} de prestações —{' '}
                    <strong>{formatPct(coverage.share)}</strong>. O resto sai do
                    salário.
                  </span>
                  {coverage.share < 0.95 && (
                    <span className="mt-1 block">
                      Subir a prestação já não aumenta o benefício: o{' '}
                      {config.pprName} só pode entregar o que tem, e recebe
                      apenas {formatEur(coverage.contributedPerYear)} por ano.
                      Para aproveitar uma prestação maior teria de aumentar a
                      entrega anual.
                    </span>
                  )}
                </>
              )
            }
          />
          )}
          {config.hasMortgage && (
            <SelectField
              id="afterMortgage"
              label="Quando o crédito acabar"
              value={config.afterMortgage}
              onChange={(afterMortgage) => onChange({ afterMortgage })}
              options={[
                { value: 'etf', label: `Passar a investir no ${config.etfName}` },
                { value: 'ppr', label: `Continuar a entregar ao ${config.pprName}` },
                { value: 'stop', label: 'Parar de investir' },
              ]}
              hint={
                lastUsefulPprYear === null ? undefined : (
                  <>
                    A última entrega ao {config.pprName} que ainda consegue sair
                    pela alínea g) é a do{' '}
                    <strong>ano {lastUsefulPprYear}</strong>
                    {config.redeemYoungEntregas
                      ? ' — o último ano do crédito, mas as entregas com menos de cinco anos devolvem a dedução de IRS majorada.'
                      : ' — cinco anos antes do fim do crédito, porque cada entrega tem de ter cinco anos para o benefício sobreviver.'}
                  </>
                )
              }
            />
          )}
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
            hint="Não é uma regra fiscal — é uma decisão sua, e é a que mais altera o resultado. Comparações publicadas divergem entre si por várias vezes só por causa dela."
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
          disabled={isDefault}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw size={16} />
          Repor
        </button>
      </div>
    </div>
  );
}
