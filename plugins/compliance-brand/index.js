/**
 * Compliance brand plugin, node half: the Compliance HCM design system.
 *
 * The browser half (`./client`) fills the brand slots and registers the extra
 * themes. This half owns everything that has to exist before any plugin runs,
 * or that another plugin needs from the design system:
 *
 *   - the Web client stylesheet (design-system tokens + the bridge onto the
 *     client's `--dsw-*` aliases), injected into index.html so the first paint
 *     is already on-brand;
 *   - the favicon, the tab title, and the pre-paint script that re-applies a
 *     saved extra theme;
 *   - the asset route that serves the fonts and SVGs the stylesheet references;
 *   - the `complianceDesignSystem` service, which compliance-artifacts uses to
 *     serve every artifact document with the design system already applied;
 *   - the `compliance-design-system` skill, the model's guide to it.
 *
 * @module
 */
import { ASSET_ROUTE, THEME_STORAGE_KEY, loadDesignSystem, prePaintScript } from './src/design-system.js'
import { assetHandler } from './src/route.js'
import { designSystemSkill } from './src/skill.js'

export const name = 'compliance-brand'
export const inject = ['webServer']

/** Name of the service other plugins read the design system through. */
export const SERVICE_NAME = 'complianceDesignSystem'

/** Global the client half reads the theme list and the storage key from. */
const CONFIG_GLOBAL = '__COMPLIANCE_BRAND__'

/** The product name in the browser tab. */
const TAB_TITLE = 'Compliance AI'

/**
 * Mount the stylesheet, the assets, the service and the skill.
 * @param ctx - the harness context.
 */
export function apply(ctx) {
  const designSystem = loadDesignSystem()

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ASSET_ROUTE, handler: assetHandler(designSystem, ASSET_ROUTE) }),
    'compliance-brand: asset route',
  )

  ctx.on('webserver/index-inject', (table) => {
    table.push(
      { kind: 'global', name: CONFIG_GLOBAL, value: { themes: designSystem.themes, storageKey: THEME_STORAGE_KEY } },
      { kind: 'style', text: designSystem.appStylesheet },
      {
        kind: 'html',
        placement: 'head',
        html: `<link rel="icon" type="image/svg+xml" href="${designSystem.assetUrl('favicon.svg')}">`,
      },
      // After ui-theme's own boot script (it pushes with `prepend`), so the
      // saved extra theme is the last word before the shell mounts.
      { kind: 'script', placement: 'body', text: prePaintScript(designSystem.themes) },
    )
  })

  if (typeof ctx.webServer.tapIndex === 'function') {
    ctx.effect(
      () => ctx.webServer.tapIndex(html => html.replace(/<title>[^<]*<\/title>/, `<title>${TAB_TITLE}</title>`)),
      'compliance-brand: tab title',
    )
  }

  ctx.provide(SERVICE_NAME, designSystem)

  // Optional, as in the other compliance plugins: a composition without the
  // skill registry still gets the theme and the artifact styling.
  const skills = ctx.get('skills')
  if (skills === undefined) {
    ctx.logger.warn('compliance-brand: no skill registry in this composition; the design-system skill is not available')
  } else {
    ctx.effect(() => skills.register(designSystemSkill()), 'compliance-brand: design-system skill')
  }

  ctx.logger.info('compliance-brand: design system %s, %d themes, assets under %s',
    designSystem.version, designSystem.themes.length, ASSET_ROUTE)
}
