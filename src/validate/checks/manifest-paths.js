const path = require('path');
const fs = require('fs-extra');
const {
  deriveDocSlug,
  isReservedDocSlug,
  walkProducts,
} = require('../../lib/product-docs');
const {canonicalizeLocale} = require('../../lib/overlays');
const {specField, specPath} = require('../../lib/spec-ref');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function checkSpecRef(owner, entry, baseDir, messages) {
  const ref = specField(entry);
  if (ref.error) {
    messages.push(ref.error);
    return;
  }
  if (!ref.value) {
    return;
  }
  const resolved = specPath(entry, baseDir);
  if (!existsFile(resolved.path)) {
    messages.push(`${owner}: ${ref.field} file not found (${ref.value})`);
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
        if (category) {
          checkSpecRef(category.name, category, baseDir, messages);
        }
      }
    }

    walkProducts(manifest, product => {
      if (!product) return;
      const owner = product.name || '(unnamed product)';
      if (
        product.portalType !== undefined &&
        product.portalType !== 'api' &&
        product.portalType !== 'mcp'
      ) {
        messages.push(`${owner}: portalType must be "api" or "mcp"`);
      }
      if (!product.inheritSpec) {
        checkSpecRef(owner, product, baseDir, messages);
      }
      if (product.docs && !Array.isArray(product.docs)) {
        messages.push(`${owner}: "docs" must be a list`);
        return;
      }
      let overviewCount = 0;
      for (const doc of product.docs || []) {
        if (doc && doc.type === 'overview') {
          overviewCount += 1;
          if (Object.keys(doc).some(key => key !== 'type')) {
            messages.push(
              `${owner}: overview entry must only declare type; it must not declare any other properties`,
            );
          }
          continue;
        }
        if (doc && doc.type !== undefined && doc.type !== 'doc') {
          messages.push(
            `${owner}: unsupported docs entry type "${doc.type}"`,
          );
          continue;
        }
        if (!doc || typeof doc.markdown !== 'string' || !doc.markdown.trim()) {
          messages.push(`${owner}: docs entry needs a markdown path`);
          continue;
        }
        const mdPath = path.resolve(baseDir, doc.markdown);
        if (!existsFile(mdPath)) {
          messages.push(`${owner}: docs markdown not found (${doc.markdown})`);
        }
        const resolvedSlug = deriveDocSlug(doc.markdown, doc.slug);
        if (isReservedDocSlug(resolvedSlug)) {
          messages.push(`${owner}: docs slug "${resolvedSlug}" is reserved`);
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
      if (overviewCount > 1) {
        messages.push(`${owner}: duplicate overview docs entry`);
      }
    });

    return {ok: messages.length === 0, messages};
  },
};
