const {runUploadSpec} = require('../src/commands/upload-spec');

describe('runUploadSpec', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs swagger, categories, and teams in parallel then backend phases sequentially', async () => {
    const order = [];
    let releaseSwagger;
    const swaggerGate = new Promise(resolve => {
      releaseSwagger = resolve;
    });

    const portal = {
      pushSwagger: jest.fn(async () => {
        order.push('swagger-start');
        await swaggerGate;
        order.push('swagger-end');
      }),
      pushCategories: jest.fn(async () => {
        order.push('categories');
      }),
      pushTeams: jest.fn(async () => {
        order.push('teams');
      }),
      pushBackendTeams: jest.fn(async () => {
        order.push('backend');
      }),
      assignBackendTeamsFromManifest: jest.fn(async () => {
        order.push('assign');
      }),
      backendTeamConfig: [],
      backendTeamAssignments: [],
    };

    const runPromise = runUploadSpec(portal);
    await Promise.resolve();
    expect(order).toEqual(['swagger-start', 'categories', 'teams']);
    expect(portal.pushBackendTeams).not.toHaveBeenCalled();

    releaseSwagger();
    await runPromise;

    expect(order).toEqual([
      'swagger-start',
      'categories',
      'teams',
      'swagger-end',
      'backend',
      'assign',
    ]);
    const logs = console.log.mock.calls.flat().join('\n');
    expect(logs).not.toContain('Successfully updated backend teams');
    expect(logs).not.toContain(
      'Successfully applied backend team assignments',
    );
  });

  it('does not run backend phases when parallel batch fails', async () => {
    const portal = {
      pushSwagger: jest.fn().mockRejectedValue(new Error('swagger failed')),
      pushCategories: jest.fn().mockResolvedValue(),
      pushTeams: jest.fn().mockResolvedValue(),
      pushBackendTeams: jest.fn().mockResolvedValue(),
      assignBackendTeamsFromManifest: jest.fn().mockResolvedValue(),
      backendTeamConfig: [],
      backendTeamAssignments: [],
    };

    await expect(runUploadSpec(portal)).rejects.toThrow('swagger failed');
    expect(portal.pushBackendTeams).not.toHaveBeenCalled();
    expect(portal.assignBackendTeamsFromManifest).not.toHaveBeenCalled();
  });

  it('mentions backend phases when manifest had entries', async () => {
    const portal = {
      pushSwagger: jest.fn().mockResolvedValue(),
      pushCategories: jest.fn().mockResolvedValue(),
      pushTeams: jest.fn().mockResolvedValue(),
      pushBackendTeams: jest.fn().mockResolvedValue(),
      assignBackendTeamsFromManifest: jest.fn().mockResolvedValue(),
      backendTeamConfig: [{name: 'b'}],
      backendTeamAssignments: [{productName: 'p', backendTeam: 'b'}],
    };

    await runUploadSpec(portal);

    expect(
      console.log.mock.calls.some(
        c => typeof c[0] === 'string' && c[0].includes('backend teams'),
      ),
    ).toBe(true);
    expect(
      console.log.mock.calls.some(
        c =>
          typeof c[0] === 'string' &&
          c[0].includes('backend team assignments'),
      ),
    ).toBe(true);
  });
});
