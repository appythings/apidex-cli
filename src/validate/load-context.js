const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const {readOverlayFile} = require('../lib/overlays');
const {specPath, portalType} = require('../lib/spec-ref');
const {parseSpecFile} = require('../lib/spec-file');

function toEntry(owner, kind, inheritSpec, baseDir) {
  const ref = specPath(owner, baseDir);
  return {
    kind,
    name: owner && owner.name,
    specPath: ref.path,
    specField: ref.field,
    specRefError: ref.error,
    spec: undefined,
    specError: undefined,
    inheritSpec: Boolean(inheritSpec),
    portalType: portalType(owner),
    overlays: loadOverlayEntries(owner, baseDir),
  };
}

function loadOverlayEntries(owner, baseDir) {
  const declared = owner && owner.overlays;
  if (declared === undefined || declared === null) {
    return [];
  }
  if (!Array.isArray(declared)) {
    throw new Error(
      `"overlays" for "${owner.name}" must be a list of {locale, path} entries`,
    );
  }
  return declared.map((entry, index) => {
    const overlayPath =
      entry && typeof entry.path === 'string'
        ? path.resolve(baseDir, entry.path)
        : '';
    const item = {
      locale: entry && entry.locale,
      path: overlayPath || (entry && entry.path),
      overlay: undefined,
      error: undefined,
    };
    try {
      if (!overlayPath) {
        throw new Error(
          `Overlay entry ${index} for "${owner.name}" needs a "path"`,
        );
      }
      item.overlay = readOverlayFile(overlayPath);
    } catch (error) {
      item.error = error instanceof Error ? error.message : String(error);
    }
    return item;
  });
}

function collectEntries(manifest, baseDir) {
  const entries = [];
  if (Array.isArray(manifest.products)) {
    for (const product of manifest.products) {
      if (!product) continue;
      entries.push(
        toEntry(product, 'product', Boolean(product.inheritSpec), baseDir),
      );
    }
  }
  if (Array.isArray(manifest.categories)) {
    for (const category of manifest.categories) {
      if (!category) continue;
      entries.push(toEntry(category, 'category', false, baseDir));
      if (Array.isArray(category.products)) {
        for (const product of category.products) {
          if (!product) continue;
          entries.push(
            toEntry(
              product,
              'product',
              Boolean(product.inheritSpec),
              baseDir,
            ),
          );
        }
      }
    }
  }
  return entries;
}

function loadContext(options) {
  const manifestPath = path.resolve(options.manifestPath);
  const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8')) || {};
  const baseDir = path.dirname(manifestPath);
  const entries = collectEntries(manifest, baseDir);
  for (const entry of entries) {
    if (entry.inheritSpec || !entry.specPath) continue;
    try {
      entry.spec = parseSpecFile(entry.specPath);
    } catch (error) {
      entry.specError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    manifestPath,
    manifest,
    options,
    entries,
  };
}

module.exports = {
  loadContext,
};
