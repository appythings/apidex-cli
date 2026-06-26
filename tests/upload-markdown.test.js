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


});
