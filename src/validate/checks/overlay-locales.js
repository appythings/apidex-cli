const {canonicalizeLocale} = require('../../lib/overlays');

module.exports = {
  id: 'overlay-locales',
  async run(ctx) {
    const messages = [];
    for (const entry of ctx.entries) {
      const seen = new Set();
      for (const overlay of entry.overlays) {
        if (overlay.error) continue;
        const locale = canonicalizeLocale(overlay.locale);
        if (!locale) {
          messages.push(
            `${entry.name}: unsupported overlay locale "${overlay.locale}"`,
          );
          continue;
        }
        if (seen.has(locale)) {
          messages.push(
            `${entry.name}: duplicate overlay locale "${locale}"`,
          );
        }
        seen.add(locale);
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
