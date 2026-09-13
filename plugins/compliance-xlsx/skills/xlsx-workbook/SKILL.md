---
name: xlsx-workbook
description: Build a formatted Excel workbook with the write_xlsx tool. Read this before the first workbook of a conversation. It covers the column types and which one each kind of value needs, why identifiers like CPF and CNPJ must be text, the percent convention that silently multiplies by a hundred, when to pass a sheet source file instead of inline rows, totals and charts, and how to hand the finished file to the user.
whenToUse: Before calling write_xlsx, or when a workbook came out with wrong formats, lost leading zeros, or percentages a hundred times too large.
---

# Building a workbook

`write_xlsx({ path, sheets, description? })` writes a real `.xlsx` and puts it in
the conversation as a file the user can open. You describe the sheets; the tool
owns the look, so do not try to style cells yourself.

**You never see the result.** There is no loop where you open the file and fix
it, so the description has to be right when you send it.

## Rows: inline or from a file

| Situation | Pass |
|---|---|
| A handful of rows you already have in prose | `rows` |
| Anything from a data file, any real dataset | `source` |

`source` is a `.csv`, `.tsv`, `.parquet` or `.json` — typically what `run_pandas`
just wrote through its `output`. Prefer it. Inline `rows` are your own output:
ten thousand rows emitted as JSON cost those tokens now and on every later turn
of the conversation, for data the user is about to open in Excel anyway.

The two are mutually exclusive — passing both is an error, not a merge.

## Column types

Every column declares what its values are. Getting this wrong is the main way a
workbook comes out wrong.

| type | For | Renders |
|---|---|---|
| `text` | names, descriptions, **and every identifier** | as typed |
| `integer` | counts | `1.234` |
| `number` | quantities, rates | `1.234,56` |
| `currency` | money | `R$ 1.234,56` |
| `percent` | proportions | `15,0%` |
| `date` | real dates | `05/03/2026` |
| `month` | competência | `03/2026` |

Three rules that are not obvious:

- **`percent` expects a fraction.** `0.15` shows as `15,0%`. Passing `15` shows
  `1500,0%`. If your data is already in percentage points, divide first.
- **CPF, CNPJ, CEP, matrícula, account and invoice numbers are `text`.** They
  look numeric and are not: as numbers they lose leading zeros and pick up
  thousands separators. `00123456789` becomes `123.456.789`, which is wrong and
  looks deliberate.
- **`month` is the competência**, the accounting month. It is not a date and not
  a sortable string — order the rows before writing them.

## Totals and charts

`totals: ["valor"]` adds a footer row with `SUBTOTAL`, so the total follows the
autofilter: filter to one branch and the total becomes that branch's. Prefer it
over computing the number yourself and writing it in as a constant.

`chart: { type, categories, series, title }` anchors a chart beside the data.
`categories` and every entry in `series` must be column keys of that sheet.
Chart when the answer is a shape; for three numbers, the table is enough.

## A workbook, end to end

```
run_pandas(
  sources: [{ path: "vendas.csv" }],
  code: 'result = df.groupby("mes", as_index=False)["valor"].sum()',
  output: "resumo.csv",
)

write_xlsx(
  path: "resumo-vendas.xlsx",
  description: "Vendas por competência",
  sheets: [{
    name: "Resumo",
    source: "resumo.csv",
    columns: [
      { key: "mes",   label: "Competência", type: "month" },
      { key: "valor", label: "Valor",       type: "currency" },
    ],
    totals: ["valor"],
    chart: { type: "column", categories: "mes", series: ["valor"], title: "Vendas por mês" },
  }],
)
```

## After writing it

The user already has the file — it appears as a chip they can open, so you do
not need to tell them where it is or paste its contents back. Say what the
workbook shows and what stands out in it.

Sheet names are at most 31 characters and cannot contain `: \ / ? * [ ]`. Name
them for what they hold — `Resumo`, `Detalhe`, `Por filial` — not `Sheet1`.
