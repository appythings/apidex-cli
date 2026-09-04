const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const yaml = require('js-yaml');
const {loadContext} = require('../../../src/validate/load-context');
const specKind = require('../../../src/validate/checks/spec-kind');

const validOas = `openapi: "3.0.2"
info:
  title: Pets
  version: "1.0.0"
paths:
  /pets:
    get:
      responses:
        "200":
          description: ok
`;

const validMcp = {
  info: {title: 'Echo MCP', version: '1.0.0'},
  serverUrl: 'https://api.example.com/mcp',
  transport: 'Streamable HTTP',
  tools: [{name: 'echo'}],
};

describe('spec-kind check', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidex-spec-kind-'));
    fs.writeFileSync(path.join(dir, 'echo.yaml'), validOas);
    fs.writeFileSync(
      path.join(dir, 'echo-mcp.json'),
      JSON.stringify(validMcp, null, 2),
    );
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  function writeManifest(doc) {
    const manifestPath = path.join(dir, 'apis.yaml');
    fs.writeFileSync(manifestPath, yaml.dump(doc));
    return loadContext({manifestPath, requireLocales: []});
  }

  it('accepts OpenAPI and MCP documents for their portal types', async () => {
    const ctx = writeManifest({
      products: [
        {name: 'api-product', openapi: 'echo.yaml'},
        {name: 'mcp-product', spec: 'echo-mcp.json', portalType: 'mcp'},
      ],
    });
    expect((await specKind.run(ctx)).ok).toBe(true);
  });

  it('rejects an OpenAPI file tagged as mcp and an MCP file tagged as api', async () => {
    const ctx = writeManifest({
      products: [
        {name: 'wrong-mcp', spec: 'echo.yaml', portalType: 'mcp'},
        {name: 'wrong-api', spec: 'echo-mcp.json', portalType: 'api'},
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /wrong-mcp: spec is not an MCP tools catalogue/,
    );
    expect(result.messages.join('\n')).toMatch(
      /wrong-api: spec looks like an MCP tools catalogue/,
    );
  });

  it('rejects overlays on mcp and inherit without a category spec', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'empty-mcp',
          products: [
            {
              name: 'orphan-mcp',
              portalType: 'mcp',
              inheritSpec: true,
              overlays: [{locale: 'nl-NL', path: 'overlay.yaml'}],
            },
          ],
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /overlays are not supported for portalType mcp/,
    );
    expect(result.messages.join('\n')).toMatch(
      /inheritSpec requires category "empty-mcp"/,
    );
  });

  it('rejects duplicate tool names and both spec pointers', async () => {
    fs.writeFileSync(
      path.join(dir, 'bad-mcp.json'),
      JSON.stringify({tools: [{name: 'echo'}, {name: 'echo'}]}),
    );
    const ctx = writeManifest({
      products: [
        {
          name: 'dup',
          spec: 'bad-mcp.json',
          openapi: 'echo.yaml',
          portalType: 'mcp',
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /declare spec or openapi, not both/,
    );
  });

  it('runs SwaggerParser on api products', async () => {
    fs.writeFileSync(path.join(dir, 'broken.yaml'), 'openapi: "3.0.2"\n');
    const ctx = writeManifest({
      products: [{name: 'broken-api', openapi: 'broken.yaml'}],
    });
    const result = await specKind.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/broken-api:/);
  });

  it('rejects mixed inherit portalTypes', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'mixed',
          spec: 'echo-mcp.json',
          products: [
            {name: 'api-child', portalType: 'api', inheritSpec: true},
            {name: 'mcp-child', portalType: 'mcp', inheritSpec: true},
          ],
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /inheriting products must share one portalType/,
    );
  });

  it('rejects overlays on an MCP category and skips a null category', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'mcp-cat',
          spec: 'echo-mcp.json',
          overlays: [{locale: 'nl-NL', path: 'overlay.yaml'}],
          products: [
            {name: 'mcp-child', portalType: 'mcp', inheritSpec: true},
          ],
        },
      ],
    });
    ctx.manifest.categories.unshift(null);
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /overlays are not supported for portalType mcp/,
    );
  });

  it('reports an unreadable spec and ignores unknown portal types', async () => {
    fs.writeFileSync(path.join(dir, 'not-a-spec.txt'), 'nope');
    const ctx = writeManifest({
      products: [
        {name: 'bad-file', spec: 'not-a-spec.txt'},
        {name: 'website', spec: 'echo.yaml', portalType: 'website'},
        {name: 'inherit-only', inheritSpec: true, spec: 'echo.yaml'},
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(/bad-file:.*yaml\/yml or json/);
    expect(result.messages.join('\n')).not.toMatch(/website:/);
  });

  it('accepts a GraphQL envelope and rejects inherit, overlays, and wrong kinds', async () => {
    fs.writeFileSync(
      path.join(dir, 'echo-gql.json'),
      JSON.stringify({
        document: {
          kind: 'graphql',
          schemaVersion: 1,
          info: {title: 'Echo', version: '1.0.0'},
          schema: 'type Query { hello: String }',
        },
        execution: {
          endpoint: 'https://example.com/graphql',
          auth: {type: 'none'},
        },
      }),
    );
    const ok = writeManifest({
      products: [
        {name: 'gql-ok', spec: 'echo-gql.json', portalType: 'graphql'},
      ],
    });
    expect((await specKind.run(ok)).ok).toBe(true);

    const wrong = writeManifest({
      products: [
        {name: 'gql-oas', spec: 'echo.yaml', portalType: 'graphql'},
        {name: 'oas-gql', spec: 'echo-gql.json', portalType: 'api'},
      ],
    });
    const wrongResult = await specKind.run(wrong);
    expect(wrongResult.messages.join('\n')).toMatch(
      /gql-oas: spec is not a GraphQL v1 upload envelope/,
    );
    expect(wrongResult.messages.join('\n')).toMatch(
      /oas-gql: spec looks like a GraphQL upload envelope/,
    );

    const mcpTagged = writeManifest({
      products: [
        {name: 'mcp-gql', spec: 'echo-gql.json', portalType: 'mcp'},
      ],
    });
    expect((await specKind.run(mcpTagged)).messages.join('\n')).toMatch(
      /mcp-gql: spec looks like a GraphQL upload envelope/,
    );

    const inherit = writeManifest({
      categories: [
        {
          name: 'gql-cat',
          spec: 'echo-gql.json',
          portalType: 'graphql',
          overlays: [{locale: 'nl-NL', path: 'overlay.yaml'}],
          products: [
            {
              name: 'gql-child',
              portalType: 'graphql',
              inheritSpec: true,
              overlays: [{locale: 'nl-NL', path: 'overlay.yaml'}],
            },
          ],
        },
      ],
    });
    const inheritResult = await specKind.run(inherit);
    expect(inheritResult.messages.join('\n')).toMatch(
      /portalType graphql is product-only/,
    );
    expect(inheritResult.messages.join('\n')).toMatch(
      /inheritSpec is not supported for portalType graphql/,
    );
    expect(inheritResult.messages.join('\n')).toMatch(
      /overlays are not supported for portalType graphql/,
    );
  });

  it('rejects a category that declares both spec pointers', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'both-cat',
          spec: 'echo-mcp.json',
          openapi: 'echo.yaml',
          products: [
            {name: 'child', portalType: 'mcp', inheritSpec: true},
          ],
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /both-cat: declare spec or openapi, not both/,
    );
  });

  it('rejects overlays on an MCP category with no inheriting products', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'mcp-only-cat',
          portalType: 'mcp',
          spec: 'echo-mcp.json',
          overlays: [{locale: 'nl-NL', path: 'overlay.yaml'}],
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(
      /overlays are not supported for portalType mcp/,
    );
  });

  it('skips null products, unnamed owners, and a missing loaded document', async () => {
    const ctx = writeManifest({
      products: [
        {spec: 'echo.yaml'},
      ],
      categories: [
        {
          name: 'with-null-child',
          spec: 'echo.yaml',
          products: [{name: 'own-spec', inheritSpec: false, spec: 'echo.yaml'}],
        },
      ],
    });
    ctx.manifest.products.unshift(null);
    ctx.manifest.categories[0].products.unshift(null);
    ctx.entries = ctx.entries.filter(entry => entry.kind !== 'category');
    const result = await specKind.run(ctx);
    expect(result.ok).toBe(true);
  });

  it('reports a category spec parse error and a graphql category', async () => {
    fs.writeFileSync(path.join(dir, 'not-a-spec.txt'), 'nope');
    const ctx = writeManifest({
      categories: [
        {
          name: 'bad-cat',
          spec: 'not-a-spec.txt',
          products: [{name: 'child', inheritSpec: true}],
        },
        {
          name: 'gql-cat',
          spec: 'echo.yaml',
          products: [{name: 'gql-child', portalType: 'graphql', inheritSpec: true}],
        },
      ],
    });
    const result = await specKind.run(ctx);
    expect(result.messages.join('\n')).toMatch(/bad-cat:/);
    expect(result.messages.join('\n')).toMatch(
      /portalType graphql is product-only/,
    );
  });

  it('accepts an empty context and treats a non-Error adapter throw as a string', async () => {
    const empty = await specKind.run({
      manifestPath: path.join(dir, 'missing.yaml'),
    });
    expect(empty.ok).toBe(true);

    const ctx = writeManifest({
      products: [{name: 'ok-api', openapi: 'echo.yaml'}],
    });
    const openapi = require('../../../src/specs/openapi');
    const spy = jest
      .spyOn(openapi, 'validate')
      .mockImplementation(async () => {
        throw 'adapter exploded';
      });
    try {
      const result = await specKind.run(ctx);
      expect(result.messages.join('\n')).toMatch(/adapter exploded/);
    } finally {
      spy.mockRestore();
    }
  });
});
