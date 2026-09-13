// Artifacts in the browser: the card in the conversation, and the panel beside it.
//
// Two contributions:
//
//   tool.call.toolview     keyed by each artifact tool's wire name — the card
//                          that replaces the generic tool row and carries the
//                          button that opens the panel.
//   sidebar.right.pane.tab keyed by this plugin's tab-type id — the panel body,
//                          which is one sandboxed iframe pointed at the host
//                          half's route.
//
// The card reads the RESULT's `meta`, not the call arguments. The ECharts card
// reads `argsRaw` because its whole subject is in the arguments; here the
// arguments hold the page, which is what must not be re-read. There is a second
// reason: with backward pagination a settled node's `call` is null when the
// window cut left the `tool/call` outside it, and an args-only card would
// silently lose its open button on older messages. `meta` rides the result node
// itself and is never cropped.
//
// The iframe is sandboxed WITHOUT `allow-same-origin`, so the page gets an
// opaque origin: even though it is served from this same host, it reaches no
// cookie, no storage and no session. Its own CSP — the CDN allowlist — arrives
// as a response header on the route, which is why the page is served from a URL
// instead of handed over as `srcdoc` (a srcdoc frame inherits the embedder's
// policy, so the allowlist would have to be granted to the whole application).
//
// Hand-written in the lazy CJS factory form the client module loader consumes
// (executing this script only REGISTERS the factory; every side effect runs at
// materialization). `react`, `react/jsx-runtime` and the UI primitives are part
// of the shell's implicit external baseline, so no `dsh.client.external` is
// declared.
window.__ModuleLoader__.load({
	id: "@compliance/dsh-artifacts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const { jsx, jsxs } = require("react/jsx-runtime");
		const react = require("react");
		const { Button, IconFullscreenOutline16, IconWarningOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");

		/** This plugin's tab-type id, and the key of its panel body. */
		const TAB_ID = "compliance-artifact";

		/** Address protocol this tab type claims. */
		const ADDRESS_PREFIX = "dsh-resource://artifact/";

		/** Fallbacks, used only if the host half's boot global is absent. */
		const FALLBACK = {
			routePath: "/artifacts",
			createToolName: "create_artifact",
			updateToolName: "update_artifact",
		};

		/** The settings the host half injected, or the defaults. */
		function settings() {
			const injected = globalThis.__COMPLIANCE_ARTIFACTS__;
			if (injected === null || typeof injected !== "object") return FALLBACK;
			return {
				routePath: injected.routePath ?? FALLBACK.routePath,
				createToolName: injected.createToolName ?? FALLBACK.createToolName,
				updateToolName: injected.updateToolName ?? FALLBACK.updateToolName,
			};
		}

		/**
		 * Titles seen when a card opened an artifact, so the tab can label itself.
		 *
		 * The address carries ids and nothing else, and a tab title is decided from
		 * the address alone. Sidebar state is memory-only anyway — a reload
		 * collapses the column — so a map that starts empty loses nothing that
		 * survived the reload.
		 */
		const titles = new Map();

		/** Set by apply, so a card can reach the Sidebar without prop drilling. */
		let openArtifact = null;

		/**
		 * Split an artifact address into its ids.
		 * @param address - the `dsh-resource://artifact/...` address.
		 * @returns the ids, or null when the address is not one of ours.
		 */
		function parseAddress(address) {
			if (typeof address !== "string" || !address.startsWith(ADDRESS_PREFIX)) return null;
			const parts = address.slice(ADDRESS_PREFIX.length).split("/");
			if (parts.length !== 2) return null;
			const [sessionId, artifactId] = parts;
			if (sessionId === "" || artifactId === "") return null;
			return { sessionId, artifactId };
		}

		/**
		 * Build the address for one artifact.
		 * @param sessionId - the owning session.
		 * @param artifactId - the artifact.
		 * @returns the resource address.
		 */
		function addressOf(sessionId, artifactId) {
			return `${ADDRESS_PREFIX}${sessionId}/${artifactId}`;
		}

		/**
		 * The receipt a settled artifact call carries.
		 *
		 * Pure and tolerant of anything the log may hold: this runs on live
		 * streaming and on replay, and a display path that throws takes the replay
		 * down with it.
		 * @param block - the running or settled tool node.
		 * @returns the receipt, or null while the call is still running or if it failed.
		 */
		function receiptOf(block) {
			if (block === null || typeof block !== "object" || !("kind" in block)) return null;
			if (block.isError === true) return null;
			const meta = block.meta;
			if (meta === null || typeof meta !== "object") return null;
			const { artifactId, sessionId, version, title } = meta;
			if (typeof artifactId !== "string" || typeof sessionId !== "string") return null;
			return {
				artifactId,
				sessionId,
				version: typeof version === "number" ? version : 1,
				title: typeof title === "string" && title !== "" ? title : "Artifact",
			};
		}

		/**
		 * The title to show while the call is still streaming.
		 * @param block - the running or settled tool node.
		 * @returns a title that is always a non-empty string.
		 */
		function pendingTitle(block) {
			const raw = (block !== null && typeof block === "object")
				? ("kind" in block ? block.call?.argsRaw : block.argsRaw)
				: undefined;
			if (typeof raw !== "string" || raw === "") return "Artefato";
			// The arguments stream in, so this parse fails for most of the call's
			// life. That is expected, not an error worth reporting.
			try {
				const parsed = JSON.parse(raw);
				const title = parsed?.title;
				return typeof title === "string" && title.trim() !== "" ? title.trim() : "Artefato";
			} catch {
				return "Artefato";
			}
		}

		/**
		 * The failure text of a settled error node.
		 * @param block - the running or settled tool node.
		 * @returns the message, or null when the call did not fail.
		 */
		function failureOf(block) {
			if (block === null || typeof block !== "object" || !("kind" in block) || block.isError !== true) return null;
			const blocks = Array.isArray(block.content) ? block.content : [];
			const text = blocks.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
			return text === "" ? "A geração do artefato falhou." : text;
		}

		// ── the card ──────────────────────────────────────────────────────────

		/** Card chrome, over the shell's own theme tokens. */
		const CARD_STYLE = {
			display: "flex",
			alignItems: "center",
			gap: "12px",
			padding: "12px 14px",
			border: "1px solid var(--dsw-alias-border-2, rgba(127,127,127,0.28))",
			borderRadius: "10px",
			background: "var(--dsw-alias-bg-2, transparent)",
		};

		/**
		 * The artifact card: a title, a version, and the button that opens the panel.
		 * @param props - the toolview owner props.
		 * @returns the card element.
		 */
		function ArtifactToolView(props) {
			const { block } = props;
			const receipt = receiptOf(block);
			const failure = failureOf(block);

			const open = react.useCallback(() => {
				if (receipt === null || openArtifact === null) return;
				titles.set(receipt.artifactId, receipt.title);
				openArtifact(addressOf(receipt.sessionId, receipt.artifactId));
			}, [receipt]);

			if (failure !== null) {
				return jsxs("div", {
					style: { ...CARD_STYLE, color: "var(--dsw-alias-text-error, #d33)" },
					children: [
						jsx(IconWarningOutline16, {}),
						jsx("span", { children: failure }),
					],
				});
			}

			if (receipt === null) {
				return jsx("div", {
					style: { ...CARD_STYLE, opacity: 0.7 },
					children: jsx("span", { children: `Gerando ${pendingTitle(block)}…` }),
				});
			}

			return jsxs("div", {
				style: CARD_STYLE,
				children: [
					jsxs("div", {
						style: { display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 auto" },
						children: [
							jsx("span", {
								style: { fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
								children: receipt.title,
							}),
							jsx("span", {
								style: { fontSize: "12px", opacity: 0.65 },
								children: `Artefato interativo · versão ${String(receipt.version)}`,
							}),
						],
					}),
					jsx(Button, {
						size: "small",
						onClick: open,
						disabled: openArtifact === null,
						children: jsxs("span", {
							style: { display: "inline-flex", alignItems: "center", gap: "6px" },
							children: [jsx(IconFullscreenOutline16, {}), "Abrir"],
						}),
					}),
				],
			});
		}

		// ── the panel ─────────────────────────────────────────────────────────

		/**
		 * The panel body: one sandboxed frame showing the artifact's current version.
		 * @param props - the tab body props; `useTabInfo` arrives from the slot's own inject.
		 * @returns the panel element.
		 */
		function ArtifactTab(props) {
			const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
			const address = info?.tab?.navigation?.address;
			const revision = info?.tab?.navigation?.revision ?? 0;
			const ids = parseAddress(address);

			if (ids === null) {
				return jsx("div", {
					style: { padding: "16px", opacity: 0.7 },
					children: "Este artefato não pôde ser localizado.",
				});
			}

			const { routePath } = settings();
			// `revision` moves on every re-open, including the one a fresh version
			// triggers, and it is in the URL so the frame actually refetches rather
			// than showing the version it already has.
			const src = `${routePath}/${ids.sessionId}/${ids.artifactId}/latest?rev=${String(revision)}`;

			return jsx("iframe", {
				src,
				title: titles.get(ids.artifactId) ?? "Artefato",
				// No `allow-same-origin`: that is what gives the document an opaque
				// origin, so a generated page cannot read this app's cookies, storage
				// or session even though it is served from the same host.
				sandbox: "allow-scripts allow-popups allow-modals",
				referrerPolicy: "no-referrer",
				style: {
					display: "block",
					width: "100%",
					height: "100%",
					border: "0",
					background: "var(--dsw-alias-bg-1, #fff)",
				},
			});
		}

		// ── registration ──────────────────────────────────────────────────────

		/** Required services: the UI slot registry. The Sidebar pair is read optionally. */
		const inject = ["slots"];

		/**
		 * Claim the artifact tools' views and the Sidebar tab type.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			const { createToolName, updateToolName } = settings();

			// Through inject rather than a bare ctx.get: the Sidebar is provided by
			// another plugin, and a plain read at apply would silently miss it on a
			// surface that mounts later, leaving every card's button dead.
			ctx.inject(["sidebarRight", "sidebarRightTabs"], (scoped) => {
				const sidebar = scoped.get("sidebarRight");
				const tabs = scoped.get("sidebarRightTabs");

				openArtifact = (address) => { sidebar.openResource(address); };
				scoped.effect(() => () => { openArtifact = null; }, "artifacts: sidebar opener");

				scoped.effect(() => tabs.register({
					id: TAB_ID,
					kind: "artifact",
					patterns: [`${ADDRESS_PREFIX}**`],
					canOpen: (address) => parseAddress(address) !== null,
					title: (address) => {
						const ids = parseAddress(address);
						return (ids === null ? undefined : titles.get(ids.artifactId)) ?? "Artefato";
					},
				}), "artifacts: sidebar tab type");

				scoped.slots.inject("sidebar.right.pane.tab", function* () {
					yield scoped.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, ArtifactTab);
				});
			});

			ctx.slots.inject("tool.call.toolview", function* () {
				yield ctx.slots.register({ name: "tool.call.toolview", key: createToolName }, ArtifactToolView);
				yield ctx.slots.register({ name: "tool.call.toolview", key: updateToolName }, ArtifactToolView);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.__test__ = { parseAddress, addressOf, receiptOf, pendingTitle, failureOf, TAB_ID };
		return module.exports;
	}
});
