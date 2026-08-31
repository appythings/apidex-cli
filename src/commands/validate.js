const {runValidate} = require('../validate');

/**
 * @param {{manifestPath?: string, requireLocales?: string}} argv
 * @param {{ log?: (msg: string) => void, exit?: (code: number) => void }} [deps]
 */
async function runValidateCli(argv, deps = {}) {
  const log = deps.log || (msg => console.log(msg));
  const exit = deps.exit || (code => process.exit(code));
  try {
    const {ok, results} = await runValidate(argv);
    for (const result of results) {
      if (result.ok) {
        log(`ok ${result.id}`);
      } else {
        log(`FAIL ${result.id}`);
        for (const message of result.messages) {
          log(`  ${message}`);
        }
      }
    }
    exit(ok ? 0 : 1);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

module.exports = {runValidateCli};
