"""Load tabular sources, run one snippet over them, and report a bounded result.

Reads one JSON request on stdin and writes exactly one JSON envelope on stdout.
Both outcomes exit 0: `{"ok": true, ...}` when the snippet ran and `{"ok":
false, "error": ...}` when it raised. A non-zero exit therefore means the
interpreter itself failed, which the Node half reports differently.

The snippet's own prints are captured rather than left on stdout, because
stdout carries the envelope: one stray print would corrupt the frame.
"""

import contextlib
import io
import json
import sys
import traceback

import pandas as pd

#: Extension to reader. The suffix decides, because a caller naming a file
#: `.csv` and handing us Parquet has a problem worth seeing, not guessing at.
READERS = {
    ".csv": lambda path: pd.read_csv(path),
    ".txt": lambda path: pd.read_csv(path),
    ".tsv": lambda path: pd.read_csv(path, sep="\t"),
    ".parquet": lambda path: pd.read_parquet(path),
    ".json": lambda path: pd.read_json(path),
    ".xlsx": lambda path: pd.read_excel(path),
    ".xlsm": lambda path: pd.read_excel(path),
    ".xls": lambda path: pd.read_excel(path),
}

#: Extension to writer, for the optional `output`.
WRITERS = {
    ".csv": lambda frame, path: frame.to_csv(path, index=False),
    ".tsv": lambda frame, path: frame.to_csv(path, sep="\t", index=False),
    ".parquet": lambda frame, path: frame.to_parquet(path, index=False),
    ".json": lambda frame, path: frame.to_json(path, orient="records", date_format="iso"),
}


def suffix_of(path):
    """Return the lowercased extension of a path, including the dot."""
    dot = path.rfind(".")
    return "" if dot < 0 else path[dot:].lower()


def load(path):
    """Read one tabular file into a DataFrame, choosing the reader by extension."""
    suffix = suffix_of(path)
    reader = READERS.get(suffix)
    if reader is None:
        known = ", ".join(sorted(READERS))
        raise ValueError(f"cannot read {path!r}: unsupported extension {suffix!r}; supported: {known}")
    return reader(path)


def as_frame(value):
    """Coerce a snippet result into a DataFrame so one shape describes every result."""
    if isinstance(value, pd.DataFrame):
        return value
    if isinstance(value, pd.Series):
        return value.to_frame()
    if isinstance(value, pd.Index):
        return pd.DataFrame({"value": value})
    # A scalar is a legitimate answer ("how many?"), so it becomes a one-cell
    # frame rather than an error.
    return pd.DataFrame({"value": [value]})


def preview_of(frame, max_rows):
    """Serialize the head of a frame as JSON-safe columns and rows.

    pandas' own JSON writer is used rather than a hand-rolled walk because it
    already maps NaN to null and timestamps to ISO strings.
    """
    head = frame.head(max_rows)
    payload = json.loads(head.to_json(orient="split", date_format="iso"))
    return {
        "columns": [str(column) for column in payload.get("columns", [])],
        "rows": payload.get("data", []),
    }


def run(request):
    """Execute one request and build the success envelope."""
    sources = request["sources"]
    code = request["code"]
    output = request.get("output")
    max_preview_rows = request["maxPreviewRows"]

    namespace = {"pd": pd}
    for source in sources:
        namespace[source["name"]] = load(source["path"])

    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        exec(code, namespace)  # noqa: S102 - running the caller's snippet is this tool's purpose

    if "result" in namespace:
        value = namespace["result"]
    else:
        # Documented fallback: a snippet that reassigns the first frame in place
        # is a natural way to write this, and failing it would be pedantry.
        value = namespace[sources[0]["name"]]

    frame = as_frame(value)
    rows, columns = frame.shape

    written = None
    if output is not None:
        suffix = suffix_of(output)
        writer = WRITERS.get(suffix)
        if writer is None:
            known = ", ".join(sorted(WRITERS))
            raise ValueError(f"cannot write {output!r}: unsupported extension {suffix!r}; supported: {known}")
        writer(frame, output)
        written = output

    return {
        "ok": True,
        "rowCount": int(rows),
        "columnCount": int(columns),
        "columns": [str(column) for column in frame.columns],
        "dtypes": {str(name): str(dtype) for name, dtype in frame.dtypes.items()},
        "preview": preview_of(frame, max_preview_rows),
        "previewTruncated": bool(rows > max_preview_rows),
        "stdout": captured.getvalue(),
        "output": written,
    }


def main():
    """Read the request, run it, and emit exactly one envelope."""
    try:
        request = json.load(sys.stdin)
    except Exception as error:  # noqa: BLE001 - a malformed request is still an envelope
        json.dump({"ok": False, "error": f"the request is not JSON: {error}"}, sys.stdout)
        return

    try:
        envelope = run(request)
    except Exception as error:  # noqa: BLE001 - every analysis failure is the model's to fix
        # The last traceback frame names the snippet line that failed, which is
        # what makes the message actionable; the rest is this runner's own stack.
        last = traceback.format_exc().strip().splitlines()[-1]
        envelope = {"ok": False, "error": f"{type(error).__name__}: {error}" if str(error) else last}

    json.dump(envelope, sys.stdout, ensure_ascii=False, default=str)


if __name__ == "__main__":
    main()
