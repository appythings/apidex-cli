const {validateOverlayDocument} = require('../../lib/overlays');
const {skipNonOpenapiOverlays} = require('../skip-mcp-overlays');

module.exports = {
  id: 'overlay-shape',
  async run(ctx) {
    const messages = [];
    for (const entry of ctx.entries) {
      if (skipNonOpenapiOverlays(entry)) continue;
      for (const overlay of entry.overlays) {
        if (overlay.error || !overlay.overlay) continue;
        try {
          validateOverlayDocument(overlay.overlay, overlay.path);
        } catch (error) {
          messages.push(
            `${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
