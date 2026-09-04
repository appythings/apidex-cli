const {canonicalizeLocale} = require('../../lib/overlays');
const {skipNonOpenapiOverlays} = require('../skip-mcp-overlays');

module.exports = {
  id: 'required-locales',
  async run(ctx) {
    const required = (ctx.options && ctx.options.requireLocales) || [];
    if (required.length === 0) {
      return {ok: true, messages: []};
    }
    const messages = [];
    const wanted = required.map(locale => canonicalizeLocale(locale) || locale);
    for (const entry of ctx.entries) {
      if (entry.inheritSpec) continue;
      if (skipNonOpenapiOverlays(entry)) continue;
      if (!entry.specPath && entry.kind === 'product') continue;
      const present = new Set(
        entry.overlays
          .filter(overlay => !overlay.error)
          .map(overlay => canonicalizeLocale(overlay.locale))
          .filter(Boolean),
      );
      for (const locale of wanted) {
        if (!present.has(locale)) {
          messages.push(
            `${entry.name}: missing required overlay locale ${locale}`,
          );
        }
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
