const path = require('path');
const {loadContext} = require('../../../src/validate/load-context');
const overlayFiles = require('../../../src/validate/checks/overlay-files');

const fixtures = path.join(__dirname, '../../fixtures/validate');

describe('overlay-files check', () => {
  it('fails when an overlay file is missing', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-missing-file.yaml'),
      requireLocales: [],
    });
    const result = await overlayFiles.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/pet-store/);
  });

  it('skips overlay file checks for mcp products', async () => {
    const result = await overlayFiles.run({
      entries: [
        {
          name: 'mcp-product',
          portalType: 'mcp',
          overlays: [{error: 'would fail if checked'}],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('fails when an overlay entry has no path', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-missing-path.yaml'),
      requireLocales: [],
    });
    const result = await overlayFiles.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/path/);
  });
});
