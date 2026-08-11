jest.mock('@apidevtools/swagger-parser', () => ({
  validate: jest.fn(() => Promise.resolve()),
}));

const path = require('path');
const Portal = require('../src/devportal/portal');

const fixtures = path.join(__dirname, 'fixtures');

function newPortal(manifest) {
  return new Portal(
    {hostname: 'https://portal.test', environment: 'e1', token: 'tok'},
    path.join(fixtures, manifest),
  );
}

describe('pushSwagger with overlays', () => {
  let origCwd;
  let logSpy;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(origCwd);
    jest.restoreAllMocks();
  });

  it('sends declared overlays alongside the spec', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await portal.pushSwagger();

    expect(portal.request.post).toHaveBeenCalledTimes(1);
    const [url, body] = portal.request.post.mock.calls[0];
    expect(url).toContain('apiproducts/api-product-1/specs');
    expect(body.overlays).toHaveLength(2);
    expect(body.overlays.map(entry => entry.locale)).toEqual([
      'nl-NL',
      'de-DE',
    ]);
  });

  it('keeps the canonical spec free of translated content', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    const serialized = JSON.stringify(body.spec);
    expect(serialized).not.toContain('Nederlandse beschrijving.');
    expect(serialized).not.toContain('x-description-nl-NL');
  });

  it('preserves JSONPath targets through the upload payload', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    const dutch = body.overlays.find(entry => entry.locale === 'nl-NL');
    expect(dutch.overlay.actions[1].target).toBe("$.paths['/pets'].get");
  });

  it('sends an empty overlay list when none are declared', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    expect(body.overlays).toEqual([]);
  });

  it('fails before uploading when an overlay is invalid', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    portal.swaggerFiles = [
      {
        name: 'api-product-1',
        openapi: 'swagger-min.yaml',
        overlays: [{locale: 'nl-NL', path: 'overlay-invalid.yaml'}],
      },
    ];
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await expect(portal.pushSwagger()).rejects.toThrow(
      'missing a "target" JSONPath expression',
    );
    expect(portal.request.post).not.toHaveBeenCalled();
  });

  it('fails before uploading when a locale is unsupported', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    portal.swaggerFiles = [
      {
        name: 'api-product-1',
        openapi: 'swagger-min.yaml',
        overlays: [{locale: 'it-IT', path: 'overlay-nl.yaml'}],
      },
    ];
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});

    await expect(portal.pushSwagger()).rejects.toThrow(
      'Unsupported overlay locale "it-IT"',
    );
    expect(portal.request.post).not.toHaveBeenCalled();
  });
});

describe('pushCategories with overlays', () => {
  let origCwd;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(origCwd);
    jest.restoreAllMocks();
  });

  it('uploads category overlays to the overlay endpoint', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    const putSpy = jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    expect(putSpy).toHaveBeenCalledTimes(1);
    const [url, body] = putSpy.mock.calls[0];
    expect(url).toBe('api/specs/cat-spec-1/overlays');
    expect(body.overlays).toHaveLength(1);
    expect(body.overlays[0].locale).toBe('nl-NL');
  });

  it('sends overlays inline for a category product with its own spec', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    const ownSpecCall = portal.request.post.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('own-spec-prod'),
    );
    expect(ownSpecCall).toBeDefined();
    expect(ownSpecCall[1].overlays).toHaveLength(1);
    expect(ownSpecCall[1].overlays[0].locale).toBe('de-DE');
  });

  it('does not send overlays for a product that inherits the category spec', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    const inheritCall = portal.request.post.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('sub-prod'),
    );
    expect(inheritCall).toBeDefined();
    expect(inheritCall[1].overlays).toEqual([]);
  });

  it('warns instead of silently dropping overlays on an inheriting product', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    const messages = console.log.mock.calls.map(args => String(args[0]));
    expect(
      messages.some(
        message =>
          message.includes('Ignoring overlays for sub-prod') &&
          message.includes('cat1'),
      ),
    ).toBe(true);
  });

  it('skips category overlays when no spec id comes back', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {}});
    const putSpy = jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    expect(putSpy).not.toHaveBeenCalled();
    const messages = console.log.mock.calls.map(args => String(args[0]));
    expect(
      messages.some(message => message.includes('no spec id returned')),
    ).toBe(true);
  });

  it('does not call the overlay endpoint for a category without overlays', async () => {
    const portal = newPortal('manifest-categories-unassign.yaml');
    portal.login = jest.fn();
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    const putSpy = jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    expect(putSpy).not.toHaveBeenCalled();
  });
});
