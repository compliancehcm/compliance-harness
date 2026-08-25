# Vendored Apache ECharts

`echarts.min.js` is the unmodified `dist/echarts.min.js` of the npm package
`echarts`, committed here rather than installed because `plugins/` is not a pnpm
workspace member and therefore has no `node_modules` of its own.

| | |
|---|---|
| Package | `echarts` |
| Version | `6.1.0` |
| File | `dist/echarts.min.js` (the full build: every chart type plus the bundled `zrender`) |
| sha256 | `b66b25aeb4df84e33199dc21694014d336d222cbd9deb0e5a7c14bd6aa0d0fd0` |
| License | Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE) |

The full build is deliberate: the model chooses the chart type at runtime, so a
trimmed build would turn a chart type into a deployment decision.

The browser gets this file from the plugin's own route (`assetPath`, default
`/echarts/echarts.min.js`), injected as a classic script on the first chart of a
session. It is the UMD build, so it publishes `window.echarts`.

## Refreshing

```sh
node plugins/compliance-echarts/scripts/vendor-echarts.mjs 6.1.0
```

The script downloads that exact version through `npm pack`, copies `LICENSE`,
`NOTICE`, and `dist/echarts.min.js` into this directory, and prints the new
sha256 — update the table above, `../README.md`, and the repository's
`THIRD_PARTY_NOTICES.md` with it. Run without a version argument to re-verify the
committed file against the sha256 recorded above without changing anything.
