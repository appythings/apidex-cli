const path = require('path');
const fs = require('fs-extra');
const {
  extractMarkdownHrefs,
  isSkippableHref,
  walkProducts,
} = require('../../lib/product-docs');

module.exports = {
  id: 'markdown-links',
  async run(ctx) {
    const messages = [];
    const baseDir = path.dirname(ctx.manifestPath);
    const checkMarkdown = (product, markdownPath) => {
      if (typeof markdownPath !== 'string') {
        return;
      }
      const mdPath = path.resolve(baseDir, markdownPath);
      let markdown;
      try {
        markdown = fs.readFileSync(mdPath, 'utf8');
      } catch {
        return;
      }
      const hrefs = extractMarkdownHrefs(markdown);
      for (const href of hrefs) {
        if (!href) {
          messages.push(
            `${product.name} ${markdownPath}: empty markdown link`,
          );
          continue;
        }
        if (isSkippableHref(href)) {
          continue;
        }
        const withoutHash = href.split('#')[0];
        if (
          withoutHash &&
          !fs.existsSync(path.resolve(path.dirname(mdPath), withoutHash))
        ) {
          messages.push(
            `${product.name} ${markdownPath}: broken relative link (${href})`,
          );
        }
      }
    };
    walkProducts(ctx.manifest || {}, product => {
      if (!product || !Array.isArray(product.docs)) {
        return;
      }
      for (const doc of product.docs) {
        if (!doc || doc.type === 'overview') {
          continue;
        }
        checkMarkdown(product, doc.markdown);
        if (Array.isArray(doc.locales)) {
          for (const translation of doc.locales) {
            if (translation) {
              checkMarkdown(product, translation.markdown);
            }
          }
        }
      }
    });
    return {ok: messages.length === 0, messages};
  },
};
