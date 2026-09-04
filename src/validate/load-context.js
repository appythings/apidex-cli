const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const {readOverlayFile} = require('../lib/overlays');

function readSpecFile(specPath) {
  const raw = fs.readFileSync(specPath, 'utf8');
  if (/\.(yml|yaml)$/.test(specPath)) {
    return yaml.load(raw);
  }
  if (specPath.endsWith('.json')) {
    return JSON.parse(raw);
  }
  throw new Error(`Spec ${specPath} must be yaml/yml or json`);
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
      entries.push({
        kind: 'product',
        name: product.name,
        specPath: product.openapi
          ? path.resolve(baseDir, product.openapi)
          : undefined,
        spec: undefined,
        specError: undefined,
        inheritSpec: Boolean(product.inheritSpec),
        overlays: loadOverlayEntries(product, baseDir),
      });
    }
  }
  if (Array.isArray(manifest.categories)) {
    for (const category of manifest.categories) {
      entries.push({
        kind: 'category',
        name: category.name,
        specPath: category.openapi
          ? path.resolve(baseDir, category.openapi)
          : undefined,
        spec: undefined,
        specError: undefined,
        inheritSpec: false,
        overlays: loadOverlayEntries(category, baseDir),
      });
      if (Array.isArray(category.products)) {
        for (const product of category.products) {
          entries.push({
            kind: 'product',
            name: product.name,
            specPath: product.openapi
              ? path.resolve(baseDir, product.openapi)
              : undefined,
            spec: undefined,
            specError: undefined,
            inheritSpec: Boolean(product.inheritSpec),
            overlays: loadOverlayEntries(product, baseDir),
          });
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
      entry.spec = readSpecFile(entry.specPath);
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
