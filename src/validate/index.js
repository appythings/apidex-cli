const {resolveValidateOptions} = require('./resolve-options');
const {loadContext} = require('./load-context');
const {runChecks} = require('./run-checks');
const {loadGatewayProducts} = require('./load-gateway-products');
const checks = require('./checks');

async function runValidate(argv) {
  const options = resolveValidateOptions(argv);
  const ctx = loadContext(options);
  if (options.checkPortal) {
    try {
      ctx.gatewayProducts = await loadGatewayProducts(options);
    } catch (error) {
      ctx.gatewayProducts = [];
      ctx.gatewayProductsError =
        error instanceof Error ? error.message : String(error);
    }
  }
  const results = await runChecks(ctx, checks);
  return {
    ok: results.every(result => result.ok),
    results,
  };
}

module.exports = {runValidate};
