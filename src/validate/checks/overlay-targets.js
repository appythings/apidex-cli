const {targetMatches} = require('../jsonpath');

module.exports = {
  id: 'overlay-targets',
  async run(ctx) {
    const messages = [];
    for (const entry of ctx.entries) {
      if (entry.inheritSpec) continue;
      if (entry.specError) {
        messages.push(`${entry.name}: cannot check overlay targets (${entry.specError})`);
        continue;
      }
      if (!entry.spec) continue;
      for (const overlay of entry.overlays) {
        if (overlay.error || !overlay.overlay) continue;
        const actions = overlay.overlay.actions || [];
        actions.forEach((action, index) => {
          if (!action || typeof action.target !== 'string') return;
          if (!targetMatches(entry.spec, action.target)) {
            messages.push(
              `${entry.name} ${overlay.locale || overlay.path} action ${index}: target ${action.target} matched 0 nodes`,
            );
          }
        });
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
