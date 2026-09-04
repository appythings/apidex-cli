const path = require('path');
const {loadContext} = require('../../src/validate/load-context');

const fixtures = path.join(__dirname, '../fixtures/validate');

describe('loadContext', () => {
  it('resolves overlay paths relative to the manifest directory', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      requireLocales: [],
    });
    expect(ctx.entries).toHaveLength(1);
    expect(ctx.entries[0].name).toBe('pet-store');
    expect(ctx.entries[0].spec.info.title).toContain('Overlay validate');
    expect(ctx.entries[0].overlays[0].path).toBe(
      path.join(fixtures, 'overlays/nl-NL.yaml'),
    );
    expect(ctx.entries[0].overlays[0].overlay.overlay).toBe('1.1.0');
  });

  it('records a missing overlay file on the entry instead of throwing', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-missing-file.yaml'),
      requireLocales: [],
    });
    expect(ctx.entries[0].overlays[0].error).toMatch(/ENOENT|no such file/i);
  });

  it('loads category products including inheritSpec entries', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-inherit.yaml'),
      requireLocales: [],
    });
    const names = ctx.entries.map(entry => entry.name);
    expect(names).toEqual(['pet-category', 'pets-public', 'pets-own']);
    expect(
      ctx.entries.find(entry => entry.name === 'pets-public').inheritSpec,
    ).toBe(true);
  });

  it('loads json specs and json overlays', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-json.yaml'),
      requireLocales: [],
    });
    expect(ctx.entries[0].spec.openapi).toBe('3.0.2');
    expect(ctx.entries[0].overlays[0].overlay.info.title).toBe('JSON overlay');
  });

  it('records an unreadable spec type as specError', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-bad-spec.yaml'),
      requireLocales: [],
    });
    expect(ctx.entries[0].specError).toMatch(/yaml\/yml or json/);
  });

  it('loads a spec field the same way as openapi', () => {
    const dir = require('fs-extra').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-spec-field-'),
    );
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(dir, 'echo-mcp.json'),
      JSON.stringify({tools: [{name: 'echo'}]}),
    );
    const manifestPath = path.join(dir, 'mcps.yaml');
    fs.writeFileSync(
      manifestPath,
      yaml.dump({
        products: [
          {name: 'mcp-product', spec: 'echo-mcp.json', portalType: 'mcp'},
        ],
      }),
    );
    const ctx = loadContext({manifestPath, requireLocales: []});
    expect(ctx.entries[0].specPath).toBe(path.join(dir, 'echo-mcp.json'));
    expect(ctx.entries[0].specField).toBe('spec');
    expect(ctx.entries[0].portalType).toBe('mcp');
    expect(ctx.entries[0].spec.tools[0].name).toBe('echo');
    fs.removeSync(dir);
  });

  it('loads a category-only manifest and a product without openapi', () => {
    const categoryOnly = loadContext({
      manifestPath: path.join(fixtures, 'manifest-category-only.yaml'),
      requireLocales: [],
    });
    expect(categoryOnly.entries).toHaveLength(1);
    expect(categoryOnly.entries[0].kind).toBe('category');

    const noOpenapi = loadContext({
      manifestPath: path.join(fixtures, 'manifest-product-no-openapi.yaml'),
      requireLocales: [],
    });
    expect(noOpenapi.entries[0].specPath).toBeUndefined();
  });

  it('skips null categories and products when collecting entries', () => {
    const dir = require('fs-extra').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-null-entries-'),
    );
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    const manifestPath = path.join(dir, 'apis.yaml');
    fs.writeFileSync(path.join(dir, 'echo.yaml'), 'openapi: "3.0.2"\n');
    fs.writeFileSync(
      manifestPath,
      yaml.dump({
        products: [null, {name: 'top', openapi: 'echo.yaml'}],
        categories: [
          null,
          {
            name: 'cat',
            openapi: 'echo.yaml',
            products: [null, {name: 'nested', inheritSpec: true}],
          },
        ],
      }),
    );
    const ctx = loadContext({manifestPath, requireLocales: []});
    expect(ctx.entries.map(entry => entry.name)).toEqual([
      'top',
      'cat',
      'nested',
    ]);
    fs.removeSync(dir);
  });

  it('treats an empty manifest file as an empty document', () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-empty.yaml'),
      requireLocales: [],
    });
    expect(ctx.entries).toEqual([]);
  });

  it('throws when overlays is not a list', () => {
    expect(() =>
      loadContext({
        manifestPath: path.join(fixtures, 'manifest-overlays-not-list.yaml'),
        requireLocales: [],
      }),
    ).toThrow(/must be a list/);
  });
});
