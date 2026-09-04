const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {parseSpecFile} = require('../../src/lib/spec-file');

describe('parseSpecFile', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidex-spec-file-'));
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('parses yaml and json specs', () => {
    const yamlPath = path.join(dir, 'echo.yaml');
    const jsonPath = path.join(dir, 'echo.json');
    fs.writeFileSync(yamlPath, 'openapi: "3.0.2"\n');
    fs.writeFileSync(jsonPath, '{"tools":[{"name":"echo"}]}');
    expect(parseSpecFile(yamlPath).openapi).toBe('3.0.2');
    expect(parseSpecFile(jsonPath).tools[0].name).toBe('echo');
  });

  it('rejects unsupported extensions', () => {
    const txt = path.join(dir, 'echo.txt');
    fs.writeFileSync(txt, 'nope');
    expect(() => parseSpecFile(txt)).toThrow(/yaml\/yml or json/);
  });
});
