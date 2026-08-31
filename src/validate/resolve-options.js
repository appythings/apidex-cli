/**
 * Resolves validate options from CLI argv.
 * A spec-repo settings file will supply defaults later; flags always win.
 *
 * @param {{manifestPath?: string, requireLocales?: string}} argv
 * @returns {{manifestPath: string, requireLocales: string[]}}
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

  return {manifestPath, requireLocales};
}

module.exports = {resolveValidateOptions};
