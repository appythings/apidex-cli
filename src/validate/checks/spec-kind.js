const path = require('path');
const {walkProducts} = require('../../lib/product-docs');
const {
  specField,
  specPath,
  portalType,
  inheritsCategorySpec,
} = require('../../lib/spec-ref');
const {getAdapter} = require('../../specs');
const {isMcpToolsSpecDocument} = require('../../specs/mcp');

function overlaysDeclared(entry) {
  return Array.isArray(entry && entry.overlays) && entry.overlays.length > 0;
}

function findLoaded(ctx, kind, name) {
  return (ctx.entries || []).find(
    entry => entry.kind === kind && entry.name === name,
  );
}

async function validateLoaded(owner, kind, specFilePath, loaded) {
  if (kind === 'graphql') {
    return [`${owner}: portalType "graphql" is not supported yet`];
  }
  if (kind !== 'api' && kind !== 'mcp') {
    return [];
  }
  if (loaded && loaded.specError) {
    return [`${owner}: ${loaded.specError}`];
  }
  const document = loaded && loaded.spec;
  if (!document || !specFilePath) {
    return [];
  }
  if (kind === 'mcp' && !isMcpToolsSpecDocument(document)) {
    return [
      `${owner}: spec is not an MCP tools catalogue (portalType is mcp)`,
    ];
  }
  if (kind === 'api' && isMcpToolsSpecDocument(document)) {
    return [
      `${owner}: spec looks like an MCP tools catalogue (portalType is api)`,
    ];
  }
  try {
    await getAdapter(kind).validate(specFilePath, document);
  } catch (error) {
    return [
      `${owner}: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  return [];
}

module.exports = {
  id: 'spec-kind',
  async run(ctx) {
    const messages = [];
    const baseDir = path.dirname(ctx.manifestPath);
    const manifest = ctx.manifest || {};

    if (Array.isArray(manifest.categories)) {
      for (const category of manifest.categories) {
        if (!category) continue;
        const ref = specField(category);
        if (ref.error) {
          messages.push(ref.error);
        }
        const inheritors = (category.products || []).filter(
          product => product && inheritsCategorySpec(product),
        );
        const inheritTypes = [
          ...new Set(inheritors.map(product => portalType(product))),
        ];
        if (inheritTypes.length > 1) {
          messages.push(
            `${category.name}: inheriting products must share one portalType (found ${inheritTypes.join(', ')})`,
          );
        }
        const categoryKind = inheritTypes[0] || portalType(category);
        if (overlaysDeclared(category) && categoryKind === 'mcp') {
          messages.push(
            `${category.name}: overlays are not supported for portalType mcp`,
          );
        }
        if (inheritors.length > 0 && !ref.value && !ref.error) {
          for (const product of inheritors) {
            messages.push(
              `${product.name}: inheritSpec requires category "${category.name}" to declare a spec of portalType ${portalType(product)}`,
            );
          }
        }
        if (ref.value && !ref.error) {
          const resolved = specPath(category, baseDir);
          messages.push(
            ...(await validateLoaded(
              category.name,
              categoryKind,
              resolved.path,
              findLoaded(ctx, 'category', category.name),
            )),
          );
        }
      }
    }

    walkProducts(manifest, (product, category) => {
      if (!product) return;
      const owner = product.name || '(unnamed product)';
      const ref = specField(product);
      if (ref.error) {
        messages.push(ref.error);
      }
      const kind = portalType(product);
      if (overlaysDeclared(product) && kind === 'mcp') {
        messages.push(
          `${owner}: overlays are not supported for portalType mcp`,
        );
      }
    });

    const productTasks = [];
    walkProducts(manifest, (product, category) => {
      if (!product) return;
      const inheriting = Boolean(category) && inheritsCategorySpec(product);
      if (inheriting) return;
      const ref = specField(product);
      if (!ref.value || ref.error) return;
      const resolved = specPath(product, baseDir);
      productTasks.push(
        validateLoaded(
          product.name || '(unnamed product)',
          portalType(product),
          resolved.path,
          findLoaded(ctx, 'product', product.name),
        ),
      );
    });
    for (const extra of await Promise.all(productTasks)) {
      messages.push(...extra);
    }

    return {ok: messages.length === 0, messages};
  },
};
