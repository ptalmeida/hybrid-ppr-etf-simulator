# Research: retornos esperados de longo prazo (20-40 anos)

Pesquisa realizada em 2026-09-05. Objetivo: substituir o uso de janelas históricas curtas (2,8 a 5
anos, ver `docs/research/etfs.md` e `docs/research/pprs.md`) como previsão implícita de retorno, por
uma estimativa **prospetiva, nominal, em EUR, para um horizonte de 20-40 anos** — o horizonte real de
um PPR ou de um plano de reforma via ETF.

**Porque isto importa**: uma janela de 2,8 anos (out 2023 → jul 2026) anualizou para ~12,4% num
produto PPR, e um ETF de ações globais no mesmo período fez ≈21%/ano. Nenhum dos dois números é uma
previsão razoável para os próximos 20 a 40 anos — são o resultado de um mercado em alta (bull market)
pós-2023, não uma taxa de retorno estrutural. Usar 21%/ano como pressuposto de reforma seria o erro
exato que este simulador avisa em toda a parte.

## Metodologia

- **Nominal vs real**: a maioria das séries históricas académicas (Dimson-Marsh-Staunton / UBS Global
  Investment Returns Yearbook) reporta retornos **reais** (já descontada a inflação). A maioria das
  "capital market assumptions" (CMA) dos gestores de ativos — Vanguard, J.P. Morgan — reporta retornos
  **nominais**. Este documento converte tudo para **nominal em EUR**, porque é isso que o simulador usa
  (`etfReturn`, `pprReturn`).
- **Inflação assumida**: usamos ~2,0%/ano para a conversão real → nominal de longo prazo, ancorado no
  objetivo de médio prazo do BCE (2%) e nas projeções mais recentes do Eurosistema, que preveem a
  inflação da zona euro a regressar a 2,0% em 2028 depois de 3,0% em 2026 e 2,3% em 2027 (BCE,
  projeções macroeconómicas de junho de 2026). Para um horizonte de 20-40 anos, o objetivo de 2% do BCE
  é a âncora mais defensável — não as leituras de curto prazo, hoje acima do alvo.
- **Horizonte**: as CMA dos gestores de ativos cobrem tipicamente 10-15 anos, não 20-40. Usamos as
  suas estimativas como o ponto de partida "atual" (que reflete as valorizações de hoje) e cruzamos com
  a média realizada de mais de 125 anos (que não depende do ponto de entrada) para chegar a uma
  estimativa de muito longo prazo. Quando as duas fontes divergem, a estimativa central é uma média
  simples das duas, arredondada — nunca a mais otimista das duas.
- **Câmbio**: onde só existiam números em USD, preferimos as tabelas já publicadas em EUR (caso do
  J.P. Morgan, que publica uma matriz própria em euros). Não convertemos USD→EUR por conta própria.

## Ações globais, desenvolvidas + emergentes (FTSE All-World / MSCI ACWI)

| Fonte | Figura | Real/Nominal | Base | Horizonte |
|---|---|---|---|---|
| J.P. Morgan, 2026 Long-Term Capital Market Assumptions (30.ª edição), "AC World Equity" | 5,90%/ano (retorno composto 2026) | Nominal | EUR | 10-15 anos |
| Vanguard, VCMM (dez 2025 / jun 2026), ações internacionais ex-EUA | ~7,9%/ano (ponto médio) | Nominal | USD | 10 anos |
| UBS Global Investment Returns Yearbook 2026 (Dimson-Marsh-Staunton), ações mundiais, 1900-2025 | ~5,2%/ano | **Real** | Múltiplas moedas, índice mundial ponderado por capitalização | 126 anos |

**Estimativa central: 6,5%/ano nominal EUR.**

Raciocínio: convertendo o retorno real histórico mundial (5,2%) para nominal a uma inflação de 2%,
obtém-se ≈7,3%/ano — a "base estrutural" de muito longo prazo. A estimativa a 10-15 anos do J.P. Morgan
(5,9%) já reflete valorizações atuais elevadas nos EUA (que pesam ~60% do índice mundial) e por isso é
mais conservadora. A média das duas, arredondada, é 6,5%. As fontes discordam: a Vanguard, ao separar
EUA de "resto do mundo", implica um número mais alto para ações ex-EUA (7,9%) precisamente porque adia
o desconto de valorização para os EUA isoladamente — ver secção seguinte.

## Ações de mercados desenvolvidos, sem emergentes (MSCI World)

| Fonte | Figura | Real/Nominal | Base | Horizonte |
|---|---|---|---|---|
| J.P. Morgan 2026 LTCMA, "Developed World Equity" | 5,90%/ano | Nominal | EUR | 10-15 anos |
| UBS GIRY 2026, mercados desenvolvidos (aproximado pelo mundial, dado o peso reduzido dos emergentes) | ~5,2%/ano | Real | Múltiplas moedas | 126 anos |

**Estimativa central: 6,3%/ano nominal EUR.**

Historicamente, mercados desenvolvidos e o índice mundial têm retornos muito próximos, porque os
emergentes pesam pouco no índice mundial ponderado por capitalização. Fixamos o MSCI World ligeiramente
abaixo do all-world (6,3% vs. 6,5%) para refletir a ausência do prémio de crescimento (e de risco) dos
emergentes que o J.P. Morgan atribui separadamente (ver Emerging Markets Equity, EUR, 6,00%/ano na
mesma tabela).

## EUA, grande capitalização (S&P 500)

| Fonte | Figura | Real/Nominal | Base | Horizonte |
|---|---|---|---|---|
| J.P. Morgan 2026 LTCMA, "U.S. Large Cap" | 5,50%/ano (não coberto) / 5,90%/ano (coberto) | Nominal | EUR | 10-15 anos |
| Vanguard VCMM (dez 2025 / jun 2026), ações dos EUA | 3,8%-5,9%/ano | Nominal | USD | 10 anos |
| UBS GIRY 2026 / Dimson-Marsh-Staunton, EUA, 1900-2025 | ~6,6%/ano | Real | USD | 126 anos |
| Damodaran, prémio de risco implícito do S&P 500 (início de 2026) | ~4,2 pontos percentuais acima da yield do Treasury a 10 anos | — | USD | Implícito, sem horizonte fixo |

**Estimativa central: 5,8%/ano nominal EUR — abaixo da própria média histórica do índice.**

Este é o caso em que a resposta à pergunta "as valorizações atuais justificam esperar menos do que a
história?" é claramente **sim**. O retorno real histórico dos EUA (6,6%) converteria para ≈8,7%/ano
nominal — mas tanto o J.P. Morgan (5,5-5,9% em EUR) como a Vanguard (3,8-5,9% em USD, a estimativa mais
baixa de todas as classes de ações cobertas) apontam para um retorno prospetivo bem abaixo disso. A
razão apontada por ambos e por Damodaran é a mesma: o S&P 500 negoceia a múltiplos (CAPE) muito acima
da média histórica, o que mecanicamente reduz o retorno esperado daqui para a frente, independentemente
do que aconteceu nos últimos 125 anos. Fixamos 5,8% — próximo do ponto central das estimativas a 10-15
anos do J.P. Morgan e da Vanguard, sem dar peso à média histórica de 6,6% real, precisamente porque essa
média não incorpora o nível de valorização atual.

## Obrigações globais agregadas (cobertura cambial em EUR)

| Fonte | Figura | Real/Nominal | Base | Horizonte |
|---|---|---|---|---|
| J.P. Morgan 2026 LTCMA, "Euro Aggregate Bonds" | 3,30%/ano | Nominal | EUR | 10-15 anos |
| J.P. Morgan 2026 LTCMA, "World Government Bonds hedged" | 3,20%/ano | Nominal | EUR (cobertura cambial) | 10-15 anos |
| UBS GIRY 2026, obrigações mundiais, 1900-2025 | ~1,6%/ano | Real | Múltiplas moedas | 126 anos |

**Estimativa central: 3,2%/ano nominal EUR.**

Ao contrário das ações, aqui as fontes concordam razoavelmente bem: o retorno real histórico de 1,6%
convertido a 2% de inflação dá ≈3,6% nominal, muito próximo dos 3,2-3,3% que o J.P. Morgan já projeta
diretamente em EUR para os próximos 10-15 anos. Usamos o número do J.P. Morgan por ser já
EUR-denominado e não precisar de conversão.

## Liquidez / mercado monetário em euros

| Fonte | Figura | Real/Nominal | Base | Horizonte |
|---|---|---|---|---|
| J.P. Morgan 2026 LTCMA, "Euro Cash" | 2,40%/ano | Nominal | EUR | 10-15 anos |
| BCE, objetivo de inflação de médio prazo | 2,0%/ano | — | EUR | Estrutural |

**Estimativa central: 2,0%/ano nominal EUR.**

Arredondamos ligeiramente abaixo da estimativa do J.P. Morgan (2,4%) para não implicar um retorno real
positivo estrutural da liquidez pura, que historicamente ronda zero — a taxa de depósito do BCE tende a
acompanhar de perto o seu próprio objetivo de inflação ao longo de ciclos completos.

## Retorno esperado por produto (derivado da alocação de ativos)

Todas as misturas usam os números centrais acima: ações globais 6,5%, ações desenvolvidas 6,3%, S&P
500 5,8%, obrigações globais 3,2%, liquidez EUR 2,0%. O resultado é o retorno **bruto dos encargos
próprios do produto** (o motor do simulador subtrai as comissões à parte).

| Produto | Alocação assumida | Cálculo | `expected.grossPct` |
|---|---|---|---|
| VWCE, FWRA, WEBN (ações globais) | 100% ações globais | 6,5% | 6,5% |
| IWDA (MSCI World) | 100% ações desenvolvidas | 6,3% | 6,3% |
| VUAA, CSPX, SPY5 (S&P 500) | 100% S&P 500 | 5,8% | 5,8% |
| Golden SGF PPR ETF | 75% ações globais / 22,5% obrigações / 2,5% liquidez (alocação divulgada pela gestora) | 0,75×6,5 + 0,225×3,2 + 0,025×2,0 = 5,65 | 5,6% |
| SGF Stoik | 50% ações globais / 50% obrigações+liquidez+outros (alocação "base" divulgada; ações têm benchmark 85% MSCI World + 15% MSCI EM) | 0,50×6,5 + 0,45×3,2 + 0,05×2,0 = 4,79 | 4,8% |
| Optimize Capital Reforma Agressivo | ~85% ações / 15% obrigações (estimado a partir da exposição histórica divulgada de 75-95%, até 100% permitido) | 0,85×6,5 + 0,15×3,2 = 6,00 | 6,0% |
| BPI Reforma Global Equities | ~90% ações / 10% obrigações (estimado — fundo de ações de poupança-reforma, exposição >75% presumida mas não confirmada em fonte primária) | 0,90×6,5 + 0,10×3,2 = 6,17 | 6,2% |
| Golden SGF Poupança Dinâmica | ~85% ações / 15% obrigações (estimado — fundo de pensões descrito pela própria gestora como "mais agressivo" que o Golden ETF, SRI 5 vs. 4; alocação exata não publicada) | 0,85×6,5 + 0,15×3,2 = 6,00 | 6,0% |
| Média do mercado português | ~15% ações globais / 85% obrigações e liquidez (estimado a partir do SRI médio de 2,5/7 e da composição do mercado: 720 dos 1070 produtos são de capital garantido, ASF/APFIPP) | 0,15×6,5 + 0,85×3,2 = 3,70; arredondado para baixo por o capital garantido tender a render menos do que um índice de obrigações puro | 3,4% |

As três alocações marcadas "estimado" (Optimize, BPI, Golden Dinâmica) não têm uma percentagem
ações/obrigações publicada em fonte primária verificável dentro do tempo desta pesquisa — ver
`docs/research/pprs.md`, secções respetivas, onde isto já estava assinalado como não verificado. O
método usado (mapear o SRI e a descrição do produto para uma alocação plausível, depois aplicar as
mesmas estimativas de classe de ativos) é explícito e não inventa uma rentabilidade — mas é claramente
menos preciso do que os casos com alocação publicada (Golden ETF, Stoik).

## Contraste com as figuras históricas (trailing) já usadas no simulador

| Produto | Histórico (trailing, `docs/research/etfs.md` / `pprs.md`) | Expectativa de longo prazo (`expected.grossPct`) | Diferença |
|---|---|---|---|
| VWCE | 10,84%/ano a 5 anos (jul 2021-jul 2026) | 6,5%/ano | -4,3 p.p. |
| IWDA | 11,26%/ano a 5 anos | 6,3%/ano | -5,0 p.p. |
| VUAA / CSPX | 12,55%/ano a 5 anos | 5,8%/ano | -6,8 p.p. |
| Golden SGF PPR ETF | 12,4%/ano a 2,8 anos (bruto: 13,83%, ver `grossReturnFor`) | 5,6%/ano bruto | -8,2 p.p. |

A diferença é grande e **é esperada, não um erro**: a janela de 5 anos usada nas fact sheets (jul
2021 - jul 2026) apanha uma recuperação forte pós-2022 e um mercado altista prolongado em 2024-2026;
a janela do Golden (out 2023-jul 2026) nem sequer inclui a queda de 2022. Retornos de mercados de
ações ao longo de qualquer janela de 3-5 anos são dominados pela sequência específica de subidas e
descidas desse período (sorte de calendário), não pelo retorno estrutural de longo prazo. É exatamente
por isto que o simulador mostra sempre a janela ao lado do histórico (`history.window`) e agora separa
claramente esse histórico da nova estimativa prospetiva (`expected`) — são duas perguntas diferentes:
"o que este produto fez" vs. "o que é razoável esperar dele durante uma carreira de poupança inteira".

## Limitações

- Nenhuma das fontes de CMA (J.P. Morgan, Vanguard) é gratuita/pública ao nível de detalhe de um
  relatório completo — os números aqui vêm dos documentos de matriz de pressupostos (LTCMA 2026,
  edições em USD e EUR) e de resumos públicos da Vanguard, não de acesso direto a todas as tabelas
  internas.
- Não obtivemos uma figura própria, específica para a zona euro, da UBS Global Investment Returns
  Yearbook (o resumo público consultado não expunha a série completa por região) — usamos por isso a
  média mundial da DMS/UBS como aproximação para ações globais e desenvolvidas, o que é a prática
  comum na literatura mas não é uma leitura direta "zona euro".
- As alocações de três PPR (Optimize Capital Reforma Agressivo, BPI Reforma Global Equities, Golden
  SGF Poupança Dinâmica) não estão publicadas com precisão em fonte primária — foram estimadas a
  partir de SRI e descrição do produto, como assinalado na tabela acima. Isto já era uma lacuna
  conhecida em `docs/research/pprs.md`.
- Os números do J.P. Morgan têm data de referência de 30 de setembro de 2025 (edição 2026, publicada
  em outubro de 2025); não foram atualizados para refletir movimentos de mercado desde então.
- Um horizonte de 20-40 anos é mais longo do que qualquer CMA publicada (tipicamente 10-15 anos) e
  mais curto do que o histórico de 126 anos da UBS/DMS. A média simples das duas é uma simplificação
  deliberada, não uma modelação formal de reversão à média — não existe uma fonte única e credível que
  publique diretamente uma estimativa a 20-40 anos.
- Não foi feito qualquer ajuste por custos de transação, tracking error do fundo, ou fiscalidade — estes
  já são tratados separadamente pelo motor do simulador (`engine.ts`) a partir dos campos de comissões
  de cada preset.

## Fontes

- J.P. Morgan Asset Management, *2026 Long-Term Capital Market Assumptions* (30.ª edição), matrizes de
  pressupostos em dólares e em euros, dados a 30 de setembro de 2025:
  `https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/ltcma-2026-us-matrix_usd.pdf` e
  `https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/ltcma-2026-us-matrix_eur.pdf`
- Vanguard, *2026 Economic and Market Outlook* / Vanguard Capital Markets Model (VCMM):
  `https://corporate.vanguard.com/content/dam/corp/research/pdf/isg_vemo_2026.pdf` ;
  `https://www.advisorperspectives.com/articles/2025/02/14/examining-vanguards-forecasted-returns-decade-ahead`
- UBS, *Global Investment Returns Yearbook 2026* (Dimson, Marsh, Staunton — London Business School /
  Cambridge Judge Business School):
  `https://www.ubs.com/global/en/investment-bank/insights-and-data/articles/global-investment-returns-yearbook-2026.html`
- Aswath Damodaran, *Equity Risk Premiums (ERP): Determinants, Estimates and Implications — The 2026
  Edition*: `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6361419`
- Banco Central Europeu, projeções macroeconómicas de junho de 2026:
  `https://www.ecb.europa.eu/press/projections/html/index.en.html`
