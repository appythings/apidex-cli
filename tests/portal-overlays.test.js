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

function mockEmptyOverlayLookups(portal) {
  jest.spyOn(portal.request, 'get').mockResolvedValue({data: []});
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
    mockEmptyOverlayLookups(portal);

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

  it('encodes spaces in product names on spec upload URLs', async () => {
    const portal = newPortal('manifest-echo-v1.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    mockEmptyOverlayLookups(portal);

    await portal.pushSwagger();

    expect(portal.request.post).toHaveBeenCalledWith(
      'api/environments/e1/apiproducts/Echo%20V1/specs',
      expect.objectContaining({latest: true}),
    );
  });

  it('keeps the canonical spec free of translated content', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    mockEmptyOverlayLookups(portal);

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    const serialized = JSON.stringify(body.spec);
    expect(serialized).not.toContain('Nederlandse beschrijving.');
    expect(serialized).not.toContain('x-description-nl-NL');
  });

  it('preserves JSONPath targets through the upload payload', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    mockEmptyOverlayLookups(portal);

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    const dutch = body.overlays.find(entry => entry.locale === 'nl-NL');
    expect(dutch.overlay.actions[1].target).toBe("$.paths['/pets'].get");
  });

  it('sends an empty overlay list when none are declared', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    mockEmptyOverlayLookups(portal);

    await portal.pushSwagger();

    const [, body] = portal.request.post.mock.calls[0];
    expect(body.overlays).toEqual([]);
  });

  it('treats a 404 product spec list as a first-time upload', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    const missing = new Error('not found');
    missing.response = {status: 404};
    jest.spyOn(portal.request, 'get').mockRejectedValue(missing);

    await portal.pushSwagger();
    expect(portal.request.post).toHaveBeenCalled();
  });

  it('rethrows product spec listing errors other than 404', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    const boom = new Error('specs down');
    boom.response = {status: 500};
    jest.spyOn(portal.request, 'get').mockRejectedValue(boom);

    await expect(portal.pushSwagger()).rejects.toThrow('specs down');
  });

  it('refuses a new version that would drop existing overlays', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    const postSpy = jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 's1'}});
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        return {data: [{locale: 'nl-NL'}]};
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    await expect(portal.pushSwagger()).rejects.toThrow(
      /Refusing to upload api-product-1 without overlay files/,
    );
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('rethrows overlay listing errors other than 404', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    const boom = new Error('overlay store down');
    boom.response = {status: 500};
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        throw boom;
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    await expect(portal.pushSwagger()).rejects.toThrow('overlay store down');
  });

  it('treats a 404 overlay listing as no existing overlays', async () => {
    const portal = newPortal('manifest-products-only.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    const missing = new Error('not found');
    missing.response = {status: 404};
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        throw missing;
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    await portal.pushSwagger();
    expect(portal.request.post).toHaveBeenCalled();
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

  it('--force does not bypass the overlay-drop check', async () => {
    const portal = new Portal(
      {
        hostname: 'https://portal.test',
        environment: 'e1',
        token: 'tok',
        force: true,
      },
      path.join(fixtures, 'manifest-products-only.yaml'),
    );
    const postSpy = jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 's1'}});
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        return {data: [{locale: 'de-DE'}]};
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    await expect(portal.pushSwagger()).rejects.toThrow(/without overlay files/);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('refuses a new version that would drop a subset of overlay locales', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    portal.swaggerFiles = [
      {
        name: 'api-product-1',
        openapi: 'swagger-min.yaml',
        overlays: [{locale: 'nl-NL', path: 'overlay-nl.yaml'}],
      },
    ];
    const postSpy = jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 's1'}});
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        return {data: [{locale: 'nl-NL'}, {locale: 'de-DE'}]};
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    let dropError;
    try {
      await portal.pushSwagger();
    } catch (error) {
      dropError = error;
    }
    expect(dropError.message).toMatch(/would drop overlays for de-DE/);
    expect(dropError.message).toMatch(/DELETE \/api\/specs\/\{id\}\/overlays/);
    expect(dropError.message).not.toMatch(/require-locales/);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('uploads when the incoming locales cover every published overlay locale', async () => {
    const portal = newPortal('manifest-products-overlays.yaml');
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 's1'}});
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        return {data: [{locale: 'nl-NL'}, {locale: 'de-DE'}]};
      }
      return {data: [{id: 'old-spec', latest: true}]};
    });

    await portal.pushSwagger();
    expect(portal.request.post).toHaveBeenCalled();
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
    mockEmptyOverlayLookups(portal);

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
    mockEmptyOverlayLookups(portal);

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
    mockEmptyOverlayLookups(portal);

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
    mockEmptyOverlayLookups(portal);

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

  it('fails when no spec id comes back for category overlays', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    mockEmptyOverlayLookups(portal);
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {}});
    const putSpy = jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await expect(portal.pushCategories()).rejects.toThrow(
      'Cannot upload overlays for category cat1: no spec id returned',
    );
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('fails the command when category overlay PUT rejects', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    mockEmptyOverlayLookups(portal);
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    const putError = new Error('overlay put failed');
    jest.spyOn(portal.request, 'put').mockRejectedValue(putError);
    const deleteSpy = jest
      .spyOn(portal.request, 'delete')
      .mockResolvedValue({});

    await expect(portal.pushCategories()).rejects.toThrow('overlay put failed');
    expect(deleteSpy).toHaveBeenCalledWith('api/specs/cat-spec-1');
  });

  it('still throws the PUT error when category spec rollback fails', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    mockEmptyOverlayLookups(portal);
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest
      .spyOn(portal.request, 'put')
      .mockRejectedValue(new Error('overlay put failed'));
    const deleteSpy = jest
      .spyOn(portal.request, 'delete')
      .mockRejectedValue(new Error('cleanup failed'));

    await expect(portal.pushCategories()).rejects.toThrow('overlay put failed');
    expect(deleteSpy).toHaveBeenCalledWith('api/specs/cat-spec-1');
  });

  it('does not call the overlay endpoint for a category without overlays', async () => {
    const portal = newPortal('manifest-categories-unassign.yaml');
    portal.login = jest.fn();
    mockEmptyOverlayLookups(portal);
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    const putSpy = jest.spyOn(portal.request, 'put').mockResolvedValue({});

    await portal.pushCategories();

    expect(putSpy).not.toHaveBeenCalled();
  });

  it('refuses a category upload that would drop existing overlays', async () => {
    const portal = newPortal('manifest-categories-unassign.yaml');
    portal.login = jest.fn();
    const postSpy = jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      if (String(url).includes('/overlays')) {
        return {data: [{locale: 'nl-NL'}]};
      }
      return {data: [{id: 'old-cat', latest: true}]};
    });

    let dropError;
    try {
      await portal.pushCategories();
    } catch (error) {
      dropError = error;
    }
    expect(dropError.message).toMatch(
      /Refusing to upload cat1 without overlay files/,
    );
    expect(dropError.message).toMatch(/DELETE \/api\/specs\/\{id\}\/overlays/);
    expect(dropError.message).not.toMatch(/require-locales/);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('does not treat an API product of the same name as the category spec', async () => {
    const portal = newPortal('manifest-categories-overlays.yaml');
    portal.login = jest.fn();
    const postSpy = jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});
    jest.spyOn(portal.request, 'put').mockResolvedValue({});
    const getSpy = jest.spyOn(portal.request, 'get').mockImplementation(async url => {
      const href = String(url);
      if (href.includes('/overlays')) {
        if (href.includes('product-spec-cat')) {
          return {data: [{locale: 'fr-FR'}]};
        }
        return {data: []};
      }
      if (href.includes('apiproducts') && href.includes('cat1')) {
        return {data: [{id: 'product-spec-cat', latest: true}]};
      }
      return {data: []};
    });

    await portal.pushCategories();

    expect(postSpy).toHaveBeenCalledWith(
      'api/specs',
      expect.objectContaining({categoryId: 'cat1'}),
    );
    expect(
      getSpy.mock.calls.some(([url]) =>
        /apiproducts\/.*cat1.*\/specs/.test(String(url)),
      ),
    ).toBe(false);
  });

  it('treats a 404 category spec list as a first-time upload', async () => {
    const portal = newPortal('manifest-categories-unassign.yaml');
    portal.login = jest.fn();
    const missing = new Error('not found');
    missing.response = {status: 404};
    jest.spyOn(portal.request, 'get').mockRejectedValue(missing);
    jest
      .spyOn(portal.request, 'post')
      .mockResolvedValue({data: {id: 'cat-spec-1'}});

    await portal.pushCategories();
    expect(portal.request.post).toHaveBeenCalled();
  });

  it('rethrows category spec listing errors other than 404', async () => {
    const portal = newPortal('manifest-categories-unassign.yaml');
    portal.login = jest.fn();
    const boom = new Error('specs down');
    boom.response = {status: 500};
    jest.spyOn(portal.request, 'get').mockRejectedValue(boom);
    jest.spyOn(portal.request, 'post').mockResolvedValue({data: {id: 'x'}});

    await expect(portal.pushCategories()).rejects.toThrow('specs down');
  });
});
