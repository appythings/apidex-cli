const path = require('path');
const fs = require('fs-extra');
const {RESERVED_DOC_SLUG, walkProducts} = require('../../lib/product-docs');
const {canonicalizeLocale} = require('../../lib/overlays');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

module.exports = {
  id: 'manifest-paths',
  async run(ctx) {
    const messages = [];
    const baseDir = path.dirname(ctx.manifestPath);
    const manifest = ctx.manifest || {};

    if (Array.isArray(manifest.categories)) {
      for (const category of manifest.categories) {
        if (category && category.docs) {
          messages.push(
            `${category.name}: "docs" belongs on products, not categories`,
          );
        }
        if (category && category.openapi) {
          const specPath = path.resolve(baseDir, category.openapi);
          if (!existsFile(specPath)) {
            messages.push(
              `${category.name}: openapi file not found (${category.openapi})`,
            );
          }
        }
      }
    }

    walkProducts(manifest, product => {
      if (!product) return;
      const owner = product.name || '(unnamed product)';
      if (!product.inheritSpec && product.openapi) {
        const specPath = path.resolve(baseDir, product.openapi);
        if (!existsFile(specPath)) {
          messages.push(`${owner}: openapi file not found (${product.openapi})`);
        }
      }
      if (product.docs && !Array.isArray(product.docs)) {
        messages.push(`${owner}: "docs" must be a list`);
        return;
      }
      for (const doc of product.docs || []) {
        if (!doc || typeof doc.markdown !== 'string' || !doc.markdown.trim()) {
          messages.push(`${owner}: docs entry needs a markdown path`);
          continue;
        }
        const mdPath = path.resolve(baseDir, doc.markdown);
        if (!existsFile(mdPath)) {
          messages.push(`${owner}: docs markdown not found (${doc.markdown})`);
        }
        if (doc.slug === RESERVED_DOC_SLUG) {
          messages.push(`${owner}: docs slug "spec" is reserved`);
        }
        if (doc.locales !== undefined && !Array.isArray(doc.locales)) {
          messages.push(`${owner} ${doc.markdown}: "locales" must be a list`);
          continue;
        }
        const seenLocales = new Set();
        for (const translation of doc.locales || []) {
          if (!translation || typeof translation.locale !== 'string') {
            messages.push(
              `${owner} ${doc.markdown}: localized docs entry needs a locale`,
            );
          }
          const locale = canonicalizeLocale(translation?.locale);
          if (!locale) {
            messages.push(
              `${owner} ${doc.markdown}: unsupported locale "${translation?.locale}"`,
            );
          } else if (locale === 'en-GB') {
            messages.push(
              `${owner} ${doc.markdown}: default locale "en-GB" belongs in the top-level markdown`,
            );
          } else if (seenLocales.has(locale)) {
            messages.push(
              `${owner} ${doc.markdown}: duplicate locale "${locale}"`,
            );
          } else {
            seenLocales.add(locale);
          }
          if (
            !translation ||
            typeof translation.markdown !== 'string' ||
            !translation.markdown.trim()
          ) {
            messages.push(
              `${owner} ${doc.markdown}: localized docs entry needs a markdown path`,
            );
            continue;
          }
          if (!existsFile(path.resolve(baseDir, translation.markdown))) {
            messages.push(
              `${owner}: localized markdown not found (${translation.markdown})`,
            );
          }
        }
      }
    });

    return {ok: messages.length === 0, messages};
  },
};
