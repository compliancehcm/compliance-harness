// The one entry point into the ALMA connection, in the settings panel's action
// strip beside Sign out.
//
// It owns no protocol: the host half server-renders every page, so this reads
// `/alma/status` as JSON to decide between "Connect ALMA" and "Disconnect", and
// otherwise just navigates. That is also why it needs no new RPC method — the
// SSO gate fences the RPC plane to administrators, and a plain path is admitted
// for every authenticated user.
//
// The paths come from the boot global the host half injects, so a deployment
// that moves `basePath` moves both halves at once.
//
// Hand-written in the lazy CJS factory form the client module loader consumes,
// like `plugins/compliance-user-menu/client.js`: executing this script only
// REGISTERS the factory. `react/jsx-runtime` and the UI primitives are part of
// the shell's implicit external baseline, so no `dsh.client.external` is
// declared.
window.__ModuleLoader__.load({
	id: "@compliance/dsh-alma-mcp",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const { jsx } = require("react/jsx-runtime");
		const react = require("react");
		const { Button } = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Poll period for the connection state; it changes only when someone acts. */
		const STATUS_POLL_MS = 60_000;

		/** Fallback paths, used only if the host half's boot global is absent. */
		const FALLBACK_ROUTES = {
			status: "/alma/status",
			connect: "/alma/connect",
			disconnect: "/alma/disconnect",
		};

		/** The route table the host half injected, or the defaults. */
		function routes() {
			const injected = globalThis.__ALMA_ROUTES__;
			if (injected === null || typeof injected !== "object") return FALLBACK_ROUTES;
			return {
				status: injected.status ?? FALLBACK_ROUTES.status,
				connect: injected.connect ?? FALLBACK_ROUTES.connect,
				disconnect: injected.disconnect ?? FALLBACK_ROUTES.disconnect,
			};
		}

		/**
		 * Read whether this workspace is connected to ALMA.
		 *
		 * Same-origin, carrying the gate's session cookie, against the host half's
		 * own status route rather than a Remote method — the connection is not a
		 * harness service, and its state is exactly one boolean.
		 */
		function useConnection() {
			const [state, setState] = react.useState({ status: "loading" });
			const read = react.useCallback(() => {
				fetch(routes().status, {
					credentials: "same-origin",
					cache: "no-store",
					headers: { accept: "application/json" },
				})
					.then((response) => response.ok ? response.json() : { connected: false })
					.then((body) => { setState({ status: "ready", connected: body.connected === true }); })
					.catch(() => {
						// A failed poll says nothing about the connection; keep the
						// last value rather than claiming a disconnection.
					});
			}, []);
			react.useEffect(() => {
				read();
				const timer = setInterval(read, STATUS_POLL_MS);
				return () => { clearInterval(timer); };
			}, [read]);
			return { state, refresh: read };
		}

		/**
		 * Connect or disconnect ALMA.
		 *
		 * Connecting is a top-level navigation, because the authorization server
		 * answers with a redirect chain a fetch could not follow into the browser's
		 * address bar. Disconnecting is a POST, because a state change reachable by
		 * GET would be triggerable by any embedded image.
		 */
		function AlmaAction() {
			const { state, refresh } = useConnection();
			if (state.status !== "ready") return null;
			if (!state.connected) {
				return jsx("div", {
					style: { display: "flex", justifyContent: "flex-end" },
					children: jsx(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => {
						// Come back to this exact place, not to a status page: the
						// point of connecting is to keep working.
						const here = window.location.pathname + window.location.search;
						window.location.assign(`${routes().connect}?returnTo=${encodeURIComponent(here)}`);
					},
						children: "Connect ALMA",
					}),
				});
			}
			return jsx("div", {
				style: { display: "flex", justifyContent: "flex-end" },
				children: jsx(Button, {
					variant: "outline",
					size: "sm",
					onClick: () => {
						fetch(routes().disconnect, {
							method: "POST",
							credentials: "same-origin",
							headers: { accept: "application/json" },
						}).then(refresh, refresh);
					},
					children: "Disconnect ALMA",
				}),
			});
		}

		/** Required service: the UI slot registry. */
		const inject = ["slots"];

		/**
		 * Occupy the settings panel's action strip.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("settings.action", function* () {
				yield ctx.slots.register({
					name: "settings.action",
					id: "alma-connection",
					order: 90,
				}, AlmaAction);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
