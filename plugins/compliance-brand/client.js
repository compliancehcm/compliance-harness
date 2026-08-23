// Compliance AI brand occupants, browser half. Hand-written in the lazy CJS
// factory form the client module loader consumes: executing this script only
// REGISTERS the factory; every side effect runs at materialization.
//
// The source artwork is one flat-white transparent PNG, so it cannot be tinted
// as an <img>: painted directly it disappears on the light theme. Both marks
// are therefore used as CSS MASKS over a `currentColor` background — the ink
// then follows the sidebar's own label color in either theme, exactly like the
// shipped currentColor SVG logo it replaces. The artwork is inlined as a data
// URI so the bundle stays self-contained (no third-party request at boot).
window.__ModuleLoader__.load({
	id: "@compliance/dsh-client-ui-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// react/jsx-runtime is part of the implicit external baseline the shell
		// seeds, so no `dsh.client.external` request is needed.
		const { jsx } = require("react/jsx-runtime");

		/** Interlocking-rings mark, cropped from the source wordmark. 202x133. */
		const MARK_URI = "data:image/png;base64,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";
		const MARK_RATIO = 202 / 133;

		/** "Compliance soluções" lettering, cropped from the same wordmark. 399x91. */
		const NAME_URI = "data:image/png;base64,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";
		const NAME_RATIO = 399 / 91;

		/** Mask declaration shared by both occupants; -webkit- kept for Safari. */
		function maskStyle(uri) {
			return {
				display: "block",
				backgroundColor: "currentColor",
				maskImage: `url("${uri}")`,
				WebkitMaskImage: `url("${uri}")`,
				maskRepeat: "no-repeat",
				WebkitMaskRepeat: "no-repeat",
				maskPosition: "center",
				WebkitMaskPosition: "center",
				maskSize: "contain",
				WebkitMaskSize: "contain",
			};
		}

		/**
		 * Render the rings mark at the presentation its host surface requests.
		 * `size` is a WIDTH in px (the shipped FishLogo convention); the height
		 * follows the artwork ratio so the rail and the hero stay proportional.
		 */
		function ComplianceBrandMark({ size = 24, className }) {
			return jsx("span", {
				className,
				"aria-hidden": "true",
				style: {
					...maskStyle(MARK_URI),
					width: `${size}px`,
					height: `${Math.round((size / MARK_RATIO) * 100) / 100}px`,
					flex: "none",
				},
			});
		}

		/** Render the lettering for the sidebar's independently slotted name. */
		function ComplianceBrandName() {
			const height = 18;
			return jsx("span", {
				role: "img",
				"aria-label": "Compliance AI",
				style: {
					...maskStyle(NAME_URI),
					height: `${height}px`,
					width: `${Math.round(height * NAME_RATIO * 100) / 100}px`,
					flex: "none",
				},
			});
		}

		/** Required service: the UI slot registry. */
		const inject = ["slots"];

		/**
		 * Fill every brand slot as one declaration-aware registration set, so the
		 * package works whether it activates before or after the declarers and
		 * withdraws every occupant together.
		 */
		function apply(ctx) {
			ctx.slots.inject("sidebar.brand.mark", () =>
				ctx.slots.inject("sidebar.brand.name", () =>
					ctx.slots.inject("conversation.hero.brand.mark", function* () {
						yield ctx.slots.register({ name: "sidebar.brand.mark" }, ComplianceBrandMark);
						yield ctx.slots.register({ name: "sidebar.brand.name" }, ComplianceBrandName);
						yield ctx.slots.register({ name: "conversation.hero.brand.mark" }, ComplianceBrandMark);
					})));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
