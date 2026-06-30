const {runUploadMarkdownCli} = require('../src/commands/upload-markdown');

describe('upload-markdown runner', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates pushMarkdown success', async () => {
    const portal = {
      pushMarkdown: jest.fn().mockResolvedValue(),
    };

    await runUploadMarkdownCli(portal, Buffer.from('z'));

    expect(portal.pushMarkdown).toHaveBeenCalledWith(expect.any(Buffer));
    expect(console.log.mock.calls.some(c =>
      String(c[0]).includes('Successfully pushed markdown'),
    )).toBe(true);

  });

  it('runs exit on markdown failure', async () => {

    const err = {

      response: {status: 500, statusText: 'Error', data: {detail: 'x'}},

      config: {

        url: '/markdown',

        baseURL: 'https://portal.test',

        method: 'post',

      },

    };


    const portal = {

      pushMarkdown: jest.fn().mockRejectedValue(err),

    };

    let exitCode;

    await runUploadMarkdownCli(portal, Buffer.from('a'), {

      exit: code => {

        exitCode = code;

      },

    });


    expect(exitCode).toBe(1);

    expect(String(console.log.mock.calls[0][0])).toContain('HTTP 500');
  });

  it('uses default logError and exit on failure when deps omitted', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const portal = {
      pushMarkdown: jest.fn().mockRejectedValue(new Error('markdown boom')),
    };

    await runUploadMarkdownCli(portal, Buffer.from('x'));

    expect(
      logSpy.mock.calls.some(c => String(c[0]).includes('markdown boom')),
    ).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
