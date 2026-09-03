const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const {canonicalizeLocale} = require('./overlays');

const RESERVED_DOC_SLUG = 'spec';
const RESERVED_DOC_SLUGS = new Set([RESERVED_DOC_SLUG, 'overview']);

function isReservedDocSlug(slug) {
  return RESERVED_DOC_SLUGS.has(slug);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
}

function deriveDocSlug(markdownPath, explicitSlug) {
  const fileBase = path.basename(markdownPath, path.extname(markdownPath));
  return slugify(explicitSlug || fileBase);
}

function walkProducts(manifest, visit) {
  if (Array.isArray(manifest.products)) {
    for (const product of manifest.products) {
      visit(product, null);
    }
  }
  if (Array.isArray(manifest.categories)) {
    for (const category of manifest.categories) {
      if (category && Array.isArray(category.products)) {
        for (const product of category.products) {
          visit(product, category);
        }
      }
    }
  }
}

function findProduct(manifest, name) {
  let found;
  walkProducts(manifest, product => {
    if (product && product.name === name) {
      found = product;
    }
  });
  return found;
}

function titleFromMarkdown(markdown, fallback) {
  const match = String(markdown || '').match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  return fallback;
}

function relativeToManifest(manifestPath, filePath) {
  const baseDir = path.dirname(path.resolve(manifestPath));
  const abs = path.resolve(filePath);
  return path.relative(baseDir, abs).split(path.sep).join('/');
}

function addDocToManifest({
  manifestPath,
  productName,
  markdownPath,
  title,
  slug,
  locale,
  update,
}) {
  if (!productName || !markdownPath || !manifestPath) {
    throw new Error(
      'Usage: apidex-cli manifest add-doc <product> <markdown> --manifest <apis.yaml> [--title] [--slug] [--locale] [--update]',
    );
  }
  const absManifest = path.resolve(manifestPath);
  const raw = fs.readFileSync(absManifest, 'utf8');
  const manifest = yaml.load(raw) || {};
  const product = findProduct(manifest, productName);
  if (!product) {
    throw new Error(`Product "${productName}" not found in ${manifestPath}`);
  }
  const absMd = path.resolve(markdownPath);
  if (!fs.existsSync(absMd)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }
  const markdown = fs.readFileSync(absMd, 'utf8');
  const fileBase = path.basename(absMd, path.extname(absMd));
  if (locale && !slug) {
    throw new Error('--locale requires --slug to select the default docs tab');
  }
  const resolvedSlug = deriveDocSlug(absMd, slug);
  if (!resolvedSlug || isReservedDocSlug(resolvedSlug)) {
    throw new Error(
      isReservedDocSlug(resolvedSlug)
        ? `slug "${resolvedSlug}" is reserved`
        : 'Could not derive a slug; pass --slug',
    );
  }
  const resolvedTitle =
    (typeof title === 'string' && title.trim()) ||
    titleFromMarkdown(markdown, fileBase);
  const rel = relativeToManifest(absManifest, absMd);
  if (!Array.isArray(product.docs)) {
    product.docs = [];
  }
  const existing = product.docs.find(entry => entry && entry.slug === resolvedSlug);
  if (locale) {
    const resolvedLocale = canonicalizeLocale(locale);
    if (!resolvedLocale || resolvedLocale === 'en-GB') {
      throw new Error(
        resolvedLocale === 'en-GB'
          ? 'Locale "en-GB" belongs in the default docs tab'
          : `Unsupported locale "${locale}"`,
      );
    }
    if (!existing) {
      throw new Error(
        `Add the default docs tab "${resolvedSlug}" before adding locale "${resolvedLocale}"`,
      );
    }
    if (!Array.isArray(existing.locales)) {
      existing.locales = [];
    }
    const translated = existing.locales.find(
      entry =>
        entry && canonicalizeLocale(entry.locale) === resolvedLocale,
    );
    if (translated && !update) {
      throw new Error(
        `Locale "${resolvedLocale}" already exists on doc slug "${resolvedSlug}". Pass --update to change it.`,
      );
    }
    const localizedEntry = translated || {};
    localizedEntry.locale = resolvedLocale;
    localizedEntry.markdown = rel;
    localizedEntry.title = resolvedTitle;
    if (!translated) {
      existing.locales.push(localizedEntry);
    }
    fs.writeFileSync(absManifest, yaml.dump(manifest, {lineWidth: 120}));
    return {
      product: productName,
      slug: resolvedSlug,
      locale: resolvedLocale,
      title: resolvedTitle,
      markdown: rel,
    };
  }
  if (existing && !update) {
    throw new Error(
      `Doc slug "${resolvedSlug}" already exists on ${productName}. Pass --update to change it.`,
    );
  }
  if (existing) {
    existing.markdown = rel;
    existing.title = resolvedTitle;
    existing.slug = resolvedSlug;
  } else {
    product.docs.push({
      markdown: rel,
      title: resolvedTitle,
      slug: resolvedSlug,
    });
  }
  fs.writeFileSync(absManifest, yaml.dump(manifest, {lineWidth: 120}));
  return {product: productName, slug: resolvedSlug, title: resolvedTitle, markdown: rel};
}

function extractMarkdownHrefs(markdown) {
  const hrefs = [];
  const re = /!?\[([^\]]*)\]\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(markdown))) {
    hrefs.push(match[2].trim());
  }
  return hrefs;
}

function isSkippableHref(href) {
  if (/^(https?:|mailto:|data:)/i.test(href)) {
    return true;
  }
  if (href.startsWith('#')) {
    return true;
  }
  return false;
}

function loadProductDocsForUpload(product, baseDir) {
  const declared = product && product.docs;
  if (!declared) {
    return [];
  }
  if (!Array.isArray(declared)) {
    throw new Error(`"docs" for "${product.name}" must be a list`);
  }
  return declared.map(entry => {
    if (entry && entry.type === 'overview') {
      return {type: 'overview'};
    }
    const mdPath = path.resolve(baseDir, entry.markdown);
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const fileBase = path.basename(mdPath, path.extname(mdPath));
    const locales = (entry.locales || []).map(translation => {
      const locale = canonicalizeLocale(translation.locale);
      if (!locale || locale === 'en-GB') {
        throw new Error(
          `Invalid localized docs locale "${translation.locale}" for "${product.name}"`,
        );
      }
      const translatedPath = path.resolve(baseDir, translation.markdown);
      const translatedMarkdown = fs.readFileSync(translatedPath, 'utf8');
      const translatedBase = path.basename(
        translatedPath,
        path.extname(translatedPath),
      );
      return {
        locale,
        title:
          translation.title ||
          titleFromMarkdown(translatedMarkdown, translatedBase),
        markdown: translatedMarkdown,
      };
    });
    return {
      slug: deriveDocSlug(mdPath, entry.slug),
      title: entry.title || titleFromMarkdown(markdown, fileBase),
      markdown,
      ...(locales.length > 0 ? {locales} : {}),
    };
  });
}

module.exports = {
  RESERVED_DOC_SLUG,
  isReservedDocSlug,
  slugify,
  deriveDocSlug,
  walkProducts,
  findProduct,
  addDocToManifest,
  extractMarkdownHrefs,
  isSkippableHref,
  loadProductDocsForUpload,
  titleFromMarkdown,
};
