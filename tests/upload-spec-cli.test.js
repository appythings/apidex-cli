const {runUploadSpecCli} = require('../src/commands/upload-spec');

describe('runUploadSpecCli', () => {
  it('uses default deps on failure when none passed', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const portal = {
      pushSwagger: jest.fn().mockRejectedValue(new Error('boom')),
      pushCategories: jest.fn().mockResolvedValue(),
      pushTeams: jest.fn().mockResolvedValue(),
      pushBackendTeams: jest.fn(),
      assignBackendTeamsFromManifest: jest.fn(),
    };

    await runUploadSpecCli(portal);

    expect(
      logSpy.mock.calls.some(c => String(c[0]).includes('boom')),
    ).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('prints formatted error and invokes exit(1) with custom deps', async () => {
    const logs = [];
    const portal = {
      pushSwagger: jest.fn().mockRejectedValue({
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {m: 'bad'},
        },
        config: {
          method: 'POST',
          url: 'api/x',
          baseURL: 'https://h',
        },
      }),
      pushCategories: jest.fn().mockResolvedValue(),
      pushTeams: jest.fn().mockResolvedValue(),
    };

    await runUploadSpecCli(portal, {
      logError: msg => logs.push(msg),
      exit: code => logs.push(`exit:${code}`),
    });

    expect(logs.some(l => String(l).startsWith('exit:1'))).toBe(true);
    expect(logs.some(l => String(l).includes('HTTP 401'))).toBe(true);
  });
});
