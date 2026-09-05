import { AlertTriangle, Info } from 'lucide-react';
import { formatEur } from '../lib/format';

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
          Um ETF do S&amp;P 500 é 100% ações. Os PPR portugueses são normalmente
          carteiras mistas — um PPR popular baseado em ETF anda à volta de 75%
          ações, 22,5% obrigações e 2,5% monetário. Uma rendibilidade esperada
          mais baixa é a <em>consequência</em> de menos risco, não um defeito do
          produto.
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
            <strong>Concentração.</strong> O PPR liga a reforma e a estratégia do
            crédito à mesma entidade.
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

/**
 * Shown when the mortgage finishes before the participant turns 60, which
 * closes the only cheap exit the PPR had.
 */
export function StrandedPprWarning({
  pprName,
  etfName,
  mortgageEndYear,
  ageAtMortgageEnd,
  strandedValue,
  clawback,
}: {
  pprName: string;
  etfName: string;
  mortgageEndYear: number;
  ageAtMortgageEnd: number;
  strandedValue: number;
  clawback: number;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <AlertTriangle
        size={18}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
      />
      <div className="space-y-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
        <p className="font-semibold">
          Ficam {formatEur(strandedValue)} presos no {pprName}.
        </p>
        <p>
          O crédito acaba no ano {mortgageEndYear}, quando tiver{' '}
          {ageAtMortgageEnd} anos. A alínea g) só permite resgatar enquanto
          houver prestações por pagar, e os 60 anos da alínea e) ainda vão
          longe, por isso este saldo sai fora das condições legais: 21,5% /
          17,2% / 8,6% conforme o prazo, mais {formatEur(clawback)} de
          benefícios de IRS devolvidos e majorados em 10% por cada ano.
        </p>
        <p>
          Em «quando o crédito acabar», passar as entregas para o {etfName} — ou
          simplesmente parar — evita isto por completo.
        </p>
      </div>
    </div>
  );
}

/**
 * The reassuring counterpart: the mortgage still ends before 60, but the
 * contributions were redirected in time, so nothing is stuck.
 */
export function RedirectedNote({
  pprName,
  mortgageEndYear,
  afterMortgage,
}: {
  pprName: string;
  mortgageEndYear: number;
  afterMortgage: 'etf' | 'stop';
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
      <Info size={18} className="mt-0.5 shrink-0 text-slate-500" />
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        O crédito acaba no ano {mortgageEndYear} e, a partir daí, o {pprName}{' '}
        deixaria de ter saída sem penalização antes dos 60 anos.{' '}
        {afterMortgage === 'etf'
          ? 'Como escolheu passar as entregas para o ETF nessa altura, não fica nada preso.'
          : 'Como escolheu parar de investir nessa altura, não fica nada preso.'}
      </p>
    </div>
  );
}

/**
 * Answers the question every reader of the rules eventually asks: does the
 * 35% condition block this strategy? It does not.
 */
export function LegalityNote({ pprName }: { pprName: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
      <Info size={18} className="mt-0.5 shrink-0 text-slate-500" />
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <p className="font-semibold">
          Cada entrega tem de ter cinco anos. Não dá para depositar e resgatar a
          seguir.
        </p>
        <p>
          Duas regras diferentes têm de se verificar ao mesmo tempo, e são
          avaliadas de forma independente. O <strong>DL 158/2002</strong> diz se
          o resgate é <em>permitido</em>; o <strong>EBF</strong> diz se fica com
          a dedução de IRS.
        </p>
        <p>
          O art. 4.º/3 do DL 158/2002 — a regra dos 35% — chega a permitir
          resgatar a totalidade cinco anos após a primeira entrega. Mas o art.
          21.º/4 do EBF exige que tenham decorrido cinco anos{' '}
          <strong>sobre a respetiva entrega</strong> <em>e</em> que ocorra uma
          das situações da lei. É «e», não «ou». Resgatar uma entrega mais nova
          continua a ser legal, mas devolve a dedução dessa entrega majorada em
          10% por cada ano — o que anula o motivo de a ter feito.
        </p>
        <p>
          Na prática as gestoras aplicam diretamente o critério mais exigente:
          «só podem ser usados montantes entregues há mais de cinco anos». Por
          isso o {pprName} nunca fica vazio — carrega sempre as últimas cinco
          entregas, à espera de amadurecer.
        </p>
        <p>
          Consequência prática: a última entrega que ainda consegue sair pela
          alínea g) é a de <strong>cinco anos antes do fim do crédito</strong>,
          não a do último ano.
        </p>
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
      profissional. Base legal: DL 158/2002 (art. 4.º), EBF (art. 21.º), CIRS
      (art. 5.º/3 e 43.º/5) e Lei n.º 31/2024.
    </p>
  );
}
