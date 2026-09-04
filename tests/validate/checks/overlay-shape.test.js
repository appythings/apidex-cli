const path = require('path');
const {loadContext} = require('../../../src/validate/load-context');
const {validateOverlayDocument} = require('../../../src/lib/overlays');
const overlayShape = require('../../../src/validate/checks/overlay-shape');

jest.mock('../../../src/lib/overlays', () => {
  const actual = jest.requireActual('../../../src/lib/overlays');
  return {
    ...actual,
    validateOverlayDocument: jest.fn((...args) =>
      actual.validateOverlayDocument(...args),
    ),
  };
});

const fixtures = path.join(__dirname, '../../fixtures/validate');

describe('overlay-shape check', () => {
  it('fails an overlay that is missing a target', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-bad-shape.yaml'),
      requireLocales: [],
    });
    const result = await overlayShape.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/target/);
  });

  it('accepts a mixed update and remove overlay', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      requireLocales: [],
    });
    const result = await overlayShape.run(ctx);
    expect(result.ok).toBe(true);
  });

  it('skips overlays that failed to parse', async () => {
    const result = await overlayShape.run({
      entries: [
        {
          name: 'pet-store',
          overlays: [
            {error: 'missing file'},
            {overlay: undefined},
            {
              path: 'x.yaml',
              overlay: {overlay: '1.1.0', actions: [{target: '$.info'}]},
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('stringifies non-Error throws from shape validation', async () => {
    validateOverlayDocument.mockImplementationOnce(() => {
      throw 'not-an-error';
    });
    const result = await overlayShape.run({
      entries: [
        {
          name: 'pet-store',
          overlays: [
            {
              path: 'x.yaml',
              overlay: {
                overlay: '1.1.0',
                actions: [{target: '$.info', update: {}}],
              },
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/not-an-error/);
  });
});
