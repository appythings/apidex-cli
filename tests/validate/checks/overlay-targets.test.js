const path = require('path');
const {loadContext} = require('../../../src/validate/load-context');
const overlayTargets = require('../../../src/validate/checks/overlay-targets');

const fixtures = path.join(__dirname, '../../fixtures/validate');

describe('overlay-targets check', () => {
  it('passes when every target matches a node', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      requireLocales: [],
    });
    const result = await overlayTargets.run(ctx);
    expect(result.ok).toBe(true);
  });

  it('fails when a target matches zero nodes', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-zero-target.yaml'),
      requireLocales: [],
    });
    const result = await overlayTargets.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/matched 0 nodes/);
  });

  it('fails when the spec itself cannot be parsed', async () => {
    const ctx = loadContext({
      manifestPath: path.join(fixtures, 'manifest-bad-spec.yaml'),
      requireLocales: [],
    });
    const result = await overlayTargets.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/cannot check overlay targets/);
  });

  it('covers inheritSpec, missing spec, and malformed overlay actions', async () => {
    const result = await overlayTargets.run({
      entries: [
        {inheritSpec: true, name: 'skip-me', overlays: []},
        {inheritSpec: false, name: 'no-spec', overlays: []},
        {
          inheritSpec: false,
          name: 'pet-store',
          spec: {info: {title: 'x'}},
          overlays: [
            {error: 'unreadable'},
            {overlay: undefined},
            {
              path: 'overlay.yaml',
              overlay: {
                actions: [null, {target: 1}, {target: '$.missing'}],
              },
            },
            {path: 'no-actions.yaml', overlay: {}},
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/matched 0 nodes/);
  });
});
