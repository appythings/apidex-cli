/**
 * Resolves validate options from CLI argv.
 * Offline by default. --check-portal requires host/environment/token.
 *
 * @param {{manifestPath?: string, requireLocales?: string, host?: string, environment?: string, token?: string, clientId?: string, clientSecret?: string, aud?: string, scope?: string, tokenUrl?: string, checkPortal?: boolean, json?: boolean}} argv
 */
function trimFlag(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

  const host = trimFlag(argv.host);
  const environment = trimFlag(argv.environment);
  const token = trimFlag(argv.token);
  const clientId = trimFlag(argv.clientId);
  const clientSecret = trimFlag(argv.clientSecret);
  const aud = trimFlag(argv.aud);
  const scope = trimFlag(argv.scope);
  const tokenUrl = trimFlag(argv.tokenUrl);
  const checkPortal = Boolean(argv.checkPortal);
  const json = Boolean(argv.json);

  if (checkPortal) {
    if (!host || !environment) {
      throw new Error(
        'validate --check-portal requires --host and --environment (or APIDEX_HOST / APIDEX_ENVIRONMENT)',
      );
    }
    if (!token && !(clientId && tokenUrl)) {
      throw new Error(
        'validate --check-portal requires --token or client credentials (--clientId and --tokenUrl; also --clientSecret unless using a client certificate)',
      );
    }
  }

  return {
    manifestPath,
    requireLocales,
    host,
    environment,
    token,
    clientId,
    clientSecret,
    aud,
    scope,
    tokenUrl,
    checkPortal,
    json,
  };
}

module.exports = {resolveValidateOptions};
