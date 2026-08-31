const {resolveValidateOptions} = require('./resolve-options');
const {loadContext} = require('./load-context');
const {runChecks} = require('./run-checks');
const checks = require('./checks');

async function runValidate(argv) {
  const options = resolveValidateOptions(argv);
  const ctx = loadContext(options);
  const results = await runChecks(ctx, checks);
  return {
    ok: results.every(result => result.ok),
    results,
  };
}

module.exports = {runValidate};
