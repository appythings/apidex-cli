const path = require('path');
const os = require('os');
const {
  SUPPORTED_LOCALES,
  canonicalizeLocale,
  loadOverlays,
  readOverlayFile,
  validateOverlayDocument,
} = require('../src/lib/overlays');

const fixtures = path.join(__dirname, 'fixtures');

describe('SUPPORTED_LOCALES', () => {
  it('matches the portal locale contract', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      'en-GB',
      'nl-NL',
      'de-DE',
      'fr-FR',
      'es-ES',
      'se-SE',
      'ar-SA',
    ]);
  });
});

describe('canonicalizeLocale', () => {
  it('accepts every supported locale unchanged', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(canonicalizeLocale(locale)).toBe(locale);
    }
  });

  it('normalises case and underscores', () => {
    expect(canonicalizeLocale('NL-nl')).toBe('nl-NL');
    expect(canonicalizeLocale('nl_NL')).toBe('nl-NL');
  });

  it('resolves a bare primary subtag', () => {
    expect(canonicalizeLocale('nl')).toBe('nl-NL');
    expect(canonicalizeLocale('de')).toBe('de-DE');
  });

  it('rejects unsupported and empty values', () => {
    expect(canonicalizeLocale('it-IT')).toBeUndefined();
    expect(canonicalizeLocale('')).toBeUndefined();
    expect(canonicalizeLocale('  ')).toBeUndefined();
    expect(canonicalizeLocale(undefined)).toBeUndefined();
    expect(canonicalizeLocale(42)).toBeUndefined();
  });
});

describe('readOverlayFile', () => {
  let origCwd;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
  });

  afterEach(() => {
    process.chdir(origCwd);
  });

  it('reads a yaml overlay', () => {
    const overlay = readOverlayFile('overlay-nl.yaml');
    expect(overlay.overlay).toBe('1.1.0');
    expect(overlay.actions).toHaveLength(2);
  });

  it('reads a json overlay', () => {
    const overlay = readOverlayFile('overlay-de.json');
    expect(overlay.actions[0].update.description).toBe('Deutsche Beschreibung.');
  });

  it('keeps JSONPath targets intact', () => {
    const overlay = readOverlayFile('overlay-nl.yaml');
    expect(overlay.actions[1].target).toBe("$.paths['/pets'].get");
  });

  it('rejects unsupported extensions', () => {
    expect(() => readOverlayFile('overlay.txt')).toThrow(
      'must be either yaml/yml or json',
    );
  });

  it('rejects a missing path', () => {
    expect(() => readOverlayFile(undefined)).toThrow(
      'Overlay entries need a "path"',
    );
    expect(() => readOverlayFile('')).toThrow('Overlay entries need a "path"');
  });
});

describe('validateOverlayDocument', () => {
  const valid = () => ({
    overlay: '1.1.0',
    info: {title: 't', version: '1.0.0'},
    actions: [{target: '$.info', update: {description: 'x'}}],
  });

  it('accepts a well-formed overlay', () => {
    expect(() => validateOverlayDocument(valid(), 'f')).not.toThrow();
  });

  it('accepts a remove action', () => {
    const doc = valid();
    doc.actions = [{target: '$.info', remove: true}];
    expect(() => validateOverlayDocument(doc, 'f')).not.toThrow();
  });

  it('rejects a non-object', () => {
    expect(() => validateOverlayDocument(null, 'f')).toThrow('must be an object');
    expect(() => validateOverlayDocument([], 'f')).toThrow('must be an object');
  });

  it('rejects a missing or unsupported version', () => {
    const doc = valid();
    delete doc.overlay;
    expect(() => validateOverlayDocument(doc, 'f')).toThrow(
      'missing the "overlay" version field',
    );

    const future = valid();
    future.overlay = '2.0.0';
    expect(() => validateOverlayDocument(future, 'f')).toThrow(
      'unsupported version',
    );
  });

  it('rejects empty actions', () => {
    const doc = valid();
    doc.actions = [];
    expect(() => validateOverlayDocument(doc, 'f')).toThrow(
      'non-empty "actions" array',
    );
  });

  it('rejects a missing info title', () => {
    const doc = valid();
    delete doc.info;
    expect(() => validateOverlayDocument(doc, 'f')).toThrow('missing info.title');

    const empty = valid();
    empty.info = {};
    expect(() => validateOverlayDocument(empty, 'f')).toThrow(
      'missing info.title',
    );
  });

  it('rejects an action without a target', () => {
    const doc = valid();
    doc.actions = [{update: {description: 'x'}}];
    expect(() => validateOverlayDocument(doc, 'f')).toThrow(
      'missing a "target" JSONPath expression',
    );
  });

  it('rejects an action with neither update nor remove', () => {
    const doc = valid();
    doc.actions = [{target: '$.info'}];
    expect(() => validateOverlayDocument(doc, 'f')).toThrow(
      'must declare either "update" or "remove"',
    );
  });

  it('names the offending file in the error', () => {
    const doc = valid();
    doc.actions = [];
    expect(() => validateOverlayDocument(doc, 'overlays/nl.yaml (nl-NL)')).toThrow(
      'overlays/nl.yaml (nl-NL)',
    );
  });
});

describe('loadOverlays', () => {
  let origCwd;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
  });

  afterEach(() => {
    process.chdir(origCwd);
  });

  it('returns an empty list when no overlays are declared', () => {
    expect(loadOverlays({name: 'p'})).toEqual([]);
    expect(loadOverlays({name: 'p', overlays: null})).toEqual([]);
    expect(loadOverlays(undefined)).toEqual([]);
  });

  it('loads yaml and json overlays with canonical locales', () => {
    const result = loadOverlays({
      name: 'p',
      overlays: [
        {locale: 'nl', path: 'overlay-nl.yaml'},
        {locale: 'de-DE', path: 'overlay-de.json'},
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].locale).toBe('nl-NL');
    expect(result[0].overlay.actions[0].update.description).toBe(
      'Nederlandse beschrijving.',
    );
    expect(result[1].locale).toBe('de-DE');
  });

  it('rejects a non-list overlays value', () => {
    expect(() => loadOverlays({name: 'p', overlays: 'nope'})).toThrow(
      'must be a list of {locale, path} entries',
    );
  });

  it('rejects an unsupported locale and names the product', () => {
    expect(() =>
      loadOverlays({
        name: 'my-api',
        overlays: [{locale: 'it-IT', path: 'overlay-nl.yaml'}],
      }),
    ).toThrow('Unsupported overlay locale "it-IT" for product "my-api"');
  });

  it('rejects duplicate locales', () => {
    expect(() =>
      loadOverlays({
        name: 'my-api',
        overlays: [
          {locale: 'nl-NL', path: 'overlay-nl.yaml'},
          {locale: 'nl', path: 'overlay-nl.yaml'},
        ],
      }),
    ).toThrow('Duplicate overlay locale "nl-NL"');
  });

  it('propagates a structural error from the overlay file', () => {
    expect(() =>
      loadOverlays({
        name: 'my-api',
        overlays: [{locale: 'nl-NL', path: 'overlay-invalid.yaml'}],
      }),
    ).toThrow('missing a "target" JSONPath expression');
  });

  it('resolves overlay paths from a base directory', () => {
    process.chdir(os.tmpdir());
    const result = loadOverlays(
      {
        name: 'p',
        overlays: [{locale: 'nl-NL', path: 'overlay-nl.yaml'}],
      },
      fixtures,
    );
    expect(result[0].locale).toBe('nl-NL');
  });
});
