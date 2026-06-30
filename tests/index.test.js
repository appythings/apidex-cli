const path = require('path');
const {version} = require('../package.json');

const mockRunUploadSpecCli = jest.fn().mockResolvedValue(undefined);
const mockRunUploadMarkdownCli = jest.fn().mockResolvedValue(undefined);
const mockArchive = {
  directory: jest.fn(),
  finalize: jest.fn(),
};

jest.mock('../src/devportal/portal', () => jest.fn());
jest.mock('../src/commands/upload-spec', () => ({
  runUploadSpecCli: (...args) => mockRunUploadSpecCli(...args),
}));
jest.mock('../src/commands/upload-markdown', () => ({
  runUploadMarkdownCli: (...args) => mockRunUploadMarkdownCli(...args),
}));
jest.mock('archiver', () => jest.fn(() => mockArchive));
jest.mock('stream-to-promise', () =>
  jest.fn(() => Promise.resolve(Buffer.from('zip'))),
);

const Portal = require('../src/devportal/portal');
const archiver = require('archiver');
const streamToPromise = require('stream-to-promise');

const manifestPath = path.join(
  __dirname,
  'fixtures/manifest-products-only.yaml',
);
const markdownDir = path.join(__dirname, 'fixtures');

function argv(...args) {
  process.argv = ['node', 'apidex-cli', ...args];
}

async function parseCli(...args) {
  argv(...args);
  const {createProgram} = require('../src/index');
  createProgram().parse(process.argv);
  await new Promise(resolve => setImmediate(resolve));
}

describe('CLI index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunUploadSpecCli.mockResolvedValue(undefined);
    mockRunUploadMarkdownCli.mockResolvedValue(undefined);
    Portal.mockImplementation(() => ({}));
  });

  it('upload-spec wires Portal config and delegates to runUploadSpecCli', async () => {
    const portalInstance = {id: 'portal'};
    Portal.mockImplementation(() => portalInstance);

    await parseCli(
      'upload-spec',
      manifestPath,
      '--environment',
      'e1',
      '--host',
      'https://portal.test',
      '--clientId',
      'cid',
      '--clientSecret',
      'secret',
      '--scope',
      'scope-val',
      '--tokenUrl',
      'https://token.test/oauth',
      '--aud',
      'aud-val',
      '--force',
      '--token',
      'tok123',
    );

    expect(Portal).toHaveBeenCalledWith(
      {
        environment: 'e1',
        clientId: 'cid',
        clientSecret: 'secret',
        aud: 'aud-val',
        hostname: 'https://portal.test',
        scope: 'scope-val',
        tokenUrl: 'https://token.test/oauth',
        grantType: 'client_credentials',
        force: true,
        token: 'tok123',
      },
      manifestPath,
    );
    expect(mockRunUploadSpecCli).toHaveBeenCalledWith(portalInstance);
  });

  it('upload-spec logs Portal constructor errors and exits 1', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    Portal.mockImplementation(() => {
      throw new Error('bad manifest');
    });

    await parseCli(
      'upload-spec',
      manifestPath,
      '--environment',
      'e1',
      '--host',
      'https://portal.test',
    );

    expect(logSpy).toHaveBeenCalledWith('bad manifest');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockRunUploadSpecCli).not.toHaveBeenCalled();

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('upload-markdown zips directory and delegates to runUploadMarkdownCli', async () => {
    const portalInstance = {id: 'md-portal'};
    Portal.mockImplementation(() => portalInstance);

    await parseCli(
      'upload-markdown',
      markdownDir,
      '--host',
      'https://portal.test',
      '--clientId',
      'cid',
      '--clientSecret',
      'secret',
      '--scope',
      'scope-val',
      '--tokenUrl',
      'https://token.test/oauth',
      '--aud',
      'aud-val',
    );

    expect(Portal).toHaveBeenCalledWith({
      clientId: 'cid',
      clientSecret: 'secret',
      aud: 'aud-val',
      hostname: 'https://portal.test',
      scope: 'scope-val',
      tokenUrl: 'https://token.test/oauth',
      grantType: 'client_credentials',
    });
    expect(archiver).toHaveBeenCalledWith('zip');
    expect(mockArchive.directory).toHaveBeenCalledWith(markdownDir, false);
    expect(mockArchive.finalize).toHaveBeenCalled();
    expect(streamToPromise).toHaveBeenCalledWith(mockArchive);
    expect(mockRunUploadMarkdownCli).toHaveBeenCalledWith(
      portalInstance,
      Buffer.from('zip'),
    );
  });

  it('upload-spec with required flags only uses defaults for optionals', async () => {
    Portal.mockImplementation(() => ({}));

    await parseCli(
      'upload-spec',
      manifestPath,
      '--environment',
      'e1',
      '--host',
      'https://portal.test',
    );

    expect(Portal).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'e1',
        hostname: 'https://portal.test',
        grantType: 'client_credentials',
        force: false,
      }),
      manifestPath,
    );
  });

  it('prints package version for -v', () => {
    const writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const {createProgram} = require('../src/index');
    createProgram().parse(['node', 'apidex-cli', '-v']);
    expect(writeSpy.mock.calls.flat().join('')).toContain(version);
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
