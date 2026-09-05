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
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Comissões do PPR
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Um PPR cobra várias comissões ao mesmo tempo, e todas se somam. No
              mercado português a comissão de subscrição ronda em média os 3% e
              chega aos 5,9%; a de gestão anda entre 0,75% e 1%; o depositário
              vai até 0,08%; e os fundos que o PPR tem lá dentro cobram os seus
              próprios custos correntes, tipicamente 0,09% a 0,6%.
            </p>
            <NumberField
              id="pprSubscriptionFee"
              label="Comissão de subscrição"
              suffix="%"
              step={0.1}
              min={BOUNDS.pprSubscriptionFee[0]}
              max={BOUNDS.pprSubscriptionFee[1]}
              value={config.pprSubscriptionFee}
              onChange={(pprSubscriptionFee) => onChange({ pprSubscriptionFee })}
              hint="Cobrada sobre cada entrega, antes de o dinheiro chegar ao plano. A dedução de IRS continua a ser calculada sobre o valor que entregou, não sobre o que sobra."
            />
            <NumberField
              id="pprFee"
              label="Comissão de gestão"
              suffix="% / ano"
              step={0.01}
              min={BOUNDS.pprFee[0]}
              max={BOUNDS.pprFee[1]}
              value={config.pprFee}
              onChange={(pprFee) => onChange({ pprFee })}
            />
            <NumberField
              id="pprDepositaryFee"
              label="Comissão de depósito"
              suffix="% / ano"
              step={0.01}
              min={BOUNDS.pprDepositaryFee[0]}
              max={BOUNDS.pprDepositaryFee[1]}
              value={config.pprDepositaryFee}
              onChange={(pprDepositaryFee) => onChange({ pprDepositaryFee })}
              hint="Paga ao depositário dos títulos. Pequena, mas cobrada todos os anos."
            />
            <NumberField
              id="pprUnderlyingFee"
              label="Custos correntes dos fundos subjacentes"
              suffix="% / ano"
              step={0.01}
              min={BOUNDS.pprUnderlyingFee[0]}
              max={BOUNDS.pprUnderlyingFee[1]}
              value={config.pprUnderlyingFee}
              onChange={(pprUnderlyingFee) => onChange({ pprUnderlyingFee })}
              hint="Um PPR baseado em ETF paga também o TER dos ETF que tem em carteira — uma camada de custo por cima da comissão de gestão, que muitas comparações esquecem."
            />
            <NumberField
              id="pprRedemptionFee"
              label="Comissão de reembolso"
              suffix="%"
              step={0.1}
              min={BOUNDS.pprRedemptionFee[0]}
              max={BOUNDS.pprRedemptionFee[1]}
              value={config.pprRedemptionFee}
              onChange={(pprRedemptionFee) => onChange({ pprRedemptionFee })}
            />
            <NumberField
              id="pprRedemptionFeeYears"
              label="…aplicada a unidades com menos de"
              suffix="anos"
              step={1}
              min={BOUNDS.pprRedemptionFeeYears[0]}
              max={BOUNDS.pprRedemptionFeeYears[1]}
              value={config.pprRedemptionFeeYears}
              onChange={(pprRedemptionFeeYears) =>
                onChange({ pprRedemptionFeeYears })
              }
              hint="Muitos PPR só cobram reembolso no primeiro ano. Como os resgates para o crédito exigem cinco anos de antiguidade, um limite de 1 ano nunca chega a ser aplicado."
            />
            <NumberField
              id="pprTrackingError"
              label="Desvio face ao índice"
              suffix="% / ano"
              step={0.1}
              min={BOUNDS.pprTrackingError[0]}
              max={BOUNDS.pprTrackingError[1]}
              value={config.pprTrackingError}
              onChange={(pprTrackingError) => onChange({ pprTrackingError })}
              hint="Não é uma comissão, mas custa o mesmo: a rendibilidade real pode ficar abaixo do índice que o PPR diz seguir. Numa análise da comunidade a um PPR popular baseado em ETF, esse desvio rondava 2,6% ao ano — sozinho, o suficiente para anular toda a vantagem fiscal."
            />
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Custos do ETF
            </h3>
            <NumberField
              id="etfFee"
              label="TER do fundo"
              suffix="% / ano"
              step={0.01}
              min={BOUNDS.etfFee[0]}
              max={BOUNDS.etfFee[1]}
              value={config.etfFee}
              onChange={(etfFee) => onChange({ etfFee })}
            />
            <NumberField
              id="etfCustodyFee"
              label="Custódia da corretora"
              suffix="% / ano"
              step={0.01}
              min={BOUNDS.etfCustodyFee[0]}
              max={BOUNDS.etfCustodyFee[1]}
              value={config.etfCustodyFee}
              onChange={(etfCustodyFee) => onChange({ etfCustodyFee })}
              hint="Algumas corretoras cobram custódia em percentagem do valor da carteira."
            />
            <NumberField
              id="etfBuyFee"
              label="Comissão de compra"
              suffix="%"
              step={0.01}
              min={BOUNDS.etfBuyFee[0]}
              max={BOUNDS.etfBuyFee[1]}
              value={config.etfBuyFee}
              onChange={(etfBuyFee) => onChange({ etfBuyFee })}
              hint="Inclua aqui o spread cambial se comprar em dólares."
            />
            <NumberField
              id="etfBuyFeeFixed"
              label="Comissão fixa por compra"
              suffix="€"
              step={0.5}
              min={BOUNDS.etfBuyFeeFixed[0]}
              max={BOUNDS.etfBuyFeeFixed[1]}
              value={config.etfBuyFeeFixed}
              onChange={(etfBuyFeeFixed) => onChange({ etfBuyFeeFixed })}
              hint="Pesa muito mais em entregas pequenas do que em entregas grandes."
            />
            <NumberField
              id="etfSellFee"
              label="Comissão de venda"
              suffix="%"
              step={0.01}
              min={BOUNDS.etfSellFee[0]}
              max={BOUNDS.etfSellFee[1]}
              value={config.etfSellFee}
              onChange={(etfSellFee) => onChange({ etfSellFee })}
            />
            <NumberField
              id="etfAnnualCost"
              label="Custos anuais fixos"
              suffix="€ / ano"
              step={1}
              min={BOUNDS.etfAnnualCost[0]}
              max={BOUNDS.etfAnnualCost[1]}
              value={config.etfAnnualCost}
              onChange={(etfAnnualCost) => onChange({ etfAnnualCost })}
              hint="Conectividade, manutenção de conta, comissões de bolsa."
            />
          </div>

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
            id="redeemYoungEntregas"
            label="Resgatar também entregas com menos de 5 anos"
            value={config.redeemYoungEntregas}
            onChange={(redeemYoungEntregas) => onChange({ redeemYoungEntregas })}
            hint="O art. 4.º/3 do DL 158/2002 permite-o (regra dos 35%), mas o art. 21.º/4 do EBF é avaliado à parte e exige cinco anos sobre a RESPETIVA entrega — «e», não «ou». Resgatar uma entrega mais nova devolve a dedução dessa entrega, majorada em 10% por cada ano. Na prática as gestoras também só aceitam montantes entregues há mais de cinco anos. Ligue apenas para ver quanto custa a tentativa."
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
              <strong>Devolução do benefício</strong> — art. 21.º/4 do EBF. A
              dedução só sobrevive se tiverem decorrido pelo menos 5 anos sobre
              a <em>respetiva</em> entrega <em>e</em> ocorrer uma das situações
              da lei. As duas condições são avaliadas em separado do DL
              158/2002: um resgate pode ser permitido e mesmo assim custar a
              devolução do benefício, majorado em 10% por cada ano.
            </p>
            <p>
              <strong>Como é feito o pedido</strong> — o reembolso é entregue
              diretamente à instituição de crédito, nunca ao participante, e o
              pedido deve ser apresentado com pelo menos 10 dias úteis de
              antecedência sobre o vencimento da prestação. A gestora não pode
              cobrar comissões pelo processamento deste reembolso.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
