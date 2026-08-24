---
name: echarts-charts
description: Choose and build the right Apache ECharts option for the render_chart tool. Read this before the first chart of a conversation, and whenever a chart has more than one series - it decides bar vs line vs stacked vs scatter vs heatmap, gives a working option skeleton per type, and carries the two rules that silently ruin a card: the legend must be positioned explicitly with grid reserving its side (ECharts 6 defaults it onto the bars), and values spanning more than one order of magnitude must not share a linear axis.
whenToUse: Before calling render_chart, or when a chart came out unreadable and needs a different form.
---

# Charting with ECharts in the conversation

`render_chart({ option, title?, caption?, height? })` puts one chart on the card of
that tool call. **You never see the result.** There is no iteration loop where you
look at the picture and fix it, so the option has to be right when you send it.

The data travels inline in `option` and stays in the conversation for every later
turn. Aggregate before charting.

## First: is a chart the answer?

Chart when the answer is a **shape** — a trend, a comparison across many
categories, a distribution, an outlier, a correlation.

Do not chart:

- Three numbers or fewer. Write the sentence.
- A table the user asked for as a table.
- One number against one target — say it, or use `gauge` only if the user is
  watching a target over time.
- Something you are not confident about. A wrong chart reads as authoritative in a
  way wrong prose does not.

One chart answers one question. Two questions, two calls.

## Pick the form from the question

| The question | Form | Notes |
|---|---|---|
| How do these categories compare? | `bar` | Horizontal (`yAxis` categorical) when labels are long or there are more than ~8 |
| How did this change over time? | `line` | `smooth: false`. Time is always the x axis |
| How did the total change, and who made it up? | `bar` with `stack` | Stacked bar, not stacked area, unless the total is continuous |
| What share is each part of the whole? | `bar` with `stack` over one column, or `pie` | `pie` only with 5 slices or fewer and only when the whole is the point |
| Are these two measures related? | `scatter` | Add `symbolSize` for a third measure |
| How is this spread out? | `boxplot`, or `bar` over pre-bucketed ranges | Bucket yourself; there is no histogram series |
| Where is the concentration across two dimensions? | `heatmap` | Needs `visualMap`. Good for weekday x hour, unit x month |
| Progress toward one target, right now | `gauge` | One number only. Usually prose is better |
| How does each item rank on several measures? | `radar` | At most 3 items, 4-7 axes, all normalized to a shared scale |

Two measures on different scales in one chart: two `yAxis` entries and
`yAxisIndex` on the second series. Do it only when the pairing is the point, and
say in `caption` which series reads on which axis.

## Option skeletons

Copy the shape, replace the data. Everything below is valid JSON.

### Bar, categories compared

```json
{
  "tooltip": { "trigger": "axis", "axisPointer": { "type": "shadow" } },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 8, "containLabel": true },
  "xAxis": { "type": "category", "data": ["Jan", "Fev", "Mar"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "name": "Faltas", "data": [12, 8, 15] }]
}
```

Long labels: swap the axes (`xAxis` becomes `{ "type": "value" }`, `yAxis` becomes
the category one) and sort the data descending yourself. Do not rely on label
rotation to rescue a horizontal axis with 20 categories.

### Line, change over time

```json
{
  "tooltip": { "trigger": "axis" },
  "legend": { "top": 0 },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 8, "containLabel": true },
  "xAxis": { "type": "category", "boundaryGap": false, "data": ["2026-01", "2026-02", "2026-03"] },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "line", "name": "Admissões", "data": [14, 9, 21] },
    { "type": "line", "name": "Desligamentos", "data": [7, 11, 8] }
  ]
}
```

`boundaryGap: false` on a line's category axis; leave it default for bars.

### Stacked bar, composition of a total

```json
{
  "tooltip": { "trigger": "axis" },
  "legend": { "top": 0 },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 8, "containLabel": true },
  "xAxis": { "type": "category", "data": ["Jan", "Fev", "Mar"] },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "bar", "stack": "total", "name": "Atestado", "data": [5, 3, 6] },
    { "type": "bar", "stack": "total", "name": "Injustificada", "data": [7, 5, 9] }
  ]
}
```

Every series in one stack shares the same `stack` string.

### Many series over one table: `dataset` + `encode`

When several series read the same rows, send the table once instead of repeating
the categories in every series:

```json
{
  "tooltip": { "trigger": "axis" },
  "legend": { "top": 0 },
  "dataset": {
    "source": [
      ["mes", "admissoes", "desligamentos"],
      ["2026-01", 14, 7],
      ["2026-02", 9, 11]
    ]
  },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 8, "containLabel": true },
  "xAxis": { "type": "category" },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "bar", "encode": { "x": "mes", "y": "admissoes" } },
    { "type": "bar", "encode": { "x": "mes", "y": "desligamentos" } }
  ]
}
```

The first row is the header; series names come from the encoded column.

### Scatter, two measures

```json
{
  "tooltip": { "trigger": "item" },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 8, "containLabel": true },
  "xAxis": { "type": "value", "name": "Tempo de casa (meses)" },
  "yAxis": { "type": "value", "name": "Horas extras/mês" },
  "series": [{ "type": "scatter", "data": [[6, 12], [18, 4], [36, 2]] }]
}
```

### Heatmap, concentration across two dimensions

```json
{
  "tooltip": { "trigger": "item" },
  "grid": { "left": 8, "right": 16, "top": 32, "bottom": 48, "containLabel": true },
  "xAxis": { "type": "category", "data": ["Seg", "Ter", "Qua", "Qui", "Sex"] },
  "yAxis": { "type": "category", "data": ["Manhã", "Tarde", "Noite"] },
  "visualMap": { "min": 0, "max": 20, "orient": "horizontal", "left": "center", "bottom": 0 },
  "series": [{ "type": "heatmap", "data": [[0, 0, 5], [1, 0, 12], [2, 1, 3]] }]
}
```

Heatmap data is `[xIndex, yIndex, value]`, and `visualMap` is required — without
it every cell is the same color.

## Legend and grid must agree

**ECharts 6 puts the legend at the BOTTOM by default.** `legend: {}` resolves to
`{ left: 'center', bottom: 15 }` — in ECharts 5 it was the top, so most examples
you have seen are wrong for this version. Paired with a small `grid.bottom`, the
legend lands *inside* the plot, on top of the bars and the category labels.

So never write a bare `legend: {}`. Say where it goes, and reserve that side in
`grid`:

```json
{ "legend": { "top": 0 }, "grid": { "top": 32, "bottom": 8, "containLabel": true } }
```

Bottom legend is fine too, as long as the space is reserved:

```json
{ "legend": { "bottom": 0 }, "grid": { "top": 8, "bottom": 40, "containLabel": true } }
```

Prefer the top: the card already has a title above the chart, and the bottom is
where the category labels live. With more than about four entries add
`"type": "scroll"`.

A single series needs no legend at all — the title already names it. Drop it and
give the plot the space.

## One axis, one order of magnitude

A linear value axis can only show values within roughly one order of magnitude of
each other. Put `2,315,000` and `15,400` on the same axis and the second is a
flat line: the chart then *contradicts* the finding you are about to write, which
is worse than no chart.

Before charting, compare the largest and smallest non-zero value. **If the ratio
is above ~20, do not put them on one linear axis.** Pick one:

- **Split into two charts.** Usually right: they are two different questions.
  One `render_chart` call each.
- **Chart the variation instead of the levels.** If the point is "descontos rose
  195% while proventos fell 0.7%", then percent change *is* the measure — one bar
  per item, `axisLabel.formatter: "{value}%"`, and the small item is finally
  visible.
- **Two axes**, `yAxisIndex: 1` on the second series, only when the pairing is
  the point. Say in `caption` which series reads on which axis.
- **`"yAxis": { "type": "log" }`**, only for data that is genuinely
  multiplicative and never zero or negative. A log axis misleads a reader who
  does not notice it; label it in `caption`.

The same test applies across categories of one series, not just between series.

## Axes and numbers

- **A bar's value axis starts at zero.** Never set `min` on it to "show the
  difference better"; that is the classic misleading chart. A line chart may start
  elsewhere when the variation is small relative to the level.
- **Do not use `yAxis.name` for a unit.** ECharts 6 parks it above the topmost
  label, where it reads as a stray `R$` colliding with `R$ 2,500,000`. Put the
  unit in `axisLabel.formatter`, or in the tool's `title`/`caption`.
- Percent: `"yAxis": { "type": "value", "axisLabel": { "formatter": "{value}%" }, "max": 100 }`.
- Currency: `"axisLabel": { "formatter": "R$ {value}" }`. Above ~100,000 that
  produces labels like `R$ 2,500,000` that eat a third of a narrow card, so
  **divide the data yourself** and put the scale in the formatter — send `2315.0`
  with `"formatter": "R$ {value} mil"`, or `2.32` with `"R$ {value} mi"`. There is
  no function formatter to do it for you, so the division is yours.
- Dates: send them already formatted as strings on a `category` axis
  (`"2026-01"`, `"01/02"`). A `time` axis needs real timestamps and gives you
  locale surprises for no gain here.
- Sort bar categories by value, descending, unless the categories have a natural
  order (months, ranges, sizes). Do the sorting when you build the data.

## What fits on the card

The card is narrow. It is roughly 320px tall by default; ask for more with
`height` (up to 720) when you have many horizontal bars or a scrolling legend.

- More than **12 series is rejected** by the tool. More than 5 is already hard to
  read: aggregate the tail into "Outros".
- More than ~40 categories on a horizontal axis is unreadable. Take the top N and
  say so in `caption`.
- Long series: add `"dataZoom": [{ "type": "inside" }]` so the user can zoom, and
  still aggregate first — hundreds of points cost context on every later turn.
- Many legend entries: `"legend": { "top": 0, "type": "scroll" }`, and raise
  `height` — a wrapped legend eats the plot.
- `"grid": { "containLabel": true }` always. Without it long labels are clipped.
- Keep axis labels short. `R$ 2,500,000` costs a third of the width; `R$ 2.500
  mil` costs a tenth. See the currency rule above.

## Color and theme

The harness switches the chart between the light and dark ECharts themes to match
the user's own theme, live.

- **Do not set `color`, `backgroundColor`, `textStyle.color`, or per-series
  colors.** A palette that looks right on white becomes illegible on dark, and the
  theme already picks a coherent one.
- The exception is semantic color: positive vs negative, approved vs rejected,
  within-policy vs outside. Set `itemStyle.color` on just those series, and pick
  colors that read on both backgrounds (a mid-tone green/red, not pastel).
- Do not add `title` to the option — pass `title` to the tool instead, so the card
  header and the chart agree.

## JSON-only rules

`option` is serialized as JSON. Anything that is not JSON is silently lost or
makes the call fail:

- **No functions.** `formatter` must be a **string template**: `"{b}: {c}"` in a
  tooltip, `"{value}%"` on an axis label. `{b}` is the category, `{c}` the value,
  `{a}` the series name.
- No `Date` objects, no `undefined`, no `NaN`, no `Infinity`. A missing point is
  `null` — ECharts draws a gap for it, which is the honest rendering.
- No `require`/`import`, no images, no external URLs.

## Before you call

1. Is a chart really better than a sentence here?
2. Does the form match the question in the table above?
3. **Largest value under ~20x the smallest non-zero one?** If not, split the chart
   or chart the variation — otherwise the small series is an invisible flat line.
4. **Legend positioned explicitly, with `grid` reserving that side?** A bare
   `legend: {}` lands on the bars in this version. One series: no legend.
5. Value axis starts at zero if there are bars?
6. Are the categories sorted the way a reader would want?
7. Series count under 5, definitely under 12? Point count aggregated?
8. Axis labels short — data pre-divided instead of `R$ 2,500,000`? No `yAxis.name`
   holding a unit?
9. `grid.containLabel: true`, no hardcoded colors, no functions?
10. Does `title` say what the chart shows, and `caption` how to read it or where it
    came from?

**Does the chart actually show the thing your caption claims?** If the caption
says a number tripled and the bar for it is a flat line, the chart is wrong, not
the caption.

Then say in your reply what the chart shows. The user should not have to infer the
finding from the picture.
