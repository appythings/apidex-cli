const {formatRequestError} = require('../lib/formatAxiosError');

/**
 * @param {import('../devportal/portal')} portal
 * @returns {Promise<void>}
 */
async function runUploadSpec(portal) {
  await portal.pushSwagger();
  console.log('Successfully updated documentation');
  await portal.pushCategories();
  console.log('Successfully updated documentation');
  await portal.pushTeams();
  console.log('Successfully updated teams');
  await portal.pushBackendTeams();
  if (portal.backendTeamConfig && portal.backendTeamConfig.length > 0) {
    console.log('Successfully updated backend teams');
  }
  await portal.assignBackendTeamsFromManifest();
  if (
    portal.backendTeamAssignments &&
    portal.backendTeamAssignments.length > 0
  ) {
    console.log(
      'Successfully applied backend team assignments to API products',
    );
  }
}

/**
 * @param {import('../devportal/portal')} portal
 * @param {{ logError?: (msg: string) => void, exit?: (code: number) => void }} [deps]
 * @returns {Promise<void>}
 */
async function runUploadSpecCli(portal, deps = {}) {
  const logError = deps.logError || ((msg) => console.log(msg));
  const exit = deps.exit || ((code) => process.exit(code));
  try {
    await runUploadSpec(portal);
  } catch (error) {
    logError(formatRequestError(error));
    exit(1);
  }
}

module.exports = {runUploadSpec, runUploadSpecCli};
