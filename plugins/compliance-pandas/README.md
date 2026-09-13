# @compliance/dsh-pandas

Tabular analysis with pandas in the conversation: the `run_pandas` tool, the
bundled Python runner behind it, and the `pandas-analysis` skill that drives it.

## Layout

The JavaScript here *is* the source — there is no build — so the halves sit at
the package root rather than under `lib/`, which the repository `.gitignore`
ignores at any depth.

| File | Role |
|---|---|
| `index.js` | The row: resolves the interpreter at apply, then registers the tool and the skill. |
| `src/config.js` | Validates the row's `config`; every problem is reported in one throw at load. |
| `src/tool.js` | The `run_pandas` definition: JSON Schema, argument validation, presenters. |
| `src/python.js` | One JSON request in, one JSON envelope out, over `ctx.subprocess`. |
| `py/runner.py` | Loads the sources, runs the snippet, reports a bounded description. |
| `skills/pandas-analysis/SKILL.md` | The skill body, edited as Markdown rather than as a string. |

## What the tool returns

A **description** of the result frame — shape, column dtypes, a head preview,
and whatever the snippet printed — never every row. A tool that returned the
whole frame would put the dataset in the conversation, where every later turn
re-sends it. For a large result, the call's `output` writes a file and the model
passes that path on; `write_xlsx` in `@compliance/dsh-xlsx` reads it as a sheet
`source`, so the rows never enter the conversation at all.

## Failure modes, and which is which

- **The interpreter is missing.** `apply` throws at boot, naming `pythonBin`. A
  deployment without Python is a broken install, not a runtime surprise on the
  first data question.
- **The snippet raised.** The runner exits 0 with `{"ok": false, "error": …}`
  and the tool reports the Python error verbatim. This is the model's to fix.
- **The interpreter itself failed** — a missing module, a kill, a syntax error in
  the shipped script. Non-zero exit, reported with the child's stderr attached.

Keeping the middle case off the exit code is what lets the other two name
themselves instead of arriving as an indistinguishable "python failed".

## Requirements

`python3` with `pandas`. Reading `.parquet` additionally needs `pyarrow`, and
reading `.xlsx` needs `openpyxl`. The image built by `deploy/docker/Dockerfile`
installs them; outside Docker they are the host's to provide.

## Configuration

Every tunable is a field on the row's `config` — see
`plugins/compliance-pandas.overlay.yml` for the shipped values. An unknown field
is a rejection rather than a warning, because an ignored key reads as "the
setting I wrote took effect".

`maxPreviewRows` and `maxOutputBytes` bound what reaches the model;
`maxSources`, `maxCodeBytes` and `timeoutMs` bound what reaches the interpreter.

## Tests

```sh
node plugins/compliance-pandas/tests/smoke.mjs
```

No build, no network, no API key. The end-to-end checks spawn the real runner
and self-skip when `python3` with pandas is not installed, so the file still
reports on a bare host.
