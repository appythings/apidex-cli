const {runUploadSpec} = require('../src/commands/upload-spec');

describe('runUploadSpec', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls pipeline in order and skips extra backend logs when empty', async () => {
    const order = [];
    const portal = {
      pushSwagger: jest.fn(async () => {
        order.push('swagger');
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

    await runUploadSpec(portal);

    expect(order).toEqual([
      'swagger',
      'categories',
      'teams',
      'backend',
      'assign',
    ]);
    const logs = console.log.mock.calls.flat().join('\n');
    expect(logs).not.toContain('Successfully updated backend teams');
    expect(logs).not.toContain(
      'Successfully applied backend team assignments',
    );
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

    expect(console.log.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('backend teams'))).toBe(true);

    expect(
      console.log.mock.calls.some(c => typeof c[0] === 'string' &&
        c[0].includes('backend team assignments'),
      ),

    ).toBe(true);

  });

});
