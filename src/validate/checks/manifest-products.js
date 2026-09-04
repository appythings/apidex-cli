module.exports = {
  id: 'manifest-products',
  async run(ctx) {
    if (!ctx || !ctx.options || !ctx.options.checkPortal) {
      return {ok: true, messages: []};
    }
    if (ctx && ctx.gatewayProductsError) {
      return {ok: false, messages: [ctx.gatewayProductsError]};
    }
    const gateway = (ctx && ctx.gatewayProducts) || [];
    const messages = [];
    const entries = (ctx && ctx.entries) || [];
    for (const entry of entries) {
      if (entry.kind !== 'product' || !entry.name) {
        continue;
      }
      const found = gateway.some(
        product =>
          product &&
          (product.id === entry.name || product.name === entry.name),
      );
      if (!found) {
        messages.push(
          `${entry.name}: API product not found in environment ${
            ctx.options && ctx.options.environment
          } (manifest name must be the gateway product name or id, not displayName)`,
        );
      }
    }
    return {ok: messages.length === 0, messages};
  },
};
