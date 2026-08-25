// The chart card: what a `render_chart` call looks like in the conversation.
//
// Registered into `tool.call.toolview`, the keyed slot whose key is a wire tool
// name. Claiming this tool's name replaces the generic tool row with the chart;
// every other tool is untouched, and a composition without this half falls back
// to the generic card the host half's `presentCall` describes.
//
// Everything drawn here comes from the CALL ARGUMENTS, which the session log
// already keeps. That is what makes the chart survive a reload and a replay
// without this plugin persisting anything: the toolview re-parses `argsRaw` and
// draws again. It also means the chart appears as soon as the arguments finish
// streaming, before the tool result lands.
//
// The ECharts bundle is NOT part of this file. It is a megabyte, and a client
// bundle is fetched and applied at every web boot, chart or no chart — so it
// lives behind the host half's route and is injected as a classic script the
// first time a conversation actually shows a chart.
//
// Hand-written in the lazy CJS factory form the client module loader consumes
// (executing this script only REGISTERS the factory; every side effect runs at
// materialization). `react`, `react/jsx-runtime` and the UI primitives are part
// of the shell's implicit external baseline, so no `dsh.client.external` is
// declared.
window.__ModuleLoader__.load({
	id: "@compliance/dsh-echarts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const { jsx, jsxs } = require("react/jsx-runtime");
		const react = require("react");
		const {
			Button,
			IconCloseOutline16,
			IconDownloadOutline16,
			IconFullscreenOutline16,
			IconWarningOutline16,
		} = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Fallbacks, used only if the host half's boot global is absent. */
		const FALLBACK = { assetPath: "/echarts/echarts.min.js", toolName: "render_chart" };

		/** The settings the host half injected, or the defaults. */
		function settings() {
			const injected = globalThis.__ECHARTS_CHARTS__;
			if (injected === null || typeof injected !== "object") return FALLBACK;
			return {
				assetPath: injected.assetPath ?? FALLBACK.assetPath,
				toolName: injected.toolName ?? FALLBACK.toolName,
			};
		}

		// ── the ECharts bundle ────────────────────────────────────────────────

		/** In-flight or settled bundle load; one per page, shared by every card. */
		let pendingBundle;

		/**
		 * Load the vendored ECharts UMD bundle from the host half's route.
		 *
		 * A classic script rather than the client module table: a module-table row
		 * is created and applied at every web boot, which is exactly the cost this
		 * plugin exists to avoid paying on conversations with no chart in them.
		 * @returns the `echarts` namespace.
		 */
		function loadEcharts() {
			if (pendingBundle !== undefined) return pendingBundle;
			pendingBundle = new Promise((resolve, reject) => {
				if (globalThis.echarts !== undefined) {
					resolve(globalThis.echarts);
					return;
				}
				const el = document.createElement("script");
				el.async = true;
				el.src = settings().assetPath;
				el.addEventListener("load", () => {
					el.remove();
					if (globalThis.echarts === undefined) {
						reject(new Error(`${el.src} loaded but published no global echarts`));
						return;
					}
					resolve(globalThis.echarts);
				}, { once: true });
				el.addEventListener("error", () => {
					el.remove();
					reject(new Error(`could not load ${el.src}`));
				}, { once: true });
				document.head.append(el);
			});
			// A failed load must not poison the rest of the session: drop the memo so
			// the next chart retries instead of replaying one network hiccup forever.
			pendingBundle.catch(() => { pendingBundle = undefined; });
			return pendingBundle;
		}

		// ── theme ─────────────────────────────────────────────────────────────

		/** Cards subscribed to theme changes. */
		const themeListeners = new Set();

		/**
		 * The appearance the system asks for, as an ECharts theme name.
		 *
		 * The fallback source: it is also what the shell resolves to while the user's
		 * preference is `system`.
		 * @returns an ECharts theme name.
		 */
		const systemTheme = () => (
			typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "default"
		);

		/**
		 * Which registered ECharts theme matches the harness's current appearance.
		 * Bound to the theme service by `apply` once that service exists.
		 */
		let readEchartsTheme = systemTheme;

		/** Tell every mounted card to re-read the theme. */
		function notifyTheme() {
			for (const listener of themeListeners) listener();
		}

		/**
		 * Subscribe this card to the harness theme.
		 * @returns the current ECharts theme name.
		 */
		function useEchartsTheme() {
			const [theme, setTheme] = react.useState(readEchartsTheme);
			react.useEffect(() => {
				const listener = () => { setTheme(readEchartsTheme()); };
				themeListeners.add(listener);
				// Re-read on mount: the theme may have changed between the initial
				// state and this effect.
				listener();
				return () => { themeListeners.delete(listener); };
			}, []);
			return theme;
		}

		// ── reading the call ──────────────────────────────────────────────────

		/**
		 * The call's raw arguments, in both block forms.
		 *
		 * A settled block carries `kind` and holds the call head under `call`, which
		 * is null when window truncation left the call outside the loaded page.
		 * @param block - the running or settled tool call.
		 * @returns the raw JSON string, or the empty string when unavailable.
		 */
		function argsRawOf(block) {
			return ("kind" in block ? block.call?.argsRaw : block.argsRaw) ?? "";
		}

		/**
		 * Parse the arguments, tolerating everything the log may hold.
		 *
		 * Mid-stream truncation, a rejected call's verbatim arguments and malformed
		 * model JSON all land here, and none of them may throw: this runs on replay
		 * too, where a throw would take the whole conversation down.
		 * @param raw - the raw arguments.
		 * @returns the arguments when they carry a usable option, else null.
		 */
		function parseArgs(raw) {
			if (raw === "") return null;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return null;
			}
			if (typeof parsed !== "object" || parsed === null) return null;
			const option = parsed.option;
			if (typeof option !== "object" || option === null || Array.isArray(option)) return null;
			return parsed;
		}

		/**
		 * The failure text of a settled, failed call.
		 * @param block - the running or settled tool call.
		 * @returns the model-facing rejection text, or null when the call did not fail.
		 */
		function failureOf(block) {
			if (!("kind" in block) || block.isError !== true) return null;
			const text = (block.content ?? [])
				.filter(entry => entry?.type === "text")
				.map(entry => entry.text)
				.join("\n")
				.trim();
			return text === "" ? "The chart was rejected." : text;
		}

		/**
		 * The card height the call asked for, clamped to something a card can hold.
		 * @param args - the parsed arguments.
		 * @returns a height in CSS pixels.
		 */
		function heightOf(args) {
			const height = args.height;
			if (typeof height !== "number" || !Number.isFinite(height)) return 320;
			return Math.min(Math.max(Math.round(height), 160), 720);
		}

		/** The card title; never empty, never trusted to be a string. */
		function titleOf(args) {
			const title = args?.title;
			return typeof title === "string" && title.trim() !== "" ? title.trim() : "Chart";
		}

		// ── styles ────────────────────────────────────────────────────────────
		//
		// Alias tokens with fallbacks: the shell defines them, and a composition
		// that does not still renders a legible card instead of an invisible one.

		const CARD_STYLE = {
			border: "1px solid var(--dsw-alias-border-l2, currentColor)",
			borderRadius: "10px",
			background: "var(--dsw-alias-bg-layer-1, transparent)",
			overflow: "hidden",
			margin: "4px 0",
		};

		const HEADER_STYLE = {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "6px 6px 6px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-l2, currentColor)",
		};

		const TITLE_STYLE = {
			flex: "1 1 auto",
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontSize: "var(--dsw-font-xs-13, 13px)",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary, inherit)",
		};

		const CAPTION_STYLE = {
			padding: "0 12px 10px",
			fontSize: "var(--dsw-font-xs-13, 13px)",
			color: "var(--dsw-alias-label-tertiary, inherit)",
		};

		const NOTICE_STYLE = {
			display: "flex",
			alignItems: "flex-start",
			gap: "8px",
			padding: "10px 12px",
			fontSize: "var(--dsw-font-xs-13, 13px)",
			color: "var(--dsw-alias-label-secondary, inherit)",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
		};

		const OVERLAY_STYLE = {
			position: "fixed",
			inset: 0,
			zIndex: 60,
			display: "flex",
			flexDirection: "column",
			padding: "24px",
			gap: "12px",
			background: "var(--dsw-alias-bg-layer-1, #000)",
		};

		// ── the chart ─────────────────────────────────────────────────────────

		/**
		 * One live ECharts instance over one option.
		 *
		 * The instance is created once and then steered: `setOption` on an argument
		 * change and `setTheme` on an appearance change, rather than disposing and
		 * re-initializing, so switching the theme does not replay every animation.
		 * @param props.option - the parsed ECharts option.
		 * @param props.optionKey - identity of that option (the raw arguments).
		 * @param props.height - card height in CSS pixels; 0 fills the flex parent.
		 * @param props.onChart - receives the instance, for the toolbar's actions.
		 */
		function Chart({ option, optionKey, height, onChart }) {
			const hostRef = react.useRef(null);
			const chartRef = react.useRef(null);
			const optionRef = react.useRef(option);
			const theme = useEchartsTheme();
			const themeRef = react.useRef(theme);
			const [ready, setReady] = react.useState(false);
			const [failure, setFailure] = react.useState(null);

			optionRef.current = option;
			themeRef.current = theme;

			react.useEffect(() => {
				const host = hostRef.current;
				if (host === null) return undefined;
				let live = true;
				let observer;
				loadEcharts().then((echarts) => {
					if (!live) return;
					// The refs, not the captured values: the option or the theme may
					// have changed while the bundle was in flight.
					const chart = echarts.init(host, themeRef.current, { renderer: "canvas" });
					chart.setOption({ backgroundColor: "transparent", ...optionRef.current });
					chartRef.current = chart;
					onChart?.(chart);
					observer = new ResizeObserver(() => { chart.resize(); });
					observer.observe(host);
					setReady(true);
				}, (error) => {
					if (live) setFailure(error?.message ?? String(error));
				});
				return () => {
					live = false;
					observer?.disconnect();
					chartRef.current?.dispose();
					chartRef.current = null;
					onChart?.(null);
				};
				// Mount-only: the instance outlives option and theme changes, which
				// the two effects below apply to it.
			}, []);

			react.useEffect(() => {
				if (!ready) return;
				// notMerge: a new option replaces the old one. Merging would leave a
				// removed series or axis on screen.
				chartRef.current?.setOption({ backgroundColor: "transparent", ...option }, { notMerge: true });
			}, [ready, optionKey]);

			react.useEffect(() => {
				if (!ready) return;
				chartRef.current?.setTheme(theme);
			}, [ready, theme]);

			if (failure !== null) {
				return jsxs("div", {
					style: NOTICE_STYLE,
					children: [
						jsx(IconWarningOutline16, {}),
						jsx("span", { children: `The charting library could not be loaded: ${failure}` }),
					],
				});
			}
			return jsx("div", {
				ref: hostRef,
				// height 0 means "fill the flex parent" — what the expanded overlay wants.
				style: { width: "100%", height: height === 0 ? "100%" : `${String(height)}px` },
			});
		}

		/**
		 * Save the chart as a PNG.
		 *
		 * `getDataURL` needs the canvas renderer, which is why the instance asks for
		 * it. The anchor is created, clicked and dropped: there is no server round
		 * trip and nothing to clean up but the element.
		 * @param chart - the live instance.
		 * @param title - used for the file name.
		 */
		function downloadPng(chart, title) {
			const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "transparent" });
			const link = document.createElement("a");
			link.href = url;
			link.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "chart"}.png`;
			document.body.append(link);
			link.click();
			link.remove();
		}

		// ── the card ──────────────────────────────────────────────────────────

		/**
		 * The whole card for one `render_chart` call.
		 * @param props.block - the frozen running or settled call.
		 */
		function ChartToolView({ block }) {
			const raw = argsRawOf(block);
			const args = react.useMemo(() => parseArgs(raw), [raw]);
			const failure = failureOf(block);
			const [expanded, setExpanded] = react.useState(false);
			const chartRef = react.useRef(null);
			const overlayChartRef = react.useRef(null);

			react.useEffect(() => {
				if (!expanded) return undefined;
				const onKey = (event) => { if (event.key === "Escape") setExpanded(false); };
				window.addEventListener("keydown", onKey);
				return () => { window.removeEventListener("keydown", onKey); };
			}, [expanded]);

			const title = titleOf(args);

			if (failure !== null) {
				return jsx("div", {
					style: CARD_STYLE,
					children: jsxs("div", {
						style: NOTICE_STYLE,
						children: [
							jsx(IconWarningOutline16, {}),
							jsxs("span", {
								children: [
									jsx("strong", { children: `${title}: ` }),
									failure,
								],
							}),
						],
					}),
				});
			}

			if (args === null) {
				// Arguments still streaming, or a call whose head fell outside the
				// loaded window. Say so instead of showing an empty frame.
				return jsx("div", {
					style: CARD_STYLE,
					children: jsx("div", { style: NOTICE_STYLE, children: "Building chart…" }),
				});
			}

			const height = heightOf(args);
			const caption = typeof args.caption === "string" && args.caption.trim() !== ""
				? args.caption.trim()
				: null;

			const action = (icon, label, onClick) => jsx(Button, {
				variant: "toolbar",
				size: "sm",
				icon,
				"aria-label": label,
				title: label,
				onClick,
			});

			return jsxs(react.Fragment, {
				children: [
					jsxs("div", {
						style: CARD_STYLE,
						children: [
							jsxs("div", {
								style: HEADER_STYLE,
								children: [
									jsx("span", { style: TITLE_STYLE, title, children: title }),
									action(jsx(IconDownloadOutline16, {}), "Save as PNG", () => {
										const chart = chartRef.current;
										if (chart !== null) downloadPng(chart, title);
									}),
									action(jsx(IconFullscreenOutline16, {}), "Expand", () => { setExpanded(true); }),
								],
							}),
							jsx(Chart, {
								option: args.option,
								optionKey: raw,
								height,
								onChart: (chart) => { chartRef.current = chart; },
							}),
							caption === null ? null : jsx("div", { style: CAPTION_STYLE, children: caption }),
						],
					}),
					// A second instance rather than moving the live canvas into the
					// overlay: the library is already loaded, and re-parenting a canvas
					// costs a full re-init anyway.
					!expanded ? null : jsx("div", {
						style: OVERLAY_STYLE,
						role: "dialog",
						"aria-modal": "true",
						"aria-label": title,
						children: jsxs("div", {
							style: { display: "flex", flexDirection: "column", height: "100%", gap: "12px" },
							children: [
								jsxs("div", {
									style: { display: "flex", alignItems: "center", gap: "8px" },
									children: [
										jsx("span", { style: { ...TITLE_STYLE, fontSize: "15px" }, children: title }),
										action(jsx(IconDownloadOutline16, {}), "Save as PNG", () => {
											const chart = overlayChartRef.current;
											if (chart !== null) downloadPng(chart, title);
										}),
										action(jsx(IconCloseOutline16, {}), "Close", () => { setExpanded(false); }),
									],
								}),
								jsx("div", {
									style: { flex: "1 1 auto", minHeight: 0 },
									children: jsx(Chart, {
										option: args.option,
										optionKey: `overlay:${raw}`,
										height: 0,
										onChart: (chart) => { overlayChartRef.current = chart; },
									}),
								}),
								caption === null ? null : jsx("div", { style: { ...CAPTION_STYLE, padding: 0 }, children: caption }),
							],
						}),
					}),
				],
			});
		}

		/** Required services: the UI slot registry. `theme` is read optionally. */
		const inject = ["slots"];

		/**
		 * Claim the chart tool's atomic view.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			if (typeof matchMedia === "function") {
				// Kept even when the theme service arrives: with the preference on
				// `system`, the service's own resolution follows this same signal.
				ctx.effect(() => {
					const media = matchMedia("(prefers-color-scheme: dark)");
					media.addEventListener("change", notifyTheme);
					return () => { media.removeEventListener("change", notifyTheme); };
				}, "echarts: prefers-color-scheme listener");
			}

			// Through inject rather than a bare ctx.get: `theme` is provided by
			// another plugin, and a plain read at apply would silently miss it and
			// leave every chart following the system instead of the user's choice.
			ctx.inject(["theme"], (scoped) => {
				const theme = scoped.get("theme");
				readEchartsTheme = () => (theme.getTheme().active.colorScheme === "dark" ? "dark" : "default");
				scoped.on("theme/change", notifyTheme);
				notifyTheme();
				scoped.effect(() => () => {
					readEchartsTheme = systemTheme;
					notifyTheme();
				}, "echarts: theme reader");
			});

			ctx.slots.inject("tool.call.toolview", function* () {
				yield ctx.slots.register({
					name: "tool.call.toolview",
					key: settings().toolName,
				}, ChartToolView);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
