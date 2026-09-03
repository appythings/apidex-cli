const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const {
  addDocToManifest,
  findProduct,
  loadProductDocsForUpload,
  titleFromMarkdown,
} = require('../src/lib/product-docs');
const {runAddDocCli} = require('../src/commands/add-doc');

describe('add-doc', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidex-add-doc-'));
    fs.writeFileSync(
      path.join(dir, 'apis.yaml'),
      yaml.dump({
        categories: [
          {
            name: 'CLI category',
            openapi: 'echo.yaml',
            products: [{name: 'pep-echo', inheritSpec: true}],
          },
        ],
      }),
    );
    fs.writeFileSync(path.join(dir, 'getting-started.md'), '# Getting started\n\nHi.\n');
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('adds a docs tab on a nested inheritSpec product', () => {
    const result = addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'getting-started.md'),
    });
    expect(result.slug).toBe('getting-started');
    const manifest = yaml.load(fs.readFileSync(path.join(dir, 'apis.yaml'), 'utf8'));
    expect(findProduct(manifest, 'pep-echo').docs[0].markdown).toBe(
      'getting-started.md',
    );
  });

  it('requires --update to change an existing slug', () => {
    addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'getting-started.md'),
    });
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'getting-started.md'),
      }),
    ).toThrow(/--update/);
    const again = addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'getting-started.md'),
      title: 'Intro',
      update: true,
    });
    expect(again.title).toBe('Intro');
  });

  it('exits 1 when flags are missing', () => {
    const log = jest.fn();
    const exit = jest.fn();
    runAddDocCli({}, {log, exit});
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.mock.calls[0][0]).toMatch(/Usage:/);
  });

  it('exits 0 on success', () => {
    const log = jest.fn();
    const exit = jest.fn();
    runAddDocCli(
      {
        product: 'pep-echo',
        markdown: path.join(dir, 'getting-started.md'),
        manifest: path.join(dir, 'apis.yaml'),
      },
      {log, exit},
    );
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('uses console.log and process.exit when deps are omitted', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    runAddDocCli({});
    expect(exitSpy).toHaveBeenCalledWith(1);
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('fails when the product or markdown is missing', () => {
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'nope',
        markdownPath: path.join(dir, 'getting-started.md'),
      }),
    ).toThrow(/not found/);
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'missing.md'),
      }),
    ).toThrow(/Markdown file not found/);
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'getting-started.md'),
        slug: 'spec',
      }),
    ).toThrow(/reserved/);
  });

  it('derives title fallback and loads docs for upload', () => {
    expect(titleFromMarkdown('no heading', 'file')).toBe('file');
    expect(loadProductDocsForUpload({name: 'p'}, dir)).toEqual([]);
    expect(() =>
      loadProductDocsForUpload({name: 'p', docs: 'nope'}, dir),
    ).toThrow(/must be a list/);
    fs.writeFileSync(path.join(dir, 'plain.md'), 'plain\n');
    const loaded = loadProductDocsForUpload(
      {
        name: 'p',
        docs: [{markdown: 'plain.md'}],
      },
      dir,
    );
    expect(loaded[0].title).toBe('plain');
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'getting-started.md'),
        slug: '!!!',
      }),
    ).toThrow(/Could not derive a slug/);
  });

  it('loads canonical localized docs for upload', () => {
    fs.writeFileSync(path.join(dir, 'nl.md'), '# Aan de slag\n\nHoi.\n');
    const loaded = loadProductDocsForUpload(
      {
        name: 'p',
        docs: [
          {
            markdown: 'getting-started.md',
            slug: 'getting-started',
            title: 'Getting started',
            locales: [
              {locale: 'nl', markdown: 'nl.md'},
            ],
          },
        ],
      },
      dir,
    );
    expect(loaded[0].locales).toEqual([
      {
        locale: 'nl-NL',
        title: 'Aan de slag',
        markdown: '# Aan de slag\n\nHoi.\n',
      },
    ]);
  });

  it('adds a localized file to an existing docs slug', () => {
    addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'getting-started.md'),
    });
    fs.writeFileSync(path.join(dir, 'nl.md'), '# Aan de slag\n');
    const result = addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'nl.md'),
      slug: 'getting-started',
      locale: 'nl',
    });
    expect(result.locale).toBe('nl-NL');
    const manifest = yaml.load(
      fs.readFileSync(path.join(dir, 'apis.yaml'), 'utf8'),
    );
    expect(findProduct(manifest, 'pep-echo').docs[0].locales).toEqual([
      {locale: 'nl-NL', markdown: 'nl.md', title: 'Aan de slag'},
    ]);
  });

  it('requires --update to replace a localized file', () => {
    addDocToManifest({
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'getting-started.md'),
    });
    fs.writeFileSync(path.join(dir, 'nl.md'), '# Aan de slag\n');
    const args = {
      manifestPath: path.join(dir, 'apis.yaml'),
      productName: 'pep-echo',
      markdownPath: path.join(dir, 'nl.md'),
      slug: 'getting-started',
      locale: 'nl-NL',
    };
    addDocToManifest(args);
    expect(() => addDocToManifest(args)).toThrow(/--update/);
    expect(addDocToManifest({...args, title: 'Start', update: true}).title).toBe(
      'Start',
    );
  });

  it('rejects localized docs without a target slug or default tab', () => {
    fs.writeFileSync(path.join(dir, 'nl.md'), '# Aan de slag\n');
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'nl.md'),
        locale: 'nl-NL',
      }),
    ).toThrow(/--slug/);
    expect(() =>
      addDocToManifest({
        manifestPath: path.join(dir, 'apis.yaml'),
        productName: 'pep-echo',
        markdownPath: path.join(dir, 'nl.md'),
        slug: 'getting-started',
        locale: 'nl-NL',
      }),
    ).toThrow(/default docs tab/);
  });
});
