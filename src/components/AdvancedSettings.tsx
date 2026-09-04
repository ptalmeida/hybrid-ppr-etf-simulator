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
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
            label="Desvio face ao índice do PPR"
            suffix="%"
            step={0.1}
            min={BOUNDS.pprTrackingError[0]}
            max={BOUNDS.pprTrackingError[1]}
            value={config.pprTrackingError}
            onChange={(pprTrackingError) => onChange({ pprTrackingError })}
            hint="A rendibilidade real de um PPR pode ficar bastante abaixo do índice que diz seguir, para além da comissão de gestão. Numa análise da comunidade a um PPR popular baseado em ETF, esse desvio rondava 2,6% ao ano — sozinho, o suficiente para anular toda a vantagem fiscal. Fica a 0 por omissão para o simulador não tomar partido."
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
            id="contributionTiming"
            label="Quando entra o dinheiro"
            value={config.contributionTiming}
            onChange={(contributionTiming) => onChange({ contributionTiming })}
            options={[
              { value: 'start', label: 'No início de cada ano' },
              { value: 'end', label: 'No fim de cada ano' },
            ]}
            hint="Muda o resultado final em cerca de um ano inteiro de rendibilidade — perto de 6% ao fim de 30 anos. Aplica-se de igual forma a todos os cenários, por isso não distorce a comparação, mas altera os valores absolutos. Entregas de PPR feitas em dezembro para apanhar o benefício fiscal aproximam-se mais do fim do ano."
          />

          <hr className="border-slate-200 dark:border-slate-800" />

          <SelectField
            id="etfTaxMode"
            label="Tributação das mais-valias do ETF"
            value={config.etfTaxMode}
            onChange={(etfTaxMode) => onChange({ etfTaxMode })}
            options={[
              {
                value: 'ladder',
                label: '28% com exclusões por prazo (Lei 31/2024)',
              },
              { value: 'flat28', label: '28% fixo, sem exclusões' },
              { value: 'englobamento', label: 'Englobamento à taxa marginal' },
            ]}
            hint="A Lei 31/2024 exclui de tributação 10% da mais-valia entre 2 e 5 anos, 20% entre 5 e 8 anos e 30% a partir de 8 anos. Aplica-se automaticamente sobre a taxa autónoma de 28%, dando taxas efetivas de 25,2%, 22,4% e 19,6% — e não exige englobamento. Ações fracionadas, derivados e criptoativos não beneficiam da exclusão: nesses casos escolha 28% fixo."
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
            label="Aplicar a regra dos 35%"
            value={config.use35Rule}
            onChange={(use35Rule) => onChange({ use35Rule })}
            hint="Art. 4.º/3 do DL 158/2002: passados 5 anos sobre a PRIMEIRA entrega pode resgatar a totalidade do PPR, desde que as entregas da primeira metade do contrato representem pelo menos 35% do total. Com entregas anuais constantes essa fração é sempre 50%, pelo que a condição se verifica. Desligue para exigir que cada entrega tenha 5 anos (art. 4.º/2)."
          />
          <ToggleField
            id="irsBandsEnabled"
            label="Escalonar o limite do benefício por idade"
            value={config.irsBandsEnabled}
            onChange={(irsBandsEnabled) => onChange({ irsBandsEnabled })}
            hint="20% das entregas, até 400 € abaixo dos 35 anos, 350 € dos 35 aos 50 (inclusive) e 300 € acima dos 50 (art. 21.º do EBF). Está ainda sujeito ao limite global de deduções à coleta e à coleta disponível, que o simulador não modela."
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
              <strong>Resgate para o crédito habitação</strong> — alínea g) do
              art. 4.º do DL 158/2002. Permite pagar prestações vencidas e cada
              prestação vincenda na data em que se vence. Não permite amortizar
              capital: o regime excecional que o permitia terminou a 31 de
              dezembro de 2024. Por isso o resgate anual está limitado a 12
              prestações.
            </p>
            <p>
              <strong>Tributação do resgate</strong> — art. 21.º/3 do EBF. Nas
              condições legais só 2/5 do rendimento é tributado, à taxa de 20%:
              uma taxa efetiva de 8% sobre o lucro, independentemente do prazo.
            </p>
            <p>
              <strong>Fora das condições legais</strong> — 21,5% sobre a
              totalidade do rendimento até 5 anos, sobre 80% entre 5 e 8 anos
              (17,2% efetivo) e sobre 40% acima de 8 anos (8,6% efetivo), mais a
              devolução dos benefícios recebidos majorados em 10% por cada ano.
            </p>
            <p>
              <strong>Devolução do benefício</strong> — não há devolução quando o
              resgate é feito nas condições legais e pelo menos 5 anos após a
              entrega. Todos os resgates simulados cumprem as duas condições.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
