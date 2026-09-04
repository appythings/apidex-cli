const path = require('path');
const {loadContext} = require('../../../src/validate/load-context');
const overlayLocales = require('../../../src/validate/checks/overlay-locales');

const fixtures = path.join(__dirname, '../../fixtures/validate');

describe('overlay-locales check', () => {
  it('fails an unsupported locale', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-unsupported-locale.yaml'),
      requireLocales: [],
    });
    const result = await overlayLocales.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/it-IT/);
  });

  it('fails a duplicate locale after canonicalization', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-duplicate-locale.yaml'),
      requireLocales: [],
    });
    const result = await overlayLocales.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/duplicate overlay locale/i);
  });

  it('fails an overlay with an empty locale', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-empty-locale.yaml'),
      requireLocales: [],
    });
    const result = await overlayLocales.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/unsupported overlay locale/i);
  });
});
