const {formatRequestError} = require('../lib/formatAxiosError');

/**
 * @param {import('../devportal/portal')} portal
 * @param {Buffer} zipBuffer
 * @returns {Promise<void>}
 */
async function runUploadMarkdown(portal, zipBuffer) {
  await portal.pushMarkdown(zipBuffer);
}

/**
 * @param {import('../devportal/portal')} portal
 * @param {Buffer} zipBuffer
 * @param {{ logError?: (msg: string) => void, exit?: (code: number) => void }} [deps]
 * @returns {Promise<void>}
 */
async function runUploadMarkdownCli(portal, zipBuffer, deps = {}) {
  const logError = deps.logError || ((msg) => console.log(msg));
  const exit = deps.exit || ((code) => process.exit(code));
  try {
    await runUploadMarkdown(portal, zipBuffer);
    console.log('Successfully pushed markdown to developer portal');
  } catch (error) {
    logError(formatRequestError(error));
    exit(1);
  }
}

module.exports = {runUploadMarkdown, runUploadMarkdownCli};
