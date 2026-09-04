const {spawnSync} = require('child_process');
const path = require('path');

const nodeOptions = '--experimental-vm-modules';

function runScript(scriptName) {
  const scriptPath = path.join(__dirname, '..', 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `${scriptName} failed:\n${result.stdout}\n${result.stderr}`.trim(),
    );
  }
}

describe('Scalar OpenAPI validation (real parser)', () => {
  it('validates all OpenAPI fixtures via subprocess', () => {
    runScript('validate-openapi-fixtures.mjs');
  });
});
