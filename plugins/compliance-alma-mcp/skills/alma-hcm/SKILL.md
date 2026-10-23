---
name: alma-hcm
description: Guia operacional das ferramentas MCP de HCM da Alma (Compliance HCM) — trabalhadores, férias, ponto eletrônico, cálculos de folha/holerite, rescisões, cadastros, fórmulas, people analytics e estrutura organizacional. Use sempre que for consultar dados de RH/folha via MCP "HCM MCP" — resolução de IDs (emprusu_id, colaborador_id, setor_id, funcao_id), paginação, exportação CSV completa em vez de paginar (para análise ampla sem gastar contexto), desambiguação de homônimos, roteamento de perguntas e interpretação dos retornos JSON. Acione em pedidos como "holerite do fulano", "quem foi demitido em X", "banco de horas", "headcount por setor", "turnover", "rubricas", "espelho de ponto", "férias da matrícula Y".
---

# MCPs HCM da Alma — guia de uso

Servidor MCP `HCM MCP`. Todas as tools de HCM são **somente leitura** (`readOnlyHint: true`);
a única exceção é `alterar_gremp_id_padrao`. Os dados vêm de packages PL/SQL Oracle
(`PK_AGENT_*`) e são devolvidos como **string JSON** — você interpreta e responde em
linguagem natural, **nunca** despejando JSON bruto.

Este guia existe porque, num harness genérico, você não recebe os prompts dos agentes
especializados do produto. Ele concentra o que esses prompts sabem.

---

## 1. Modelo mental (leia antes de qualquer chamada)

### 1.1 Tenant implícito — `gremp_id_padrao`
Nenhuma tool recebe "cliente" como parâmetro. O **grupo de empresas** (tenant) vem do
claim `gremp_id_padrao` do token JWT. Consequências práticas:

- Você **não pode** consultar outro cliente numa mesma conversa sem trocar o token.
- `consultar_cliente_atual` diz qual tenant está ativo.
- `listar_clientes_autorizados` lista os tenants por ambiente (`{"PROD": [101, 141], ...}`).
- `alterar_gremp_id_padrao(gremp_id)` **invalida o token atual** (blacklist por `jti` e por
  `sub`+`iat`). Depois dela, **toda** chamada seguinte falha com
  `Token invalidado — faça login novamente` até o usuário reautenticar. Avise isso ao
  usuário **antes** de chamar, e não encadeie outras tools na mesma resposta.

### 1.2 RBAC — tools somem, não só falham
Cada tool declara `required_roles`. O middleware do MCP filtra o `tools/list` pelas roles
do claim `agente_roles`: **uma tool que você não vê é uma tool que o usuário não tem
permissão de usar**. Se chamada mesmo assim, retorna `[SEM PERMISSÃO] ...`.

| Role | Domínio |
|---|---|
| `HCM_ORG` | empresas, setores, cargos (IDs transversais) |
| `HCM_TRABALHADORES` | cadastro do colaborador |
| `HCM_FERIAS` | férias individuais |
| `HCM_PONTO` | ponto eletrônico |
| `HCM_CALCULOS` | holerite, rubricas pagas, processamentos |
| `HCM_RESCISOES` | desligamentos |
| `HCM_CADASTROS` | rubricas, CC, locais, cargos, plano de contas, tipos de afastamento |
| `HCM_FORMULAS` | fórmulas do motor de cálculo |
| `HCM_ANALYTICS` | KPIs agregados |
| `HCM_MANAGER` | troca de cliente/tenant |

Ao receber `[SEM PERMISSÃO]`: comunique a falta de acesso e oriente a pedir a role ao
administrador. **Não** tente rota alternativa para o mesmo dado.

### 1.3 A regra de ouro: IDs nunca se inventam
Quase todo erro de uso nasce daqui. A cadeia de resolução é fixa:

```
get_empresas        → ids_empresas[]   → emprusu_id / emprusu_ids
get_setores         → ids_setores[]    → setor_id
get_cargos          → ids_funcoes[]    → funcao_id      (exige emprusu_ids)
get_trabalhadores   → colaborador_id   → todas as tools de UM colaborador
get_espelhos_ponto  → codigo_espelho   → espelho_id
listar_processamentos → proccalc_id    → get_holerite / get_rescisao_detalhe
get_rubricas        → cd (rubrica)     → consultar_pagamentos.cd_rubrica
```

Regras:
- **`get_empresas` é a primeira chamada** de quase todo fluxo. Passe **todos** os
  `ids_empresas` concatenados por vírgula (`"42,57,103"`) em **uma única** chamada.
  Nunca itere uma chamada por empresa.
- `ids_empresas`, `ids_setores` e `ids_funcoes` **não são paginados** — vêm completos
  mesmo quando o array de detalhe (`empresas`/`setores`/`funcoes`) está na página 1.
- Chamadas de resolução são **passos internos**: não exiba o resultado de `get_empresas`
  ao usuário quando ele pediu outra coisa.

### 1.4 Quem exige `emprusu_id`

| Exige (obrigatório) | Aceita (opcional) | Não tem o parâmetro |
|---|---|---|
| `get_trabalhadores`, `get_cargos`, `get_kpis_afastamento`, `get_ranking_afastamentos`, `get_turnover_mensal`, `get_turnover_setor`, `get_kpis_headcount` | `get_centros_custo`, `get_plano_conta`, `get_rescisoes`, `get_rescisao_detalhe`, `consultar_pagamentos`, `listar_processamentos` | `get_kpis_colaboradores`, `get_kpis_ferias`, tools de férias e de ponto (usam `cod_empresa`), `get_rubricas`, `get_cargos_cadastro`, `get_locais_trabalho`, `get_afastamentos`, fórmulas |

`get_centros_custo` e `get_plano_conta` **devem** receber `emprusu_ids` na prática —
inclusive em busca por código — senão o resultado sai incompleto.

---

## 2. Convenções comuns a todas as tools

### 2.1 Formatos
- **Datas**: `DD/MM/AAAA` (`dt_ini`, `dt_fim`, `dt_inicial`, `dt_final`, `dt_referencia`, `dt_inicio`…).
- **Competência / mês**: `MM/YYYY` (`mes`, `mes_ini`, `dt` em cálculos).
- **Horas**: sempre `HH:MM` (ponto). Nunca converta para decimal.
- **Dinheiro**: apresente como `R$ 1.234,56`.
- Multi-valor: string separada por vírgula, sem espaços (`"42,57,103"`).

### 2.2 Envelope paginado
A maioria das listagens devolve:

```json
{ "total_registros": 47, "pagina": 1, "por_pagina": 10, "total_paginas": 5, "dados": [ ... ] }
```

Variações que quebram o padrão — atenção:

| Tool | Chave do total | Chave do array |
|---|---|---|
| padrão | `total_registros` | `dados` |
| `get_rescisoes` | `total_rescisoes` | `rescisoes` |
| `get_empresas` | `total_empresas` | `empresas` (+ `ids_empresas`) |
| `get_setores` | `total_setores` | `setores` (+ `ids_setores`) |
| `get_cargos` | `total_funcoes` | `funcoes` (+ `ids_funcoes`) |

**Sempre anuncie o total pela chave de total, nunca pelo `len(dados)`.** Dizer
"10 rubricas encontradas" quando `total_registros=47` é o erro mais comum.
Rodapé recomendado quando `len(dados) < total`:
`(exibindo 10 de 47 — peça "próxima página" ou "exportar" para ver os demais)`.

### 2.3 Exportação CSV (`exportar=True`) — a saída para volumes grandes

Presente em quase toda listagem. Quando `True`:
- **ignora `pagina`**, percorre **todas** as páginas no servidor e gera um CSV;
- retorna **uma mensagem com link de download**, *não* os dados;
- link vale ~60 min (`AGENT_CSV_TTL`), delimitador `;`, encoding UTF-8 com BOM (abre direto
  no Excel pt-BR).

#### Quando usar exportação em vez de paginar

Esta é a decisão mais importante desta seção e a mais esquecida.

> **Se a tarefa precisa de *todos* os registros, exporte. Não pagine.**
> Uma chamada com `exportar=True` substitui N chamadas paginadas, e o conteúdo do CSV
> **não passa pelo contexto do MCP** — o retorno é só uma URL. Isso economiza uma
> quantidade enorme de tokens e elimina o risco de estourar a janela no meio da coleta.

Regra prática:

| Situação | Faça |
|---|---|
| Usuário quer ver alguns registros, conferir um caso, responder no chat | pagine (`pagina=1,2,…`) |
| Usuário pediu "exportar/baixar/planilha/ver todos/mostrar tudo" | `exportar=True` |
| **Você** precisa analisar o conjunto inteiro (somar, cruzar, agrupar, achar outliers, auditar) | `exportar=True` |
| `total_registros` é grande (ordem de centenas ou mais) e a pergunta é ampla | `exportar=True` |
| Já está na 3ª página e ainda faltam muitas | pare, refaça com `exportar=True` |

Não é preciso esperar o usuário pedir. Se ele fez uma pergunta analítica ampla
("compare os descontos de INSS de todo mundo em 2026", "quais colaboradores têm
inconsistência de banco de horas"), **ofereça ou já use a exportação** e explique que é
o caminho para cobrir 100% dos dados de uma vez.

#### O que fazer com o link

O arquivo é servido por HTTP estático em `PUBLIC_BASE_URL/public/exports/<arquivo>.csv`,
**fora** do transporte MCP. Então:
- entregue o link ao usuário quando ele quiser a planilha; **ou**
- se o seu harness tem ferramenta de rede ou shell (`WebFetch`, `curl`, download de
  arquivo), **baixe o CSV você mesmo** e analise localmente. Esse é o fluxo eficiente para
  análise ampla: os dados chegam como arquivo, não como tokens de resposta de tool.

> **LINK VERBATIM** — copie a URL caractere por caractere. É proibido encurtar, truncar,
> "corrigir", traduzir ou trocar domínio (ex.: `agente` ↔ `agent`). Trate como texto opaco.

#### Limites e ressalvas
- **TTL ~60 min.** Depois disso o arquivo é apagado; se for demorar, gere na hora do uso.
- **Teto de segurança** de `AGENT_EXPORT_MAX_PAGES` páginas (default 2000). Acima disso o
  CSV sai truncado — filtre por período/empresa antes de exportar bases muito grandes.
- **Sem registros → sem link.** A tool devolve a mensagem de "nenhum registro para
  exportar"; não é erro.
- Os **pré-requisitos continuam valendo**: `get_centros_custo` e `get_plano_conta` ainda
  precisam de `emprusu_ids`; `get_trabalhadores` ainda precisa de `emprusu_id`; as tools
  de histórico ainda precisam de `colaborador_id`.

#### Quem exporta e quem não exporta

| Domínio | Exportam (`exportar=True`) | Não exportam |
|---|---|---|
| Trabalhadores | `get_trabalhadores`, `get_alt_salarial`, `get_alt_ccusto`, `get_dependentes` | `get_info_trabalhador`, `get_info_complementar_trabalhador` |
| Cálculos | `consultar_pagamentos`, `listar_processamentos` | **`get_holerite`** |
| Rescisões | `get_rescisoes` | `get_rescisao_detalhe` |
| Cadastros | `get_rubricas`, `get_centros_custo`, `get_locais_trabalho`, `get_cargos_cadastro`, `get_plano_conta`, `get_afastamentos` | `get_rubrica_detalhe` |
| Férias | `get_programacao_ferias`, `get_registro_ferias`, `get_dados_base_calculo_ferias` | — |
| Ponto | todas as 9 | — |
| Org / Analytics / Fórmulas | — | todas |

⚠️ **Holerite não exporta.** `get_holerite` é um contracheque único, de um colaborador e
um processo — não existe `exportar`. Para análise de folha em volume (todos os
colaboradores, vários meses, uma rubrica específica) a tool certa é
**`consultar_pagamentos`**, que exporta e cobre os mesmos movimentos. Não tente iterar
`get_holerite` colaborador a colaborador para montar um panorama: além de lento, estoura
o contexto.

### 2.4 Retornos de erro (são strings, não exceções)
| Retorno | Significado | O que fazer |
|---|---|---|
| `Token de acesso não disponível` | sem JWT no contexto | pedir login |
| `Token invalidado — faça login novamente` | blacklist (típico após `alterar_gremp_id_padrao`) | pedir novo login |
| `[SEM PERMISSÃO] ...` | RBAC | comunicar e parar |
| `é necessário informar 'emprusu_id'...` | faltou resolver ID | chamar `get_empresas` e repetir |
| `{"erro": ...}` ou `dados: []` | consulta sem resultado | "Não foram encontrados registros para os critérios informados." |
| `Erro ao consultar ...: <msg>` | falha Oracle/JSON | explicar brevemente, preservar a mensagem essencial |

Nunca preencha lacuna com valor inventado. Campo ausente = ausente (várias tools omitem
chaves nulas — `ABSENT ON NULL`); não fabrique "Não informado" para chave que não veio.

### 2.5 Filtros: só o que o usuário pediu
Palavras como "cadastrados", "existentes", "disponíveis", "todos", "quais são" **não são
filtros**. Sem menção explícita a status/situação, não filtre por status/situação.
Não substitua um filtro inexistente por outro "parecido" (`nome` não é filtro de empresa).

---

## 3. Catálogo de tools por domínio

### 3.1 Estrutura organizacional — `HCM_ORG`
| Tool | Uso | Chaves úteis do retorno |
|---|---|---|
| `get_empresas(nm_empresa?, nr_inscricao?, is_matriz?, pagina)` | resolver `emprusu_id`; listar empresas/filiais | `ids_empresas`, `empresas[].id_empresa`, `cd_empresa`, `nome_empresa`, `nr_inscricao`, `is_matriz`, `matriz_nome` |
| `get_setores(nm_setor?, tp_setor?, sit_setor?, pagina)` | resolver `setor_id` | `ids_setores`, `setores[].id_setor`, `nome_setor`, `tp_setor`, `sit_setor` |
| `get_cargos(emprusu_ids, nm_funcao?, cd_funcao?, sit_funcao?, cbo_funcao?, ...)` | resolver `funcao_id` | `ids_funcoes`, `funcoes[].id_funcao`, `nome_funcao`, `cd_funcao`, `cbo_funcao` |

`is_matriz`: `"Matriz"` \| `"Filial"` · `tp_setor`: `"Depto/Setor"` \| `"Construção Civil"` \| `"Tomador Serviço"` ·
`sit_setor`: `"Ativo"` \| `"Inativo"` · `sit_funcao`: `"Ativada"` \| `"Desativada"`.

⚠️ **`get_cargos` ≠ `get_cargos_cadastro`.** `get_cargos` (`HCM_ORG`) existe para obter
`funcao_id` e exige `emprusu_ids`. `get_cargos_cadastro` (`HCM_CADASTROS`) é a consulta
rica do cadastro de cargos (família, nível hierárquico, teto salarial) e não recebe empresa.

### 3.2 Trabalhadores — `HCM_TRABALHADORES`
| Tool | Uso |
|---|---|
| `get_trabalhadores(emprusu_id, cd?, nome?, incl_demitido, setor_id?, funcao_id?, pagina, exportar)` | **desambiguação**: resolve `colaborador_id` |
| `get_info_trabalhador(colaborador_id, modo, secao?)` | cadastro em seções |
| `get_info_complementar_trabalhador(colaborador_id)` | especificações, rotinas de cálculo, turno, grupo de trabalho, estabilidade, contribuição sindical, penalidades, elogios, histórico de transferências |
| `get_alt_salarial(colaborador_id, pagina, exportar)` | histórico salarial (mais recente → mais antigo) |
| `get_alt_ccusto(colaborador_id, pagina, exportar)` | histórico funcional / centro de custo |
| `get_dependentes(colaborador_id, pagina, exportar)` | dependentes, IR, salário-família, auxílio-creche |

`get_trabalhadores` é a **única** que aceita `cd`/`nome`; as demais só aceitam `colaborador_id`.
`incl_demitido` default `"Não"` — para buscar demitido é preciso passar `"Sim"` explicitamente.

**`get_info_trabalhador.modo` — o filtro é server-side, escolha certo:**
- `modo='resumo'` (default) → só `colaborador` + `informacoes_pessoais`.
  Use para "quais os dados", "me fala sobre", "perfil", "mostra o cadastro".
- `modo='secao'` + `secao=<nome>` → `colaborador` + a seção pedida. Seções:
  `documentacao`, `endereco`, `dados_admissao`, `trabalhador_estrangeiro`,
  `campos_adicionais`, `suspensao_disciplinar`, `plano_saude`, `plano_odontologico`.
- `modo='completo'` → todas as seções. **Só** quando o usuário escrever literalmente
  "tudo", "todos os dados", "cadastro completo", "completo" ou "detalhado".

Filtros anexos à pergunta ("inclua demitidos", "do setor X", "da empresa Y") **não**
promovem `resumo` para `completo`. Na dúvida, `resumo`.

Mapeamento de sinônimos → `secao`: plano de saúde / convênio médico / assistência médica →
`plano_saude`; odontológico / plano dental / dentista → `plano_odontologico`;
suspensão / medida disciplinar / punição → `suspensao_disciplinar`; RG, CPF, CTPS, PIS,
CNH, conta bancária → `documentacao`; vínculo, carga horária, CBO, sindicato → `dados_admissao`.

⚠️ "plano de saúde" e "plano odontológico" **não** são dados complementares — vêm de
`get_info_trabalhador`, não de `get_info_complementar_trabalhador`.

### 3.3 Férias individuais — `HCM_FERIAS`
Todas aceitam `matricula?`, `nome_colaborador?`, `dt_inicial_ferias?`, `dt_final_ferias?`,
`cod_empresa?`, `pagina`, `exportar`. **Não usam `colaborador_id` nem `emprusu_id`.**

| Tool | Semântica |
|---|---|
| `get_programacao_ferias` | **futuro / intenção** — nada confirmado nem pago. Vocabulário: "planejado", "programado". |
| `get_registro_ferias` | **fato consolidado** — férias já gozadas ou em andamento. Vocabulário: "gozado", "efetivado", "realizado". |
| `get_dados_base_calculo_ferias` | **parâmetros do cálculo** — dias de direito, saldo, faltas, data de pagamento, data do aviso, férias coletivas. Aceita também `processo_calculo`. |

"Quantos dias de direito eu tenho?" / "Qual meu saldo?" → `get_dados_base_calculo_ferias`
(não é `get_registro_ferias`).

### 3.4 Ponto eletrônico — `HCM_PONTO` (consultivo apenas)
Nenhuma tool calcula, fecha espelho, aprova ou abona. Se pedirem ação, diga que não está
disponível.

| Tool | O que traz |
|---|---|
| `get_marcacoes_ponto` | batidas por dia + origem (`ORIGINAL` do relógio / `INCLUÍDO` manual / `PRÉ-ASSINALADO`), se o dia foi calculado, situação do espelho do dia |
| `get_eventos_ponto` | resultado do cálculo: horas extras, atrasos, faltas, adicional noturno, em `HH:MM`, com `aprovado` (1/0) e `banco_horas` (1/0) |
| `get_espelhos_ponto` | períodos de apuração da empresa (`situacao` = `ABERTO`/`FECHADO`); devolve `codigo_espelho` |
| `get_espelho_trabalhador` | espelho consolidado de **um** trabalhador (exige matrícula **ou** nome); aceita `espelho_id` = `codigo_espelho` |
| `get_saldo_banco_horas` | saldo `HH:MM` com sinal em `dt_referencia` (default hoje): Credor / Devedor / Zerado |
| `get_extrato_banco_horas` | créditos e débitos do período, com origem e evento |
| `get_solicitacoes_abono` | pedidos do portal; `status` = `PENDENTE`/`CANCELADO`/`REJEITADO`/`APROVADO` |
| `get_trabalhador_ponto` | configuração: crachá, regra, relógio, escala, formas de registro. **Não traz salário/cargo.** |
| `get_marcacoes_importadas` | batidas cruas dos relógios/app antes do cálculo; lote/arquivo, `oficializada` (`S`/`N`), NSR, geolocalização |

Regras de resposta:
- **Não misture contextos** (batidas × eventos × espelho × banco de horas) na mesma
  resposta, salvo pedido explícito.
- Sinalize sempre se o período pertence a espelho **ABERTO** (pode mudar) ou **FECHADO**
  (definitivo).
- Toda resposta sobre um trabalhador deve conter: **empresa**, **nome + matrícula entre
  parênteses** e **período consultado**.
- Não reordene os registros — já vêm na ordem do sistema (em geral, mais recentes primeiro).
- Por padrão, não exiba demitidos, a menos que o usuário peça explicitamente.

### 3.5 Cálculos de folha — `HCM_CALCULOS`
| Tool | Uso |
|---|---|
| `get_holerite(colaborador_id, proccalc_id? \| descr_processo?, pagina)` | contracheque de **um** colaborador em **um** processo — **não exporta** |
| `consultar_pagamentos(emprusu_id?, colaborador_id?, matricula?, nome?, cd_rubrica?, descr_rubrica?, dt?, cd_tipo_pagamento?, descr_processo?, pagina, exportar)` | busca ampla de movimentos/rubricas |
| `listar_processamentos(emprusu_id?, dt?, cd_tipo_pagamento?, descr_processo?, pagina, exportar)` | cabeçalhos `PROC_CALC` — quais folhas rodaram |

Também acessíveis com a role de cálculos: `get_trabalhadores` (resolve `colaborador_id`)
e `get_rubricas` (descobre `cd_rubrica`).

> **Análise de folha em volume:** `get_holerite` é individual e não tem `exportar`. Para
> panorama (todos os colaboradores, vários meses, uma rubrica específica) use
> `consultar_pagamentos` com `exportar=True` — uma chamada, CSV completo, sem paginar.
> Ver §2.3.

**Interpretação das rubricas** — campos por linha: `natureza` (`Provento`/`Desconto`),
`unidade` (`HORA`/`DIA`/`VALOR`/`QUANTIDADE`), `identificacao`
(`TRABALHADOR`/`EMPRESA`/`INFORMATIVO`), `imposto` (`INSS`/`IRRF`/`FGTS` ou ausente).

> **Regra de ouro do líquido:** somente rubricas com `identificacao = "TRABALHADOR"`
> compõem proventos, descontos e líquido. `EMPRESA` e `INFORMATIVO` (encargos, bases) são
> informativas e nunca somam.

`get_holerite` devolve, além de `dados`, o bloco **`impostos`** (fonte oficial:
`MOV_INSS`, `MOV_IR`, `MOV_FGTS`) com `inss`, `ir`, `fgts`, `total_impostos_desconto` e
`detalhe[]` (por `tipo_calculo`: Normal / Férias / 13º / Tributação Exclusiva).

```
TOTAL PROVENTOS = Σ (identificacao=TRABALHADOR, natureza=Provento, sem campo `imposto`)
TOTAL DESCONTOS = Σ (identificacao=TRABALHADOR, natureza=Desconto, sem campo `imposto`)
                  + impostos.inss + impostos.ir
LÍQUIDO         = TOTAL PROVENTOS − TOTAL DESCONTOS
```

Calcule você mesmo — não confie em rubricas chamadas "Total". Use os valores do bloco
`impostos` (não some as rubricas com campo `imposto`, para não duplicar). **FGTS é
recolhido pela empresa: não é desconto e nunca entra no líquido** — só seção informativa.

**`cd_tipo_pagamento`** — o usuário fala pelo nome, você traduz para o código:

| | | | |
|---|---|---|---|
| 1 NORMAL | 2 ADIANTAMENTO - AUTOMÁTICO | 3 FÉRIAS | 4 13º SALÁRIO (1ª PARCELA) |
| 5 RESCISÃO | 6 ADIANTAMENTO - DIGITADO | 7 PROVISÃO FÉRIAS E 13º | 8 13º SALÁRIO (2ª PARCELA) |
| 9 ADIANTAMENTO - P.L.R. | 10 P.L.R. (QUITAÇÃO) | 11 PRO-LABORE | 12 ABONO / PIS |
| 13 ADIANTAMENTO - RURAL | 14 PAGAMENTO COMPLEMENTAR | 15 TICKET | 16 PPR DEVIDO |
| 17 ADIANTAMENTO - PRODUÇÃO | 18 PAGAMENTO DE TERCEIROS | 19 PAGTO COMPL. ADM. E DEM. | 20 TICKET II - ADM. E DEM. |
| 21 DIFERENÇA DE SALÁRIO NORMAL | 22 ESTÁGIO REMUNERADO | 23 DIFERENÇA DE FÉRIAS | 25 RESCISÃO COMPLEMENTAR |
| 27 PROVISÃO DE PLR | 28 DIFERENÇA DE 13º SALÁRIO | | |

Filtro opcional — só use quando o usuário restringir por tipo. Ambiguidade
(ex.: "adiantamento" tem 4 variações) → pergunte ou liste as opções.

### 3.6 Rescisões — `HCM_RESCISOES`
| Tool | Uso |
|---|---|
| `get_rescisoes(cd_colab?, nm_colab?, dt_inicio?, dt_fim?, tp_aviso?, proccalc_id?, emprusu_ids?, pagina, exportar)` | triagem/listagem (envelope `total_rescisoes` / `rescisoes`) |
| `get_rescisao_detalhe(proccalc_id? \| cd_colab? \| nm_colab?, emprusu_ids?)` | detalhe completo |

`tp_aviso`: `"Trabalhado"` \| `"Indenizado"`.

Campos **principais** do detalhe (exiba por padrão): tipo de demissão, último dia
trabalhado, datas (homologação, pagamento, aviso, encerramento), processo, tipo e dias de
aviso, antecipada, avos de férias (vencidas/proporcionais/indenizadas), avos de 13º
(normal/maternidade/indenizado), saldo FGTS, FGTS complementar, código de saque FGTS.

Campos **complementares** (mesma resposta da tool — não rechame): dispensa de aviso
prévio, seguro-desemprego, GRRF, FGTS mês anterior, salário últimos 36m, meses de vínculo
36m, jornada na semana do desligamento, sábado compensado, novo emprego, recibo e-Social,
processo trabalhista, atestado de óbito, `dt_aviso`, `dt_titulo`, `dt_encerr`, `perc_terc`,
`agência_sd`, `código_demissao`, `mov_integracao`.
Ao mostrar os principais, ofereça: *"Há dados complementares disponíveis. Deseja visualizá-los?"*

### 3.7 Cadastros — `HCM_CADASTROS`
| Tool | Filtros notáveis |
|---|---|
| `get_rubricas` | `status` `Desconto`\|`Provento`; `situacao` `Ativo`\|`Inativo`; `incide_fgts`/`incide_irrf`/`incide_cp` `Sim`\|`Não`; `tipo_rubrica` `Calculada`\|`Informada`; `descricao` (LIKE) |
| `get_rubrica_detalhe` | `codigo` (prioritário) ou `descricao` |
| `get_centros_custo` | `codigo` (aceita `202000` ou `2.02.000`), `nome`, `codigo_pai` (filhos de um CC), `status` `Ativo`\|`Inativo`, `tipo` `Analítico`\|`Sintético`, **`emprusu_ids`** |
| `get_locais_trabalho` | `codigo` (ID ERP), `descricao`, `status` `Ativo`\|`Inativo`, `tipo` `Depto/Setor`\|`Construção Civil`\|`Tomador Serviço` |
| `get_cargos_cadastro` | `nome`, `codigo`, `situacao` `Ativada`\|`Desativada`, `cbo`, `tipo_cargo`, `teto_salarial`, `lei_aprendiz` `Conta`\|`Aprendiz`\|`Não Conta`, `familia`, `nivel_hierarquico` |
| `get_plano_conta` | `codigo` (mascarado ou puro), `nome`, `codigo_pai`, `tipo` `Analítica`\|`Sintética`, `natureza` `Ativo`\|`Passivo`\|`Despesa`\|`Receita`\|`Outros`, **`emprusu_ids`** |
| `get_afastamentos` | `codigo`, `descricao`, `tipo` `Acidente`\|`Doença`\|`Outros`, `cont_ferias`, `cont_13sal`, `tp_estab`, `tp_lanc` |

⚠️ **Armadilha do plano de contas:** `natureza="Ativo"` é **natureza contábil**, não
status. Se o usuário disser só "contas ativas", **não** preencha `tipo` nem `natureza`.
Use `tipo` só com "analítica(s)"/"sintética(s)" literais; `natureza="Ativo"` só para
"contas do ativo"/"ativo contábil".

"Incidências"/"impactos"/"efeitos" de um tipo de afastamento = campos `cont_ferias`,
`cont_13sal`, `tp_estab`, `tp_lanc`.

### 3.8 Fórmulas — `HCM_FORMULAS`
| Tool | Gatilho |
|---|---|
| `get_info_formula(cd?, nome?)` | **explicar** uma fórmula existente (usuário deu código ou nome) |
| `get_info()` | **criar/sugerir** uma fórmula — devolve o catálogo de variáveis (rubricas, bases, constantes) |

Verbo decide: "o que faz a fórmula 123?" → `get_info_formula`; "faça uma fórmula de
margem de 30%" → `get_info` e monte a lógica.

Sintaxe do motor HCM ao escrever/exibir fórmulas:
- Variáveis `R:` (rubrica), `B:` (base), `V:` (valor fixo).
- Condicional **apenas** `CASE WHEN ... THEN ... ELSE ... END`.
- Decimal com **ponto** (`V:0.10`) ou divisão (`* V:10 / V:100`) — **nunca vírgula**.
- Proibido gerar Python/Java/SQL para representar a regra; proibido sugerir refatoração
  de fórmulas legadas; liste só o que compõe a fórmula, nunca o que falta nela.

### 3.9 People Analytics — `HCM_ANALYTICS`
| Tool | Parâmetros | Observação crítica |
|---|---|---|
| `get_kpis_colaboradores(mes)` | `MM/YYYY` | devolve totais **e** o campo `colaboradores` por grupo (`admitidos`, `demitidos`, `aniversariantes`) |
| `get_kpis_ferias(mes)` | `MM/YYYY` | grupos `ferias` (em gozo) e `ferias_dobradas` (risco trabalhista), com `colaboradores` |
| `get_kpis_afastamento(mes, emprusu_id, cd_afast?, descr_afast?, funcao_id?, setor_id?)` | | retorna o mês **e os 11 anteriores** — chame **uma vez só** |
| `get_ranking_afastamentos(mes, emprusu_id, funcao_id?, setor_id?)` | | agrega os 12 meses anteriores a `mes` |
| `get_turnover_mensal(mes, emprusu_id, funcao_id?, setor_id?)` | | 12 meses para trás; **uma** chamada |
| `get_turnover_setor(mes, emprusu_id, mes_ini?, setor_id?)` | | sem `mes_ini`, usa 12 meses |
| `get_kpis_headcount(tipo, dt_ini, dt_fim, emprusu_id, setor_id?, funcao_id?)` | datas `DD/MM/YYYY` | `tipo` ∈ `Total`, `Setor`, `Função`, `Faixa Etária`, `Tempo de Serviço`, `Empresa`, `Gênero` — **um tipo por chamada** |

Cálculo do `mes` (use sempre a data real de hoje, **nunca** reaproveite um `mes` de
pergunta anterior):
- "últimos 12 meses" / "último ano" / sem período → `mes` = mês atual
- "em YYYY" / "no ano de YYYY" → `mes = 12/YYYY`
- mês específico → o informado

`mes_ini` de `get_turnover_setor`: "último trimestre" → 3 meses antes; "último semestre" →
6 meses antes; "ano de YYYY" → `mes=12/YYYY`, `mes_ini=01/YYYY`.

`dt_ini`/`dt_fim` de `get_kpis_headcount`: só mês informado → `01/MM/YYYY` ao último dia;
só ano → `01/01/YYYY` a `31/12/YYYY`; sem período → primeiro e último dia do mês atual.

**Turnover acumulado no ano:** a tool devolve 12 meses que atravessam anos. Filtre o JSON
pelos meses do ano pedido **antes** de somar admitidos/demitidos. Nunca some meses de anos
diferentes no mesmo acumulado.
Fórmula exibida: `((Admitidos + Demitidos) / 2) / Headcount Médio × 100`.

Mapeamento linguagem → `tipo`: tempo de casa / anos de empresa / "mais de X anos" →
`Tempo de Serviço`; idade → `Faixa Etária`; sexo → `Gênero`; departamento/área → `Setor`;
cargo → `Função`; filial → `Empresa`.

**Nomes vs. totais:** o campo `colaboradores` só deve ser exibido quando o usuário pedir
("quem", "quais", "liste", "nomes", "me mostra", ou follow-up tipo "e quem foram?").
Caso contrário, mostre só os totais e ignore o campo em silêncio. Quando exibir e
`total > 10`, acrescente *"Exibindo 10 de N colaboradores."*
Os itens vêm como texto `"Nome (CD) - DD/MM/YYYY"` — separe nome, matrícula e data numa
tabela; nunca exiba o texto bruto.

### 3.10 Manager — `HCM_MANAGER`
`consultar_cliente_atual()` · `listar_clientes_autorizados()` ·
`alterar_gremp_id_padrao(gremp_id)` (ver §1.1 — invalida o token).

---

## 4. Roteamento: qual tool para qual pergunta

| Pergunta do usuário | Tool |
|---|---|
| "**Quem** foi demitido em junho?" (nomes, matrículas, datas) | `get_rescisoes` |
| "**Quantas** demissões em junho?" (número) | `get_kpis_colaboradores` |
| "Horas extras do João" (quantidade, aprovação) | `get_eventos_ponto` |
| "Quanto o João recebeu de hora extra" (valor em R$) | `get_holerite` / `consultar_pagamentos` |
| "Banco de horas do João" | `get_saldo_banco_horas` / `get_extrato_banco_horas` |
| "Quanto o João ganha hoje" | `get_alt_salarial` (primeiro item) |
| "Holerite / contracheque / recibo de pagamento / demonstrativo" | `get_holerite` |
| "Recibo de rescisão" (valores pagos) | `get_holerite` com processo de rescisão |
| "Dados da rescisão" (avos, aviso, FGTS) | `get_rescisao_detalhe` |
| "Quais folhas rodaram em 07/2026?" | `listar_processamentos` |
| "Quem teve a rubrica INSS em 07/2026?" | `consultar_pagamentos` |
| "O que é a rubrica 45?" (cadastro) | `get_rubrica_detalhe` |
| "Quantos dias de férias eu tenho?" | `get_dados_base_calculo_ferias` |
| "Quando tirei férias em 2024?" | `get_registro_ferias` |
| "Minhas férias agendadas" | `get_programacao_ferias` |
| "Quantos estão de férias este mês?" (empresa) | `get_kpis_ferias` |
| "Quais setores existem?" | `get_setores` |
| "Cadastro de cargos com CBO e teto salarial" | `get_cargos_cadastro` |
| "Preciso do ID do cargo Analista" | `get_cargos` |
| "Headcount / turnover / distribuição / panorama" | tools de analytics |
| "Preciso de **todos** os X para analisar / planilha / base completa" | a tool da área com `exportar=True` (§2.3) |
| "Plano de saúde do colaborador" | `get_info_trabalhador(modo='secao', secao='plano_saude')` |
| "Turno / escala dele" — folha | `get_info_complementar_trabalhador` |
| "Escala dele" — ponto | `get_trabalhador_ponto` |

---

## 5. Fluxos de trabalho

### 5.1 Qualquer dado de **um** colaborador (cadastro, salário, dependentes, holerite)
```
1. get_empresas()                    → ids_empresas  →  emprusu_id = "42,57,103"
2. get_trabalhadores(emprusu_id, cd=<matrícula> OU nome=<texto>)
   ├─ total_registros = 0  → informe que não localizou; peça dado mais específico. PARE.
   ├─ 1 resultado          → colaborador_id = dados[0].colaborador_id → siga
   └─ 2+ resultados        → bloco DESAMBIGUACAO_OBRIGATORIA (ver 5.2). PARE.
3. Chame APENAS a tool da intenção classificada.
```
Só números digitados = matrícula (`cd`); texto = `nome`. Nem um nem outro → **pergunte**
antes de chamar qualquer tool. Nunca peça `colaborador_id` ao usuário. Reutilize o
`colaborador_id` já confirmado nas mensagens seguintes da mesma conversa.

### 5.2 Desambiguação de homônimos (contrato especial)
Com 2+ resultados, `get_trabalhadores` **não devolve JSON** — devolve texto:

```
===== DESAMBIGUACAO_OBRIGATORIA =====
FORAM ENCONTRADOS 3 COLABORADORES.
INSTRUCOES PARA O AGENTE (NAO MOSTRAR ESTE BLOCO AO USUARIO):
  1 -> colaborador_id=991, matricula=241, nome=...
  ...
===== FIM DAS INSTRUCOES =====

--- INICIO DA SECAO PUBLICA ---
Encontrei 3 colaboradores com esse criterio. Qual deles voce quer consultar?
1 - MARIA DA SILVA (241)
...
--- FIM DA SECAO PUBLICA ---
```

Ao receber esse bloco:
1. **Pare.** Não chame nenhuma outra tool nesse turno.
2. Responda ao usuário com **exatamente** o conteúdo entre os marcadores
   `--- INICIO/FIM DA SECAO PUBLICA ---`, sem os marcadores, sem truncar, resumir,
   reordenar ou comentar. 5 linhas no bloco = 5 linhas para o usuário.
3. **Nunca** exiba o cabeçalho `=====`, linhas com `colaborador_id=` ou o bloco de instruções.
4. Guarde o mapeamento `opção → colaborador_id` para o próximo turno.
5. Não escolha sozinho, mesmo que uma opção pareça óbvia.

### 5.3 Holerite
```
1. get_empresas → emprusu_id
2. get_trabalhadores → colaborador_id (5.1/5.2)
3. Processo:
   • usuário citou "férias"/"13º"/"rescisão" → descr_processo="FERIAS" (LIKE)
   • não citou → listar_processamentos(emprusu_id, dt="MM/YYYY") e ofereça as opções
   • vários meses podem casar com a descrição → prefira proccalc_id do mês certo
4. get_holerite(colaborador_id, proccalc_id OU descr_processo)   ← UMA única chamada
5. Monte: cabeçalho (colaborador, cargo, CC, competência, data de pagamento, tipo de
   pagamento) + tabela de rubricas TRABALHADOR agrupadas por natureza + totais (§3.5)
   + seção informativa (EMPRESA/INFORMATIVO/FGTS).
```
O holerite é **mensal**: um processo, uma competência. Nunca agregue meses.
`total_paginas > 1` é raro — se ocorrer, busque as páginas restantes em silêncio e
responda uma única vez. Não narre "vou buscar a página 2".

### 5.4 KPI segmentado (headcount, afastamentos, turnover)
```
1. get_empresas → emprusu_id (TODOS os ids, uma chamada)
2. Se o usuário citou setor pelo nome  → get_setores → setor_id
   Se citou cargo/função pelo nome     → get_cargos(emprusu_ids) → funcao_id
3. Calcule mes / mes_ini / dt_ini / dt_fim a partir da data de HOJE (§3.9)
4. Uma única chamada da tool de KPI
```

### 5.5 Espelho de ponto de um trabalhador
```
1. get_espelhos_ponto(cod_empresa?, situacao?, dt_inicial?, dt_final?) → codigo_espelho
2. get_espelho_trabalhador(matricula OU nome_colaborador, espelho_id=codigo_espelho)
3. Informe se o espelho está ABERTO (provisório) ou FECHADO (definitivo)
```
Sem saber o período, sempre passe por `get_espelhos_ponto` primeiro.

### 5.6 Análise ampla de um conjunto de dados (preferir exportação)
Quando a pergunta exige olhar **todos** os registros — somar, cruzar, agrupar, auditar:
```
1. Resolva os pré-requisitos normais (get_empresas → emprusu_id, etc.)
2. Faça UMA chamada exploratória paginada só para ler `total_registros`
   e confirmar que os filtros estão certos
3. Repita a MESMA chamada com exportar=True  → mensagem + link (não os dados)
4a. Usuário quer a planilha  → repasse a URL caractere por caractere
4b. VOCÊ vai analisar        → baixe o CSV pela URL (WebFetch/curl) e processe
    localmente; os dados não passam pelo contexto do MCP
```
Nunca colete um conjunto grande paginando de 10 em 10. Se já está na 3ª página e ainda
faltam muitas, pare e refaça com `exportar=True`.
Filtre antes de exportar (período, empresa, setor) quando a base for muito grande — há
teto de 2000 páginas.

### 5.7 Hierarquia de centro de custo / plano de contas
```
1. get_empresas → emprusu_ids (obrigatório na prática)
2. Nó atual:  get_centros_custo(codigo="2.02.000", emprusu_ids=...)
3. Filhos:    get_centros_custo(codigo_pai="2.02.000", emprusu_ids=...)
```
Ambos aceitam código puro (`202000`) ou mascarado (`2.02.000`).

---

## 6. Anti-padrões (causas reais de resposta errada)

1. **Inventar `emprusu_id`, `setor_id`, `funcao_id` ou `colaborador_id`.** Se não veio de
   uma tool, não existe.
2. **Chamar uma tool em loop, uma vez por empresa ou por mês.** Concatene os IDs; as tools
   de afastamento e turnover já devolvem 12 meses numa chamada.
3. **Usar `len(dados)` como total.** Use `total_registros` / `total_rescisoes` / `total_empresas`.
4. **Paginar página a página para analisar o conjunto inteiro.** Gaste uma chamada com
   `exportar=True` e trabalhe sobre o CSV (§2.3). Paginar volume grande queima tokens à
   toa e costuma estourar o contexto antes do fim da coleta.
5. **Iterar `get_holerite` colaborador a colaborador** para montar panorama de folha.
   Use `consultar_pagamentos` com `exportar=True`.
6. **Reaproveitar `mes` de uma pergunta anterior.** Recalcule sempre a partir de hoje.
7. **Reescrever/encurtar o link de download.** Verbatim, sempre.
8. **Mostrar o bloco de desambiguação inteiro**, ou escolher um colaborador sozinho.
9. **Promover `modo='resumo'` para `'completo'`** por causa de filtros na frase.
10. **Somar rubricas `EMPRESA`/`INFORMATIVO` no líquido**, ou tratar FGTS como desconto.
11. **Somar as rubricas de imposto *e* o bloco `impostos`** — duplica INSS/IRRF.
12. **Confundir `get_cargos` (hcm-org, precisa de empresa) com `get_cargos_cadastro`.**
13. **Tratar "contas ativas" como `natureza="Ativo"`** no plano de contas.
14. **Rotear "quem foi demitido" para analytics** — nomes de desligados vêm de `get_rescisoes`.
15. **Misturar batidas, eventos e banco de horas** na mesma resposta de ponto.
16. **Reordenar os registros** devolvidos pelas tools de ponto e férias.
17. **Prometer ação** (calcular ponto, fechar espelho, aprovar abono, criar rescisão) —
    tudo é somente leitura.
18. **Encadear tools depois de `alterar_gremp_id_padrao`** — o token já morreu.
19. **Despejar JSON bruto** na resposta.

---

## 7. Checklist antes de cada chamada

- [ ] Tenho o `emprusu_id` (se a tool exige) vindo de `get_empresas`?
- [ ] Tenho o `colaborador_id` vindo de `get_trabalhadores`?
- [ ] Datas em `DD/MM/AAAA` e competências em `MM/YYYY`?
- [ ] Cada filtro que estou enviando foi citado pelo usuário ou exigido pela tool?
- [ ] O valor pertence semanticamente ao cadastro-alvo (não é um "parâmetro parecido")?
- [ ] É uma chamada só, com todos os IDs concatenados?
- [ ] **Vou precisar de todos os registros? Então é `exportar=True`, não paginação.**
- [ ] Se exportei, filtrei antes o suficiente para não bater no teto de 2000 páginas?
- [ ] Ao responder: total pela chave certa, nomes só se pedidos, link verbatim, sem JSON cru?
