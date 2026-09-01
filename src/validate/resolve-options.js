/**
 * Resolves validate options from CLI argv.
 * A spec-repo settings file will supply defaults later; flags always win.
 *
 * @param {{manifestPath?: string, requireLocales?: string, host?: string, environment?: string, token?: string}} argv
 * @returns {{manifestPath: string, requireLocales: string[], host: string, environment: string, token: string}}
 */
function resolveValidateOptions(argv = {}) {
  const manifestPath =
    typeof argv.manifestPath === 'string' ? argv.manifestPath.trim() : '';
  if (!manifestPath) {
    throw new Error(
      'validate requires a manifest path. Pass it as the first argument (a spec-repo settings file will supply this later).',
    );
  }

  const raw = argv.requireLocales;
  let requireLocales = [];
  if (typeof raw === 'string' && raw.trim() !== '') {
    requireLocales = raw
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }

  const host = typeof argv.host === 'string' ? argv.host.trim() : '';
  const environment =
    typeof argv.environment === 'string' ? argv.environment.trim() : '';
  const token = typeof argv.token === 'string' ? argv.token.trim() : '';

  if (!host || !environment || !token) {
    throw new Error(
      'validate requires --host, --environment, and --token (or APIDEX_HOST / APIDEX_ENVIRONMENT / APIDEX_TOKEN)',
    );
  }

  return {
    manifestPath,
    requireLocales,
    host,
    environment,
    token,
  };
}

module.exports = {resolveValidateOptions};
