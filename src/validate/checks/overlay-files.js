module.exports = {
  id: 'overlay-files',
  async run(ctx) {
    const messages = [];
    for (const entry of ctx.entries) {
      for (const overlay of entry.overlays) {
        if (overlay.error) {
          messages.push(`${entry.name}: ${overlay.error}`);
        }
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
