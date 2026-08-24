// The signed-in user's face, and their way out.
//
// This lives in its own package rather than in the SSO gate because the gate is
// a GATEWAY plugin: with tenancy mounted it runs in the routing process, not in
// the per-user backend that serves the browser, so a client half attached to it
// would never appear in a backend's boot graph. Moving it here is what makes the
// footer row and Sign out exist again.
//
// It reads `/auth/status`, which the gateway answers on the same origin — the
// backend never sees that path.
//
// Hand-written in the lazy CJS factory form the client module loader consumes
// (executing this script only REGISTERS the factory; every side effect runs at
// materialization). `react/jsx-runtime` and the UI primitives are part of the
// shell's implicit external baseline, so no `dsh.client.external` is declared.
//
// Two occupants, both in slots the settings shell already declares:
//
//   settings.trigger  (single)  the footer row's CONTENT — replaced, at
//                               priority -1, so the row shows the user instead
//                               of the gear and the word "Settings".
//   settings.action   (list)    the panel's action strip — joined with a
//                               "Sign out" button beside the existing ones.
//
// Why not a dropdown replacing the row outright: `SettingsRoot` owns that
// footer <button> and its onClick, and the panel's sections
// (`settings.section`) are declared by ITS registration — shadowing
// `sidebar.settings` would take the whole settings panel down with it, along
// with every section other plugins register into. Occupying the two child
// slots leaves the panel intact.
window.__ModuleLoader__.load({
	id: "@compliance/dsh-client-user-menu",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const { jsx, jsxs } = require("react/jsx-runtime");
		const react = require("react");
		const { Button } = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Poll period for the identity behind the gate; it changes only on sign-out. */
		const STATUS_POLL_MS = 60_000;

		/**
		 * Read the signed-in principal from the gate's own status endpoint.
		 *
		 * The identity comes from `/auth/status` rather than from a Remote method
		 * because the gate is not a harness service: it lives in front of the
		 * webserver, so the RPC plane never sees it. One fetch, same-origin,
		 * carrying the session cookie the browser already holds.
		 */
		function useIdentity() {
			const [state, setState] = react.useState({ status: "loading" });
			react.useEffect(() => {
				let live = true;
				const read = () => {
					fetch("/auth/status", { credentials: "same-origin", cache: "no-store" })
						.then((response) => response.ok ? response.json() : { authenticated: false })
						.then((body) => {
							if (!live) return;
							setState(body.authenticated === true
								? { status: "ready", name: body.name ?? null, subject: body.subject }
								: { status: "anonymous" });
						})
						.catch(() => {
							// A failed poll says nothing about the session — the gate's own
							// liveness script owns the reload decision. Keep the last value.
						});
				};
				read();
				const timer = setInterval(read, STATUS_POLL_MS);
				return () => { live = false; clearInterval(timer); };
			}, []);
			return state;
		}

		/** Initials for the avatar: at most two, from the display name. */
		function initialsOf(name) {
			const parts = String(name).trim().split(/\s+/).filter(Boolean);
			if (parts.length === 0) return "?";
			if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}

		const AVATAR_STYLE = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			width: "20px",
			height: "20px",
			borderRadius: "50%",
			// currentColor on both sides keeps the avatar legible in either theme
			// without this bundle owning colour tokens it cannot see.
			border: "1px solid currentColor",
			fontSize: "9px",
			fontWeight: 700,
			letterSpacing: "0.02em",
			lineHeight: 1,
		};

		const LABEL_STYLE = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			minWidth: 0,
		};

		/**
		 * The footer row's content: the signed-in user.
		 *
		 * `wide` is the owner share — false means the 56px rail, where only the
		 * avatar fits. While the identity is loading the row renders the avatar
		 * placeholder alone rather than a spinner, so the footer never reflows.
		 */
		function UserTrigger({ wide }) {
			const identity = useIdentity();
			const label = identity.status === "ready"
				? (identity.name ?? identity.subject)
				: "";
			return jsxs(react.Fragment, {
				children: [
					jsx("span", {
						style: AVATAR_STYLE,
						"aria-hidden": "true",
						children: identity.status === "ready" ? initialsOf(label) : "",
					}),
					wide && label !== "" ? jsx("span", { style: LABEL_STYLE, children: label }) : null,
				],
			});
		}

		/**
		 * The panel's sign-out action.
		 *
		 * A plain navigation, not a fetch: `/auth/logout` answers 302 to the
		 * provider's end-session endpoint, and only a top-level navigation can
		 * follow that redirect and let the provider clear its own session cookie.
		 * A fetch would drop the session locally and leave the user silently
		 * signed in at the identity provider.
		 */
		function SignOutAction() {
			const identity = useIdentity();
			if (identity.status !== "ready") return null;
			return jsx("div", {
				style: { display: "flex", justifyContent: "flex-end" },
				children: jsx(Button, {
					variant: "outline",
					size: "sm",
					onClick: () => { window.location.assign("/auth/logout"); },
					children: "Sign out",
				}),
			});
		}

		/** Required service: the UI slot registry. */
		const inject = ["slots"];

		/**
		 * Occupy both settings slots as one declaration-aware registration set, so
		 * the pair installs and withdraws together whichever order the settings
		 * shell activates in.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("settings.trigger", () =>
				ctx.slots.inject("settings.action", function* () {
					// priority -1 shadows ui-settings-general's own trigger content;
					// the lowest priority renders, and a same-priority second entry
					// would throw instead.
					yield ctx.slots.register({ name: "settings.trigger", priority: -1 }, UserTrigger);
					yield ctx.slots.register({
						name: "settings.action",
						id: "sso-sign-out",
						order: 100,
					}, SignOutAction);
				}));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
