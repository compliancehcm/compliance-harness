---
name: pandas-analysis
description: Analyze tabular files with the run_pandas tool. Read this before the first data call of a conversation. It covers how the tool reports a result (a description, never every row), the snippet contract, how to inspect an unfamiliar file before trusting its columns, the Brazilian data shapes that break a naive read - decimal comma, thousands dot, DD/MM/YYYY, competencia MM/AAAA, CPF and CNPJ as text - and how to hand a large result to write_xlsx through a file instead of through the conversation.
whenToUse: Before calling run_pandas, or when a result came back with wrong types, unexpected nulls, or numbers read as text.
---

# Analyzing data with pandas

`run_pandas({ sources, code, output?, description? })` loads the files, runs your
snippet over them, and returns a **description** of the resulting frame: shape,
column dtypes, a head preview, and whatever you printed.

It never returns every row. Two consequences that shape how you use it:

- **You cannot read a dataset into the conversation.** Aggregate, then look.
- **A large result leaves as a file.** Pass `output` and hand that path on.

## The snippet contract

Each source becomes a DataFrame: the first is `df`, then `df2`, `df3`, unless you
name them. `pd` is pandas. Assign the answer to `result`; if you do not, the first
source's frame is reported, so reassigning `df` works too.

```python
result = df.groupby("mes", as_index=False)["valor"].sum()
```

`print()` is captured and returned to you — use it for the things a preview does
not show, like `df.isna().sum()` or a value count.

## First call on an unfamiliar file: look before you compute

Column names, dtypes and null counts decide every later line. Getting them wrong
produces a confident wrong answer, which is worse than an error.

```python
print(df.dtypes)
print(df.isna().sum())
print(df.head(3).to_string())
result = df
```

Check specifically: is a numeric column typed `object`? That means something in
it is not a number — a currency symbol, a decimal comma, a `-` for empty.

## Brazilian data: what a naive read gets wrong

A CSV exported by a Brazilian system rarely loads correctly with defaults.

| Symptom | Cause | Fix |
|---|---|---|
| Money column is `object` | `1.234,56` — dot is thousands, comma is decimal | `pd.read_csv(..., decimal=",", thousands=".")`, or `sources` then `df["v"].str.replace(".", "", regex=False).str.replace(",", ".", regex=False).astype(float)` |
| Dates are `object` or land in the wrong month | `05/03/2026` parsed as month-first | `pd.to_datetime(df["data"], format="%d/%m/%Y")` — pass the format, never guess |
| CPF/CNPJ lost its leading zeros | read as a number | `dtype={"cpf": "string"}` at read time; it is an identifier, not a quantity |
| Accented columns do not match | file is not UTF-8 | `encoding="latin-1"` |
| Everything in one column | the separator is `;` | `sep=";"` |

Re-reading a source with options means doing it inside the snippet:

```python
df = pd.read_csv("vendas.csv", sep=";", decimal=",", thousands=".", encoding="latin-1")
result = df
```

**Competência** is `MM/AAAA` and is not a date — it is the accounting month. Keep
it as text, or derive it with `df["data"].dt.strftime("%m/%Y")`. Sorting it as
text puts `01/2027` before `02/2026`, so sort on the underlying date instead.

## Handing a result to a spreadsheet

Do not read rows back to pass them to `write_xlsx`. Write a file and reference it:

```python
result = df.groupby(["mes", "filial"], as_index=False)["valor"].sum()
```

with `output: "resumo.csv"`, then `write_xlsx` with that path as the sheet's
`source`. The rows never enter the conversation.

## Reporting the answer

The preview is for you, not for the user. Read it, then write the finding in
prose: what the numbers say, the caveat if one matters. Do not paste the preview
table back as your reply — the user gets a card of its own.
