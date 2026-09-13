# @compliance/dsh-xlsx

Formatted spreadsheets as deliverables: the `write_xlsx` tool, the Compliance
workbook theme, the openpyxl builder behind it, and the `xlsx-workbook` skill.

## Layout

The JavaScript here *is* the source — there is no build — so the halves sit at
the package root rather than under `lib/`, which the repository `.gitignore`
ignores at any depth.

| File | Role |
|---|---|
| `index.js` | The row: resolves the interpreter at apply, then registers the tool and the skill. |
| `src/config.js` | Validates the row's `config`, theme included; every problem in one throw at load. |
| `src/tool.js` | The `write_xlsx` definition: JSON Schema, argument validation, presenters. |
| `src/python.js` | One JSON request in, one JSON envelope out, over `ctx.subprocess`. |
| `py/write_xlsx.py` | Builds the workbook with openpyxl. |
| `skills/xlsx-workbook/SKILL.md` | The skill body, edited as Markdown rather than as a string. |

## Declarative, not a snippet

`run_pandas` takes Python; this tool takes a description of the workbook. The
spreadsheet is the **deliverable**, so its look belongs to this plugin's theme
rather than to whatever formatting a model improvises per call — the same trade
as `@compliance/dsh-echarts` taking an option rather than drawing code.

## The deliverables chip

`presentCall` and `presentResult` carry the produced path as a `location`. That
is what puts the workbook in the Web deliverables row, which reads the mutation
tools' own locations and never the closing prose. Without it the user would be
*told* about a file instead of handed one, so the location is load-bearing rather
than decorative.

## Rows: inline or from a file

A sheet takes `rows` or `source`, never both — both would mean one silently
loses. `source` is a `.csv`, `.tsv`, `.parquet` or `.json`, typically written by
`run_pandas` through its `output`. Prefer it for anything beyond a small table:
inline rows are model output, so a large sheet costs those tokens on the turn
that writes it and on every later turn of the conversation.

## Column types

`text`, `number`, `integer`, `currency`, `percent`, `date`, `month`. The formats
are Brazilian: `R$ 1.234,56`, `05/03/2026`, and `month` for the `MM/AAAA`
competência.

Two conversions the builder does on the way in, because exported source data
carries them: a decimal comma with dot thousands (`1.234,56`) becomes a number,
and a `date`/`month` string in any of the common patterns becomes a real date. A
date it cannot parse stays text rather than becoming a **wrong** date — a
silently shifted month is worse than a cell that visibly is not a date.

`text` exists for identifiers. CPF, CNPJ, CEP and invoice numbers look numeric
and are not: as numbers they lose leading zeros and gain thousands separators.

## The theme

`config.theme` is the Compliance workbook look — fonts and ARGB colours for the
header, totals, banding and borders. It lives here because no shared source
exists yet: `plugins/compliance-brand` owns the Web client's brand slots (a logo
painted as a CSS mask), not a document palette. The HTML plugin will need these
same colours, and that is the change that should extract one source; doing it now
would be extracting for a second consumer that does not exist.

## Requirements

`python3` with `openpyxl`. A sheet's `source` additionally needs `pandas`, and a
`.parquet` source needs `pyarrow`. The image built by `deploy/docker/Dockerfile`
installs them; outside Docker they are the host's to provide.

## Tests

```sh
node plugins/compliance-xlsx/tests/smoke.mjs
```

No build, no network, no API key. The end-to-end checks **reopen** each written
workbook and inspect sheet names, number formats, the totals formula, frozen
panes, the autofilter and the chart. Asserting only that a file exists would pass
for a workbook with every format wrong, which is the failure this plugin exists
to prevent. They self-skip when openpyxl is not installed.
