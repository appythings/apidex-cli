const path = require('path');
const {loadContext} = require('../../../src/validate/load-context');
const requiredLocales = require('../../../src/validate/checks/required-locales');

const fixtures = path.join(__dirname, '../../fixtures/validate');

describe('required-locales check', () => {
  it('is a no-op when --require-locales is omitted', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      requireLocales: [],
    });
    const result = await requiredLocales.run(ctx);
    expect(result.ok).toBe(true);
  });

  it('fails a product that is missing a required locale', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-partial-locales.yaml'),
      requireLocales: ['nl-NL', 'de-DE'],
    });
    const result = await requiredLocales.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/de-DE/);
  });

  it('skips mcp products', async () => {
    const result = await requiredLocales.run({
      options: {requireLocales: ['nl-NL']},
      entries: [
        {
          kind: 'product',
          inheritSpec: false,
          portalType: 'mcp',
          specPath: '/tmp/mcp.json',
          name: 'mcp-product',
          overlays: [],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('skips inheritSpec products', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-inherit.yaml'),
      requireLocales: ['nl-NL'],
    });
    const result = await requiredLocales.run(ctx);
    expect(result.ok).toBe(false);
    expect(
      result.messages.some(message => message.includes('pets-public')),
    ).toBe(false);
    expect(result.messages.some(message => message.includes('pets-own'))).toBe(
      true,
    );
  });

  it('skips products without a spec path and keeps unsupported required tags', async () => {
    const result = await requiredLocales.run({
      options: {requireLocales: ['xx-XX']},
      entries: [
        {inheritSpec: true, name: 'inherited', overlays: []},
        {
          kind: 'product',
          inheritSpec: false,
          name: 'no-spec',
          overlays: [],
        },
        {
          kind: 'product',
          inheritSpec: false,
          specPath: '/tmp/spec.yaml',
          name: 'needs-overlay',
          overlays: [],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.messages).toEqual([
      'needs-overlay: missing required overlay locale xx-XX',
    ]);
  });

  it('treats missing options as no required locales', async () => {
    const result = await requiredLocales.run({entries: []});
    expect(result.ok).toBe(true);
  });
});
