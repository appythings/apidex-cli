jest.mock('@apidevtools/swagger-parser', () => ({
  validate: jest.fn(() => Promise.resolve()),
}));

const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const Portal = require('../src/devportal/portal');

const fixtures = path.join(__dirname, 'fixtures');

describe('Portal', () => {
  describe('constructor', () => {
    it('throws when manifest has nothing to upload', () => {
      const bad = path.join(fixtures, 'manifest-invalid-only-teams.yaml');

      expect(
        () =>
          new Portal(
            {hostname: 'https://portal.test', environment: 'e', token: 't'},
            bad,
          ),
      ).toThrow('no product found to upload');
    });
  });

  let origCwd;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
  });

  afterEach(() => {
    process.chdir(origCwd);
    jest.restoreAllMocks();
  });

  describe('collectBackendTeamAssignments', () => {
    it('reads products and categories backendTeam entries', () => {
      expect(
        Portal.collectBackendTeamAssignments({
          products: [
            {name: 'a', backendTeam: 't1'},
            {name: 'b'},
          ],
          categories: [
            {
              products: [{name: 'c', backendTeam: null}],
            },
            {name: 'noop'},
          ],
        }),
      ).toEqual([
        {productName: 'a', backendTeam: 't1'},
        {productName: 'c', backendTeam: null},
      ]);
    });
  });

  describe('readSwaggerFile', () => {
    it('throws for unsupported extensions without reading disk', () => {
      const readSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => '{"x":1}');

      const p = new Portal({hostname: 'h', token: 't'});
      expect(() => p.readSwaggerFile('/fake/spec.txt')).toThrow(
        'Openapi spec must be either yaml/yml or json',
      );
      readSpy.mockRestore();
    });

    it('loads JSON swagger', () => {
      const p = new Portal({hostname: 'h', token: 't'});
      const parsed = p.readSwaggerFile(path.join(fixtures, 'spec-min.json'));

      expect(parsed).toMatchObject({openapi: '3.0.2'});
    });
  });

  describe('pushBackendTeams', () => {
    it('does nothing without backendTeams in manifest', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 't',
        },
        mf,
      );
      portal.login = jest.fn();
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushBackendTeams();
      expect(portal.request.get).not.toHaveBeenCalled();
    });

    it('creates backend team when missing', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
      jest.spyOn(portal.request, 'post').mockResolvedValue({
        status: 200,
        data: {
          id: 'new-backend-id',
          name: 'backend-alpha',
          teamType: 'backend',
        },
      });

      await portal.pushBackendTeams();
      const teamPosts = portal.request.post.mock.calls.filter(([url]) => {
        const s = typeof url === 'string' ? url : '';
        return /^api\/teams(?:\?|$)/.test(s);
      });
      expect(teamPosts).toHaveLength(1);
      expect(teamPosts[0][1]).toMatchObject({
        name: 'backend-alpha',
        teamType: 'backend',
      });
      expect(String(teamPosts[0][0])).toContain('developerId');
    });

    it('reuses existing backend team with correct type', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [
          {
            id: 'existing',
            name: 'backend-alpha',
            teamType: 'backend',
          },
        ],
      });
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushBackendTeams();
      const createTeamCalls = portal.request.post.mock.calls.filter(
        ([url]) => typeof url === 'string' && /^api\/teams(?:\?|$)/.test(url),
      );
      expect(createTeamCalls.length).toBe(0);
    });

    it('creates permission groups for new backend teams', async () => {
      const mf = path.join(fixtures, 'manifest-backend-permissions.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        mf,
      );
      jest
        .spyOn(portal.request, 'get')
        .mockResolvedValueOnce({data: []})
        .mockResolvedValueOnce({data: []});
      jest
        .spyOn(portal.request, 'post')
        .mockResolvedValueOnce({
          status: 200,
          data: {
            id: 'tid',
            name: 'backend-perm-test',
            teamType: 'backend',
          },
        })
        .mockResolvedValueOnce({status: 200, data: {name: 'group-a'}});

      await portal.pushBackendTeams();

      const pgPost = portal.request.post.mock.calls.find(
        ([u]) => typeof u === 'string' && u.includes('/permissiongroups'),
      );
      expect(pgPost).toBeTruthy();
      expect(pgPost[1]).toEqual({name: 'group-a'});
    });

    it('throws when name exists as non-backend team', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [
          {
            id: 'x',
            name: 'backend-alpha',
            teamType: 'normal',
          },
        ],
      });

      await expect(portal.pushBackendTeams()).rejects.toThrow(/not backend$/m);
    });
  });

  describe('assignBackendTeamsFromManifest', () => {
    it('assigns resolved backend team id', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'env-1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [
          {
            id: 'bt-uuid',
            name: 'backend-alpha',
            teamType: 'backend',
          },
        ],
      });
      jest.spyOn(portal.request, 'post').mockResolvedValue({status: 204});

      await portal.assignBackendTeamsFromManifest();
      const assign = portal.request.post.mock.calls.find(c =>
        String(c[0]).includes('assign-backend-team'),
      );
      expect(assign).toBeTruthy();
      expect(assign[1]).toEqual({backendTeamId: 'bt-uuid'});
    });

    it('unassigns with null', async () => {
      const mf = path.join(fixtures, 'manifest-categories-unassign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'env-1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
      jest.spyOn(portal.request, 'post').mockResolvedValue({status: 204});

      await portal.assignBackendTeamsFromManifest();
      expect(portal.request.post.mock.calls.length).toBeGreaterThanOrEqual(
        1,
      );
      expect(portal.request.post.mock.calls[0][1]).toEqual({
        backendTeamId: null,
      });
    });

    it('throws when backend team name is unknown', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'env-1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [],
      });

      await expect(portal.assignBackendTeamsFromManifest()).rejects.toThrow(
        /no backend team named/,
      );
    });

    it('throws when team exists but is not backend type', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'env-1',
          token: 'tok',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [
          {
            id: '1',
            name: 'backend-alpha',
            teamType: 'normal',
          },
        ],
      });

      await expect(portal.assignBackendTeamsFromManifest()).rejects.toThrow(
        /exists but teamType is/,
      );
    });

    it('throws for empty backendTeam string', async () => {
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'env-1',
          token: 'tok',
        },
        false,
      );
      portal.backendTeamAssignments = [
        {productName: 'z', backendTeam: '   '},
      ];
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});

      await expect(portal.assignBackendTeamsFromManifest()).rejects.toThrow(
        /Invalid backendTeam/,
      );
    });

    it('requires environment configuration', async () => {
      const portal = new Portal({hostname: 'https://portal.test', token: 't'});
      portal.backendTeamAssignments = [
        {productName: 'x', backendTeam: 'bt'},
      ];
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});

      await expect(portal.assignBackendTeamsFromManifest()).rejects.toThrow(
        '--environment',
      );
    });
  });

  describe('pushSwagger', () => {
    it('returns early when swaggerFiles missing', async () => {
      const yamlPath = path.join(
        fixtures,
        'manifest-categories-unassign.yaml',
      );
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 't',
        },
        yamlPath,
      );
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushSwagger();

      expect(portal.request.post).not.toHaveBeenCalled();
    });

    it('uploads openapi for each manifest product', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 't',
          force: false,
        },
        mf,
      );
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushSwagger();

      expect(portal.request.post).toHaveBeenCalledWith(
        'api/environments/e1/apiproducts/api-product-1/specs',
        expect.objectContaining({
          inheritSpec: false,
          latest: true,
        }),
      );
    });

    it('logs failure and rethrows axios errors', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 't',
        },
        mf,
      );

      const err = new Error('network');
      jest.spyOn(portal.request, 'post').mockRejectedValue(err);

      await expect(portal.pushSwagger()).rejects.toThrow('network');
      expect(
        console.log.mock.calls.some(c =>
          String(c[0]).includes('Failed to upload'),
        ),

      ).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('pushMarkdown', () => {
    it('posts zip with authorization header', async () => {
      const portal = new Portal({
        hostname: 'portal.example.com',
        token: 'abc',
      });
      portal.request.defaults.headers.common.Authorization = 'Bearer abc';
      const spyPost = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({status: 200});

      await portal.pushMarkdown(Buffer.from('zip'));

      expect(spyPost).toHaveBeenCalledWith(
        'https://portal.example.com/markdown',
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer abc',
          }),
        }),
      );
    });
  });

  describe('getProducts', () => {
    it('filters products by swagger manifest names', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          token: 't',
          environment: 'e1',
        },
        mf,
      );
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [
          {name: 'api-product-1', id: 'x'},
          {name: 'other', id: 'y'},
        ],
      });

      const out = await portal.getProducts();
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('api-product-1');
    });
  });

  describe('pushCategories branch', () => {
    it('returns early when manifest has no categories', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 't',
        },
        mf,
      );
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushCategories();

      const categorySpecUploads = portal.request.post.mock.calls.filter(
        ([u]) => String(u) === 'api/specs',
      );
      expect(categorySpecUploads).toHaveLength(0);
    });

    it('skips openapi read when inheritSpec implies no openapi', async () => {
      const yamlPath = path.join(fixtures, 'manifest-categories-unassign.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
          force: true,
        },
        yamlPath,
      );
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushCategories();
      expect(portal.request.post).toHaveBeenCalled();
      const uploads = portal.request.post.mock.calls.filter(([u]) =>
        String(u).includes('apiproducts/sub-prod'),
      );
      expect(uploads.length).toBeGreaterThanOrEqual(1);
    });

    it('logs when nested product has inheritSpec false but no openapi', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      const yamlPath = path.join(
        fixtures,
        'manifest-category-missing-spec.yaml',
      );
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        yamlPath,
      );
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushCategories();

      expect(
        console.log.mock.calls.some(c =>
          String(c[0]).includes('You have to specify spec'),
        ),
      ).toBe(true);
    });
  });

  describe('pushTeams create flow', () => {
    it('creates normal team via API', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      const manifestWithTeams = path.join(fixtures, 'manifest-with-team.yaml');

      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        manifestWithTeams,
      );

      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
      jest.spyOn(portal.request, 'post').mockResolvedValue({
        status: 200,
        data: {id: 'team-1', name: 'cli-team'},
      });

      await portal.pushTeams();

      expect(portal.request.post).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  describe('auth and query params', () => {
    it('pushSwagger uses force query and calls login without token', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          force: true,
        },
        mf,
      );
      portal.login = jest.fn().mockImplementation(async () => {
        portal.request.defaults.headers.common.Authorization = 'Bearer x';
      });
      jest.spyOn(portal.request, 'post').mockResolvedValue({});

      await portal.pushSwagger();

      expect(portal.login).toHaveBeenCalled();
      expect(portal.request.post.mock.calls[0][0]).toContain('force=true');
    });

    it('assignBackendTeamsFromManifest invokes login without token', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {hostname: 'https://portal.test', environment: 'e1'},
        mf,
      );
      portal.login = jest.fn().mockImplementation(async () => {
        portal.request.defaults.headers.common.Authorization = 'Bearer y';
      });
      jest.spyOn(portal.request, 'get').mockResolvedValue({
        data: [{id: 'z', name: 'backend-alpha', teamType: 'backend'}],
      });
      jest.spyOn(portal.request, 'post').mockResolvedValue({status: 204});

      await portal.assignBackendTeamsFromManifest();

      expect(portal.login).toHaveBeenCalled();
    });

    it('pushBackendTeams invokes login when token missing', async () => {
      const mf = path.join(fixtures, 'manifest-backend-assign.yaml');
      const portal = new Portal(
        {hostname: 'https://portal.test', environment: 'e1'},
        mf,
      );
      portal.login = jest.fn().mockImplementation(async () => {
        portal.request.defaults.headers.common.Authorization = 'Bearer z';
      });
      jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
      jest.spyOn(portal.request, 'post').mockResolvedValue({
        status: 200,
        data: {
          id: 'nb',
          name: 'backend-alpha',
          teamType: 'backend',
        },
      });

      await portal.pushBackendTeams();

      expect(portal.login).toHaveBeenCalled();
    });

    it('pushMarkdown triggers login without token', async () => {
      const portal = new Portal({hostname: 'p.example'});
      portal.login = jest.fn().mockImplementation(async () => {
        portal.request.defaults.headers.common.Authorization = 'Bearer m';
      });
      jest.spyOn(axios, 'post').mockResolvedValue({});

      await portal.pushMarkdown(Buffer.from('a'));

      expect(portal.login).toHaveBeenCalled();
    });
  });

  describe('pushTeams noop', () => {
    it('returns when no teams in manifest', async () => {
      const mf = path.join(fixtures, 'manifest-products-only.yaml');
      const portal = new Portal(
        {
          hostname: 'https://portal.test',
          environment: 'e1',
          token: 'tok',
        },
        mf,
      );

      jest.spyOn(portal.request, 'get').mockResolvedValue({});

      await portal.pushTeams();

      expect(portal.request.get).not.toHaveBeenCalled();
    });
  });
});
