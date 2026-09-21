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
		const {
			Button,
			IconArchiveOutline20,
			IconCloseOutline16,
			IconFolderOpenOutline16,
			IconFullscreenOutline16,
			IconRefreshOutline16,
			IconSearchOutline16,
			IconWarningOutline16,
		} = require("@deepseek-ai/dsh-client-ui-primitives");

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
			border: "1px solid var(--dsw-alias-border-l3)",
			borderRadius: "10px",
			background: "var(--dsw-alias-bg-layer-2)",
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
					style: { ...CARD_STYLE, color: "var(--dsw-alias-state-error-primary)" },
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
					background: "var(--dsw-alias-bg-layer-1)",
				},
			});
		}

		// ── the gallery ───────────────────────────────────────────────────────
		//
		// An artifact is easy to make and easy to lose: it lives in the turn that
		// produced it, so finding last week's dashboard means remembering which
		// conversation it came from. The gallery is the answer to "where did I put
		// that", and it is therefore keyed by the person's whole store rather than
		// by the open session.

		/** Logical viewport a thumbnail renders at before it is scaled down. */
		const THUMB_WIDTH = 1280;

		/** Logical height of that viewport; the 16:10 crop a dashboard reads well in. */
		const THUMB_HEIGHT = 800;

		/**
		 * Open/closed state of the overlay.
		 *
		 * Module-level because the trigger and the surface are two separate slot
		 * entries with no common ancestor to hold a hook: the sidebar renders the
		 * button, the app frame renders the overlay, and neither owns the other.
		 */
		const gallery = {
			open: false,
			listeners: new Set(),
			set(next) {
				if (gallery.open === next) return;
				gallery.open = next;
				for (const listener of gallery.listeners) listener();
			},
			subscribe(listener) {
				gallery.listeners.add(listener);
				return () => { gallery.listeners.delete(listener); };
			},
			snapshot() { return gallery.open; },
		};

		/**
		 * Subscribe a component to the overlay's open state.
		 * @returns whether the gallery is open.
		 */
		function useGalleryOpen() {
			return react.useSyncExternalStore(gallery.subscribe, gallery.snapshot, gallery.snapshot);
		}

		/**
		 * The local calendar day of an instant, as `YYYY-MM-DD`.
		 *
		 * Local, not UTC: the date inputs a person fills are the days their own
		 * clock shows, and an artifact made at 21:00 in Brazil is stored with
		 * tomorrow's UTC date.
		 * @param iso - an ISO instant, or anything else.
		 * @returns the day, or null when the value is not a readable instant.
		 */
		function localDay(iso) {
			if (typeof iso !== "string") return null;
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return null;
			const month = String(at.getMonth() + 1).padStart(2, "0");
			const day = String(at.getDate()).padStart(2, "0");
			return `${String(at.getFullYear())}-${month}-${day}`;
		}

		/**
		 * An instant as the person's locale writes it.
		 * @param iso - an ISO instant.
		 * @returns a short date and time, or an em dash when unreadable.
		 */
		function formatWhen(iso) {
			if (typeof iso !== "string") return "—";
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return "—";
			return at.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
		}

		/**
		 * Narrow an index by the filter bar's three controls.
		 *
		 * Pure, and exported for test: this is the whole search behaviour, and
		 * driving it through a rendered grid would test React instead.
		 * @param artifacts - the manifests from the index.
		 * @param filter - `{ text, from, to, archived }`, each optional.
		 * @returns the matching manifests, in the order given.
		 */
		function filterArtifacts(artifacts, filter) {
			const needle = (filter.text ?? "").trim().toLowerCase();
			const from = filter.from ?? "";
			const to = filter.to ?? "";
			const wantArchived = filter.archived === true;
			return artifacts.filter((meta) => {
				// Archived is a partition, not a filter: the two views never
				// overlap, so an archived artifact is out of the default gallery
				// however the text and dates are set.
				if ((typeof meta.archivedAt === "string") !== wantArchived) return false;
				if (needle !== "") {
					const title = typeof meta.title === "string" ? meta.title.toLowerCase() : "";
					// The id is searchable too: it is what a link carries, so a person
					// who has one in hand can paste it here instead of reading titles.
					const id = typeof meta.artifactId === "string" ? meta.artifactId.toLowerCase() : "";
					if (!title.includes(needle) && !id.includes(needle)) return false;
				}
				if (from === "" && to === "") return true;
				const day = localDay(meta.updatedAt);
				if (day === null) return false;
				if (from !== "" && day < from) return false;
				if (to !== "" && day > to) return false;
				return true;
			});
		}

		/**
		 * Whether an element is near enough to the viewport to be worth rendering.
		 *
		 * The thumbnails are live documents, not images: every one mounted is a
		 * real page with its own scripts and its own network. So a card renders
		 * its frame only while it is on screen (plus a screen's margin), and drops
		 * it again on the way out — a store of two hundred artifacts costs the
		 * browser the dozen the person can actually see.
		 * @param ref - ref to the observed element.
		 * @returns whether it is in or near the viewport.
		 */
		function useNearViewport(ref) {
			const [near, setNear] = react.useState(false);
			react.useEffect(() => {
				const node = ref.current;
				if (node === null || node === undefined) return undefined;
				// Without IntersectionObserver every card renders, which is correct
				// and merely expensive — the wrong direction to fail in is blank.
				if (typeof IntersectionObserver !== "function") { setNear(true); return undefined; }
				const observer = new IntersectionObserver(
					(entries) => { for (const entry of entries) setNear(entry.isIntersecting); },
					{ rootMargin: "600px 0px" },
				);
				observer.observe(node);
				return () => { observer.disconnect(); };
			}, [ref]);
			return near;
		}

		/**
		 * One card: a live scaled preview, the title, when it last changed, and
		 * the control that files it away.
		 *
		 * A wrapper with two sibling buttons rather than one button holding
		 * another: a button inside a button is invalid, and browsers recover
		 * from it by flattening the markup, which loses one of the two actions.
		 *
		 * @param props - `{ meta, routePath, archived, onOpen, onArchive }`.
		 * @returns the card element.
		 */
		function GalleryCard(props) {
			const { meta, routePath, archived, onOpen, onArchive } = props;
			const frameHost = react.useRef(null);
			const near = useNearViewport(frameHost);
			const [width, setWidth] = react.useState(0);

			// The scale is measured rather than assumed: the grid is fluid, so the
			// factor that makes a 1280px document fit this card is only knowable
			// once the card has a width.
			react.useEffect(() => {
				const node = frameHost.current;
				if (node === null || typeof ResizeObserver !== "function") return undefined;
				const observer = new ResizeObserver(() => { setWidth(node.clientWidth); });
				observer.observe(node);
				setWidth(node.clientWidth);
				return () => { observer.disconnect(); };
			}, []);

			const scale = width === 0 ? 0 : width / THUMB_WIDTH;

			const openCard = jsxs("button", {
				type: "button",
				onClick: () => { onOpen(meta); },
				title: `${String(meta.title ?? "Artefato")} · abrir`,
				style: {
					display: "flex",
					flexDirection: "column",
					textAlign: "left",
					width: "100%",
					padding: 0,
					border: "1px solid var(--dsw-alias-border-l3)",
					borderRadius: "12px",
					background: "var(--dsw-alias-bg-layer-2)",
					color: "inherit",
					cursor: "pointer",
					overflow: "hidden",
				},
				children: [
					jsx("div", {
						ref: frameHost,
						style: {
							position: "relative",
							width: "100%",
							aspectRatio: `${String(THUMB_WIDTH)} / ${String(THUMB_HEIGHT)}`,
							overflow: "hidden",
							background: "var(--dsw-alias-bg-layer-1)",
							borderBottom: "1px solid var(--dsw-alias-border-l3)",
						},
						children: near && scale > 0
							? jsx("iframe", {
								src: `${routePath}/${String(meta.sessionId)}/${String(meta.artifactId)}/latest?thumb=${String(meta.version ?? 1)}`,
								title: String(meta.title ?? "Artefato"),
								tabIndex: -1,
								"aria-hidden": "true",
								// Same sandbox as the panel, minus the affordances a
								// thumbnail must not have: a preview nobody clicked on
								// should not be able to open a window or a modal.
								sandbox: "allow-scripts",
								referrerPolicy: "no-referrer",
								scrolling: "no",
								style: {
									position: "absolute",
									top: 0,
									left: 0,
									width: `${String(THUMB_WIDTH)}px`,
									height: `${String(THUMB_HEIGHT)}px`,
									border: "0",
									transform: `scale(${String(scale)})`,
									transformOrigin: "0 0",
									// The card owns the click; the preview is scenery.
									pointerEvents: "none",
								},
							})
							: null,
					}),
					jsxs("div", {
						style: { display: "flex", flexDirection: "column", gap: "2px", padding: "10px 12px", minWidth: 0 },
						children: [
							jsx("span", {
								style: { fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
								children: String(meta.title ?? "Artefato"),
							}),
							jsx("span", {
								style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)" },
								children: `${formatWhen(meta.updatedAt)} · versão ${String(meta.version ?? 1)}`,
							}),
						],
					}),
				],
			});

			const action = jsx("button", {
				type: "button",
				onClick: (event) => { event.stopPropagation(); onArchive(meta, !archived); },
				title: archived ? "Desarquivar" : "Arquivar",
				"aria-label": archived ? "Desarquivar" : "Arquivar",
				style: {
					position: "absolute",
					top: "8px",
					right: "8px",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: "28px",
					height: "28px",
					padding: 0,
					border: "1px solid var(--dsw-alias-border-l3)",
					borderRadius: "8px",
					// Opaque, not transparent: it sits over the preview, which is
					// an arbitrary page and may be any colour under it.
					background: "var(--dsw-alias-bg-layer-1)",
					color: "var(--dsw-alias-label-secondary)",
					cursor: "pointer",
				},
				children: archived ? jsx(IconRefreshOutline16, {}) : jsx(IconArchiveOutline20, { size: 16 }),
			});

			return jsxs("div", { style: { position: "relative", minWidth: 0 }, children: [openCard, action] });
		}

		/**
		 * The gallery surface: filters over every artifact this person has made.
		 * @returns the overlay element, or null while it is closed.
		 */
		function GalleryOverlay() {
			const open = useGalleryOpen();
			const [state, setState] = react.useState({ status: "idle", artifacts: [], error: null });
			const [text, setText] = react.useState("");
			const [from, setFrom] = react.useState("");
			const [to, setTo] = react.useState("");
			const [archivedView, setArchivedView] = react.useState(false);
			const [busy, setBusy] = react.useState(null);
			const { routePath } = settings();

			// Re-read on every open rather than once: an artifact made in the
			// conversation behind this overlay must be in the list the next time it
			// is raised, and there is no event that says so.
			react.useEffect(() => {
				if (!open) return undefined;
				let live = true;
				setState((current) => ({ ...current, status: "loading" }));
				fetch(`${routePath}/index`, { headers: { accept: "application/json" }, credentials: "same-origin" })
					.then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${String(response.status)}`))))
					.then((body) => {
						if (!live) return;
						const artifacts = Array.isArray(body?.artifacts) ? body.artifacts : [];
						setState({ status: "ready", artifacts, error: null });
					})
					.catch((error) => {
						if (!live) return;
						setState({ status: "error", artifacts: [], error: String(error?.message ?? error) });
					});
				return () => { live = false; };
			}, [open, routePath]);

			react.useEffect(() => {
				if (!open) return undefined;
				const onKey = (event) => { if (event.key === "Escape") gallery.set(false); };
				window.addEventListener("keydown", onKey);
				return () => { window.removeEventListener("keydown", onKey); };
			}, [open]);

			const shown = react.useMemo(
				() => filterArtifacts(state.artifacts, { text, from, to, archived: archivedView }),
				[state.artifacts, text, from, to, archivedView],
			);

			const archivedCount = react.useMemo(
				() => state.artifacts.filter(meta => typeof meta.archivedAt === "string").length,
				[state.artifacts],
			);

			/**
			 * File an artifact away, or bring it back.
			 *
			 * The list is replaced from the server's answer rather than guessed
			 * at: the card leaves the current view either way, and a card that
			 * vanished from a failed write would be a lie about what is on disk.
			 */
			const archive = react.useCallback(async (meta, archived) => {
				const key = `${String(meta.sessionId)}/${String(meta.artifactId)}`;
				setBusy(key);
				try {
					const response = await fetch(`${routePath}/archive`, {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json", accept: "application/json" },
						body: JSON.stringify({ sessionId: meta.sessionId, artifactId: meta.artifactId, archived }),
					});
					if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
					const written = await response.json();
					setState(current => ({
						...current,
						artifacts: current.artifacts.map(entry => (
							entry.artifactId === written.artifactId && entry.sessionId === written.sessionId
								? { ...entry, ...written.archivedAt === null ? { archivedAt: undefined } : { archivedAt: written.archivedAt } }
								: entry
						)),
					}));
				} catch (error) {
					setState(current => ({ ...current, error: String(error?.message ?? error) }));
				} finally {
					setBusy(null);
				}
			}, [routePath]);

			const openArtifactFromCard = react.useCallback((meta) => {
				if (openArtifact === null) return;
				titles.set(String(meta.artifactId), String(meta.title ?? "Artefato"));
				gallery.set(false);
				openArtifact(addressOf(String(meta.sessionId), String(meta.artifactId)));
			}, []);

			if (!open) return null;

			const field = {
				height: "32px",
				padding: "0 10px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l3)",
				// layer-2 sits one step above the panel's layer-1 in dark mode;
				// in light mode the two are the same colour and the border is
				// what separates them, which is why it is not optional.
				background: "var(--dsw-alias-bg-layer-2)",
				color: "inherit",
				fontSize: "13px",
			};

			return jsx("div", {
				// The overlay layer is click-through by contract; this entry opts
				// back in, which is also what makes the backdrop dismissable.
				style: {
					// Fixed, not absolute: the overlay layer is itself positioned,
					// so `absolute` anchors to ITS box — which left the sidebar
					// undimmed and the panel off-centre. Fixed is the window.
					position: "fixed",
					inset: 0,
					pointerEvents: "auto",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "var(--dsw-alias-bg-mask-1)",
					padding: "24px",
					zIndex: 40,
				},
				onClick: () => { gallery.set(false); },
				children: jsxs("div", {
					role: "dialog",
					"aria-label": "Meus artefatos",
					onClick: (event) => { event.stopPropagation(); },
					style: {
						display: "flex",
						flexDirection: "column",
						width: "min(1180px, 100%)",
						height: "min(820px, 100%)",
						borderRadius: "14px",
						border: "1px solid var(--dsw-alias-border-l3)",
						background: "var(--dsw-alias-bg-layer-1)",
						color: "var(--dsw-alias-label-primary)",
						overflow: "hidden",
					},
					children: [
						jsxs("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: "12px",
								flexWrap: "wrap",
								padding: "14px 16px",
								borderBottom: "1px solid var(--dsw-alias-border-l3)",
							},
							children: [
								jsx("strong", { style: { fontSize: "15px" }, children: "Meus artefatos" }),
								jsxs("div", {
									style: {
										display: "inline-flex",
										marginRight: "auto",
										border: "1px solid var(--dsw-alias-border-l3)",
										borderRadius: "8px",
										overflow: "hidden",
									},
									children: [false, true].map(wantArchived => jsx("button", {
										type: "button",
										onClick: () => { setArchivedView(wantArchived); },
										"aria-pressed": archivedView === wantArchived,
										style: {
											padding: "0 12px",
											height: "30px",
											border: "none",
											background: archivedView === wantArchived
												? "var(--dsw-alias-interactive-bg-hover)"
												: "transparent",
											color: archivedView === wantArchived
												? "var(--dsw-alias-label-primary)"
												: "var(--dsw-alias-label-tertiary)",
											font: "inherit",
											fontSize: "13px",
											cursor: "pointer",
										},
										children: wantArchived
											? `Arquivados${archivedCount === 0 ? "" : ` (${String(archivedCount)})`}`
											: "Ativos",
									}, wantArchived ? "archived" : "active")),
								}),
								jsxs("label", {
									style: { display: "inline-flex", alignItems: "center", gap: "6px" },
									children: [
										jsx(IconSearchOutline16, {}),
										jsx("input", {
											type: "search",
											value: text,
											placeholder: "Nome ou id",
											onChange: (event) => { setText(event.target.value); },
											style: { ...field, width: "200px" },
										}),
									],
								}),
								jsxs("label", {
									style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", opacity: 0.8 },
									children: ["De", jsx("input", {
										type: "date",
										value: from,
										onChange: (event) => { setFrom(event.target.value); },
										style: field,
									})],
								}),
								jsxs("label", {
									style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", opacity: 0.8 },
									children: ["Até", jsx("input", {
										type: "date",
										value: to,
										onChange: (event) => { setTo(event.target.value); },
										style: field,
									})],
								}),
								jsx(Button, {
									size: "small",
									onClick: () => { gallery.set(false); },
									children: jsx(IconCloseOutline16, {}),
								}),
							],
						}),
						jsx("div", {
							style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "16px" },
							children: state.status === "error"
								? jsx("p", { style: { opacity: 0.7 }, children: `Não foi possível carregar seus artefatos: ${String(state.error)}` })
								: state.status === "loading" && state.artifacts.length === 0
									? jsx("p", { style: { opacity: 0.7 }, children: "Carregando…" })
									: shown.length === 0
										? jsx("p", {
											style: { color: "var(--dsw-alias-label-tertiary)" },
											children: state.artifacts.length === 0
												? "Você ainda não criou nenhum artefato."
												: archivedView && archivedCount === 0
													? "Nada arquivado. O que você arquivar sai daqui da lista de ativos e continua abrindo pela conversa."
													: "Nenhum artefato corresponde a esses filtros.",
										})
										: jsx("div", {
											style: {
												display: "grid",
												gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
												gap: "16px",
											},
											children: shown.map((meta) => {
												const key = `${String(meta.sessionId)}/${String(meta.artifactId)}`;
												return jsx("div", {
													style: { opacity: busy === key ? 0.5 : 1, transition: "opacity 120ms" },
													children: jsx(GalleryCard, {
														meta,
														routePath,
														archived: archivedView,
														onOpen: openArtifactFromCard,
														onArchive: archive,
													}),
												}, key);
											}),
										}),
						}),
					],
				}),
			});
		}

		/**
		 * The sidebar entry that raises the gallery, at the column's foot.
		 *
		 * Geometry copied from the seat's existing occupant (ui-cordis: 42px
		 * tall, 12px radius, transparent until hover, 36px square on the rail)
		 * rather than invented, because the two sit in the same row and a
		 * neighbour half a pixel off reads as a bug in both.
		 *
		 * `flex` is the part that is not cosmetic. This is a list seat, so the
		 * row can hold more than one action — under this deployment it does,
		 * for an administrator, whose composition keeps ui-cordis. That
		 * occupant is `flex: none; width: 100%`, written when it was the only
		 * one, so something has to yield or the row overflows. This entry is
		 * what yields.
		 *
		 * @param props - the footer-action owner props; `wide` is the column state.
		 * @returns the button element.
		 */
		function GalleryFooterAction(props) {
			const wide = props.wide === true;
			return jsxs("button", {
				type: "button",
				onClick: () => { gallery.set(true); },
				"aria-label": "Meus artefatos",
				title: "Meus artefatos",
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: wide ? "flex-start" : "center",
					gap: wide ? "8px" : "0",
					flex: wide ? "1 1 auto" : "none",
					minWidth: 0,
					width: wide ? "auto" : "36px",
					height: wide ? "42px" : "36px",
					padding: wide ? "0 10px 0 8px" : "0",
					border: "none",
					borderRadius: wide ? "12px" : "8px",
					background: "transparent",
					color: "var(--dsw-alias-label-primary)",
					fontFamily: "inherit",
					fontSize: "14px",
					cursor: "pointer",
					overflow: "hidden",
				},
				children: [
					jsx(IconFolderOpenOutline16, { size: wide ? 16 : 18 }),
					wide
						? jsx("span", {
							style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
							children: "Meus artefatos",
						})
						: null,
				],
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

			// The gallery is two seats in two different owners — the sidebar holds
			// the entry, the app frame holds the surface — so each is injected
			// against its own declarer rather than assumed present. A composition
			// with neither still gets the cards and the panel.
			//
			// `sidebar.footer.action` and not a seat under New Session: the
			// shipped sidebar declares nothing there, and adding one means
			// editing `packages/client/ui-sidebar`, which every upstream sync
			// would then have to reconcile. This deployment's layer is additive
			// by rule, so the entry goes where a seat already exists. `order`
			// puts it after the occupant that seat already has.
			ctx.slots.inject("sidebar.footer.action", function* () {
				yield ctx.slots.register(
					{ name: "sidebar.footer.action", id: "compliance-artifacts-gallery", order: 10, label: "Meus artefatos" },
					GalleryFooterAction,
				);
			});

			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register(
					{ name: "shell.overlay", id: "compliance-artifacts-gallery", order: 40, label: "Meus artefatos" },
					GalleryOverlay,
				);
			});

			// Nothing can open an artifact without the right Sidebar, and a gallery
			// whose cards do nothing is worse than no gallery: close it rather than
			// leave it raised over an app that cannot answer.
			ctx.effect(() => () => { gallery.set(false); }, "artifacts: gallery state");
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.__test__ = { parseAddress, addressOf, receiptOf, pendingTitle, failureOf, filterArtifacts, localDay, gallery, TAB_ID };
		return module.exports;
	}
});
