const {spawnSync} = require('child_process');
const path = require('path');

describe('pushSwagger OAS 3.1 integration (real parser, mocked HTTP)', () => {
  it('validates upload flow via subprocess', () => {
    const scriptPath = path.join(
      __dirname,
      '..',
      'scripts',
      'run-pushswagger-oas31-test.mjs',
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-vm-modules',
      },
    });
    jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});

    if (result.status !== 0) {
      throw new Error(
        `run-pushswagger-oas31-test.mjs failed:\n${result.stdout}\n${result.stderr}`.trim(),
      );
    }
  });
});
