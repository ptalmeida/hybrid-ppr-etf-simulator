# Simulador PPR + Crédito Habitação vs ETF

Simulador educativo que compara duas estratégias de investimento de longo prazo
para residentes fiscais em Portugal que contam ter crédito habitação.

**Não é aconselhamento financeiro.** As regras fiscais implementadas são as
vigentes em 2026 e mudam com frequência.

## As duas estratégias

1. **Só ETF** — entregas anuais num ETF de acumulação, com o crédito habitação
   pago inteiramente do salário.
2. **Híbrida** — entregas num PPR para captar a dedução de 20% no IRS, resgate a
   8% para pagar prestações do crédito habitação, e reinvestimento no ETF da
   folga que isso liberta no salário.

A híbrida não ganha sempre. Uma comissão de gestão alta, um desvio face ao
índice, não reinvestir a folga, ou não chegar a ter crédito habitação chegam
para a pôr atrás — e o simulador mostra-o.

Toda a configuração vive na query string, por isso qualquer resultado se partilha
com um link. O «extrato dos resgates» lista movimento a movimento que entrega foi
resgatada em que ano, com que antiguidade e com que imposto — e pode ser copiado
em CSV para conferir as contas por fora.

## Correr localmente

```bash
npm install
npm run dev
```

Outros comandos:

```bash
npm test          # 218 testes da lógica fiscal
npm run build     # build de produção para dist/
```

## Como está organizado

```
src/lib/       lógica pura, sem React
  tax.ts       constantes e primitivas fiscais — mude aqui quando a lei mudar
  tranches.ts  operações FIFO sobre entradas (crescer, resgatar, liquidar)
  engine.ts    o ciclo anual que produz os três cenários
  url.ts       configuração <-> query string
  fees.ts      motor de comissões: regras com condições, não só percentagens
  waterfall.ts decomposição do resultado, testada contra o cartão
  explain.ts   texto gerado a partir do resultado
src/components/  apresentação apenas, recebe dados já calculados
```

`src/lib/` nunca importa de `src/components/`. A função `simulate()` é pura: a
mesma configuração produz sempre o mesmo resultado, e é isso que permite que o
link contenha o resultado inteiro.

## Regras fiscais implementadas

| Regra | Base legal |
|---|---|
| Mais-valias de ETF a 28%, com exclusão de 10%/20%/30% por prazo (25,2%, 22,4% e 19,6% efetivos) | CIRS art. 43.º/5, Lei n.º 31/2024 |
| FIFO na alienação de valores mobiliários | CIRS art. 43.º |
| Resgate do PPR para prestações de crédito habitação | DL 158/2002 art. 4.º/1 g) |
| Cada entrega resgatável 5 anos depois | DL 158/2002 art. 4.º/2 |
| Regra dos 35%: resgate total 5 anos após a primeira entrega | DL 158/2002 art. 4.º/3 |
| Devolução da dedução se a entrega tiver menos de 5 anos | EBF art. 21.º/4 |
| Resgate pela alínea g) só enquanto o crédito durar; depois, só aos 60 | DL 158/2002 art. 4.º/1 e) e g) |
| Resgate em condições legais: 2/5 do rendimento a 20% (8% efetivo) | EBF art. 21.º/3 |
| Fora das condições legais: 21,5% / 17,2% / 8,6% | EBF art. 21.º, CIRS art. 5.º/3 |
| Dedução à coleta: 20% até 400 €/350 €/300 € por idade | EBF art. 21.º |
| Devolução de benefícios majorada em 10%/ano | EBF art. 21.º |

Duas notas sobre pontos onde as comparações publicadas costumam errar:

- **A exclusão da Lei 31/2024 não exige englobamento.** Aplica-se
  automaticamente sobre a taxa autónoma de 28%. O englobamento continua opcional
  e só compensa com taxa marginal inferior a 28%.
- **O resgate em condições legais é 8% independentemente do prazo.** A escada
  21,5% / 17,2% / 8,6% é a das situações *fora* das condições legais.
- **Não dá para depositar e resgatar a seguir.** O art. 4.º/3 (regra dos 35%)
  chega a permitir resgatar a totalidade cinco anos após a *primeira* entrega,
  mas o EBF art. 21.º/4 é avaliado de forma independente e exige cinco anos
  sobre a **respetiva** entrega **e** uma das situações da lei — «e», não «ou».
  Resgatar uma entrega mais nova devolve a dedução majorada em 10% por cada
  ano. As gestoras aplicam diretamente o critério mais exigente. O PPR carrega
  por isso sempre as últimas cinco entregas, e a última entrega útil é a de
  cinco anos antes do fim do crédito.

## Comissões

Os PPR cobram várias comissões em simultâneo e todas se somam. O simulador
modela cada camada em separado:

| Camada | Como é cobrada | Valores típicos |
|---|---|---|
| Subscrição | sobre cada entrega | média 3%, até 5,9%; 0% nos PPR ETF |
| Gestão | % ao ano sobre o valor | 0,75% a 1% |
| Depósito | % ao ano sobre a carteira | até 0,08% |
| Fundos subjacentes | % ao ano, por dentro | 0,09% a 0,6% num PPR de ETF |
| Reembolso | % do valor resgatado | até 1%, tipicamente só no 1.º ano |
| Desvio face ao índice | perda de rendibilidade | 0 a ~2,6% observados |

Do lado do ETF: TER, custódia em percentagem, comissão de compra (percentual e
fixa), comissão de venda e custos anuais fixos.

### Comissões irregulares

Os campos acima cobrem o caso comum. As comissões que não cabem num número —
escalões por saldo, degraus por antiguidade, promoções de duração limitada,
comissões de performance, valores fixos em euros — são descritas como regras em
`extraFees`, com condições (`minBalance`, `maxBalance`, `minAgeYears`,
`maxAgeYears`, `fromYear`, `toYear`, `hurdlePct`). O motor aplica os dois pelo
mesmo caminho: os campos simples são convertidos em regras antes de qualquer
cálculo.

Exemplo real — a comissão de gestão da Golden SGF muda de classe conforme o
saldo:

```ts
extraFees: [
  { label: 'Classe Start', product: 'ppr', basis: 'annual', pct: 1, maxBalance: 10000 },
  { label: 'Classe Plus', product: 'ppr', basis: 'annual', pct: 0.75, minBalance: 10000 },
]
```

A dedução de IRS incide sobre o valor **entregue**, não sobre o que sobra depois
da comissão de subscrição.

## O que o simulador não modela

Rendibilidades constantes e determinísticas, inflação, escalões progressivos de
IRS, o limite global de deduções à coleta, a coleta disponível, amortização do
crédito, e o risco de sequência de rendibilidades.

Sobretudo: **não sabe se os dois produtos que está a comparar têm risco
equivalente.** Um ETF do S&P 500 é 100% ações; os PPR portugueses são
tipicamente carteiras mistas. Para isolar o efeito fiscal, ponha as duas
rendibilidades iguais.

## Publicar

Um push para `main` publica automaticamente no GitHub Pages através de
`.github/workflows/deploy.yml`. Nas definições do repositório, em Pages, escolha
"GitHub Actions" como origem.

## Documentação

- [Especificação](docs/superpowers/specs/2026-09-04-hybrid-ppr-etf-simulator-design.md)
  — decisões de design e as fontes legais consultadas.
- [Plano de implementação](docs/superpowers/plans/2026-09-04-hybrid-ppr-etf-simulator.md)
