const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const yaml = require('js-yaml');
const {loadContext} = require('../../../src/validate/load-context');
const manifestPaths = require('../../../src/validate/checks/manifest-paths');
const markdownLinks = require('../../../src/validate/checks/markdown-links');

describe('manifest-paths and markdown-links', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidex-docs-val-'));
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  function writeManifest(doc) {
    const manifestPath = path.join(dir, 'apis.yaml');
    fs.writeFileSync(manifestPath, yaml.dump(doc));
    return loadContext({manifestPath, requireLocales: []});
  }

  it('fails when docs markdown is missing', async () => {
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [{markdown: 'missing.md', slug: 'missing'}],
        },
      ],
    });
    const result = await manifestPaths.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/docs markdown not found/);
  });

  it('fails reserved slug spec and category docs', async () => {
    fs.writeFileSync(path.join(dir, 'ok.md'), '# Ok\n');
    const ctx = writeManifest({
      categories: [
        {
          name: 'cat',
          docs: [{markdown: 'ok.md'}],
          products: [
            {
              name: 'p',
              inheritSpec: true,
              docs: [{markdown: 'ok.md', slug: 'spec'}],
            },
          ],
        },
      ],
    });
    const result = await manifestPaths.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/belongs on products/);
    expect(result.messages.join('\n')).toMatch(/reserved/);
  });

  it('fails broken relative markdown links and empty hrefs', async () => {
    fs.writeFileSync(
      path.join(dir, 'page.md'),
      '[x]()\n[ok](https://example.com)\n[bad](./nope.md)\n',
    );
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [{markdown: 'page.md', slug: 'page'}],
        },
      ],
    });
    const result = await markdownLinks.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/empty markdown link/);
    expect(result.messages.join('\n')).toMatch(/broken relative link/);
  });

  it('accepts relative links that exist', async () => {
    fs.writeFileSync(path.join(dir, 'page.md'), '[faq](./faq.md)\n');
    fs.writeFileSync(path.join(dir, 'faq.md'), '# FAQ\n');
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [{markdown: 'page.md', slug: 'page'}],
        },
      ],
    });
    expect((await markdownLinks.run(ctx)).ok).toBe(true);
    expect((await manifestPaths.run(ctx)).ok).toBe(true);
  });

  it('validates localized doc files and their relative links', async () => {
    fs.writeFileSync(path.join(dir, 'page.md'), '# Page\n');
    fs.mkdirSync(path.join(dir, 'nl'));
    fs.writeFileSync(path.join(dir, 'nl', 'page.md'), '[stuk](./missing.md)\n');
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [
            {
              markdown: 'page.md',
              slug: 'page',
              locales: [
                {locale: 'nl', markdown: 'nl/page.md'},
                {locale: 'nl-NL', markdown: 'missing-nl.md'},
                {locale: 'en-GB', markdown: 'page.md'},
                {locale: 'xx-ZZ', markdown: 'page.md'},
              ],
            },
          ],
        },
      ],
    });
    const paths = await manifestPaths.run(ctx);
    expect(paths.messages.join('\n')).toMatch(/duplicate locale "nl-NL"/);
    expect(paths.messages.join('\n')).toMatch(/default locale "en-GB"/);
    expect(paths.messages.join('\n')).toMatch(/unsupported locale "xx-ZZ"/);
    expect(paths.messages.join('\n')).toMatch(/localized markdown not found/);
    const links = await markdownLinks.run(ctx);
    expect(links.messages.join('\n')).toMatch(/broken relative link/);
    expect(links.messages.join('\n')).toMatch(/nl\/page\.md/);
  });

  it('rejects malformed localized doc declarations', async () => {
    fs.writeFileSync(path.join(dir, 'page.md'), '# Page\n');
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [
            null,
            {markdown: 'page.md', slug: 'a', locales: 'nl'},
            {
              markdown: 'page.md',
              slug: 'b',
              locales: [null, {locale: 'nl-NL'}],
            },
          ],
        },
      ],
    });
    const result = await manifestPaths.run(ctx);
    expect(result.messages.join('\n')).toMatch(/"locales" must be a list/);
    expect(result.messages.join('\n')).toMatch(/localized docs entry needs a locale/);
    expect(result.messages.join('\n')).toMatch(/localized docs entry needs a markdown path/);
    expect((await markdownLinks.run(ctx)).ok).toBe(true);
  });

  it('fails missing openapi on non-inheritSpec products', async () => {
    const ctx = writeManifest({
      products: [{name: 'pet-store', openapi: 'nope.yaml'}],
    });
    const result = await manifestPaths.run(ctx);
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toMatch(/openapi file not found/);
  });

  it('fails missing category openapi, non-list docs, and empty markdown', async () => {
    const ctx = writeManifest({
      categories: [
        {
          name: 'cat',
          openapi: 'gone.yaml',
          products: [
            {name: 'p1', inheritSpec: true, docs: 'nope'},
            {name: 'p2', inheritSpec: true, docs: [{slug: 'x'}]},
          ],
        },
      ],
    });
    const result = await manifestPaths.run(ctx);
    expect(result.messages.join('\n')).toMatch(/openapi file not found/);
    expect(result.messages.join('\n')).toMatch(/must be a list/);
    expect(result.messages.join('\n')).toMatch(/needs a markdown path/);
  });

  it('accepts an existing category openapi and empty manifest', async () => {
    fs.writeFileSync(path.join(dir, 'echo.yaml'), 'openapi: "3.0.0"\n');
    const ctx = writeManifest({
      categories: [
        {
          name: 'cat',
          openapi: 'echo.yaml',
          products: [{name: 'p', inheritSpec: true}],
        },
      ],
    });
    expect((await manifestPaths.run(ctx)).ok).toBe(true);
    expect(
      (await manifestPaths.run({manifestPath: path.join(dir, 'apis.yaml')})).ok,
    ).toBe(true);
    expect(
      (
        await manifestPaths.run({
          manifestPath: path.join(dir, 'apis.yaml'),
          manifest: {categories: [null], products: [null]},
        })
      ).ok,
    ).toBe(true);
    const unnamed = await manifestPaths.run({
      manifestPath: path.join(dir, 'apis.yaml'),
      manifest: {products: [{openapi: 'nope.yaml'}]},
    });
    expect(unnamed.messages.join('\n')).toMatch(/unnamed product/);
  });

  it('skips unreadable markdown and hash-only links', async () => {
    fs.writeFileSync(path.join(dir, 'page.md'), '[here](#section)\n');
    const ctx = writeManifest({
      products: [
        {
          name: 'pet-store',
          inheritSpec: true,
          docs: [
            {markdown: 'page.md', slug: 'page'},
            {slug: 'no-path'},
            {markdown: 'missing.md', slug: 'miss'},
          ],
        },
      ],
    });
    const result = await markdownLinks.run(ctx);
    expect(result.ok).toBe(true);
  });
});
