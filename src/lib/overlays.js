const yaml = require('js-yaml');
const fs = require('fs-extra');

/**
 * Portal UI locales that can carry a spec translation overlay.
 * Must stay in sync with SUPPORTED_SPEC_LOCALES in the portal backend.
 */
const SUPPORTED_LOCALES = [
  'en-GB',
  'nl-NL',
  'de-DE',
  'fr-FR',
  'es-ES',
  'se-SE',
  'ar-SA',
];

function normalize(locale) {
  return String(locale).replace(/_/g, '-').toLowerCase();
}

/**
 * Resolves a manifest locale to its canonical portal tag. Accepts an exact tag
 * (`nl-NL`), a differently-cased one (`NL-nl`), or a bare primary subtag (`nl`).
 */
function canonicalizeLocale(locale) {
  if (typeof locale !== 'string' || locale.trim() === '') {
    return undefined;
  }
  const wanted = normalize(locale);
  const exact = SUPPORTED_LOCALES.find(
    supported => normalize(supported) === wanted,
  );
  if (exact) {
    return exact;
  }
  const primary = wanted.split('-')[0];
  return SUPPORTED_LOCALES.find(
    supported => normalize(supported).split('-')[0] === primary,
  );
}

function readOverlayFile(overlayPath) {
  if (typeof overlayPath !== 'string' || overlayPath.trim() === '') {
    throw new Error('Overlay entries need a "path" pointing at the file');
  }
  if (/\.(yml|yaml)$/.test(overlayPath)) {
    return yaml.load(fs.readFileSync(overlayPath, 'utf8'));
  }
  if (overlayPath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  }
  throw new Error(`Overlay ${overlayPath} must be either yaml/yml or json`);
}

/**
 * Structural validation, mirroring the portal backend so authors get the error
 * at upload time rather than on a failed request.
 */
function validateOverlayDocument(overlay, where) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    throw new Error(
      `Overlay ${where} must be an object containing "overlay", "info" and "actions"`,
    );
  }
  if (typeof overlay.overlay !== 'string') {
    throw new Error(
      `Overlay ${where} is missing the "overlay" version field (e.g. "1.1.0")`,
    );
  }
  if (!/^1\.\d+\.\d+$/.test(overlay.overlay)) {
    throw new Error(
      `Overlay ${where} declares unsupported version "${overlay.overlay}". Supported: Overlay 1.x.y`,
    );
  }
  if (!Array.isArray(overlay.actions) || overlay.actions.length === 0) {
    throw new Error(`Overlay ${where} must contain a non-empty "actions" array`);
  }
  overlay.actions.forEach((action, index) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      throw new Error(`Overlay ${where} action ${index} must be an object`);
    }
    if (typeof action.target !== 'string' || action.target.trim() === '') {
      throw new Error(
        `Overlay ${where} action ${index} is missing a "target" JSONPath expression`,
      );
    }
    if (action.remove !== true && action.update === undefined) {
      throw new Error(
        `Overlay ${where} action ${index} must declare either "update" or "remove"`,
      );
    }
  });
}

/**
 * Reads and validates the `overlays` entries declared on a manifest product.
 *
 * @returns {Array<{locale: string, overlay: object}>} empty when none declared
 */
function loadOverlays(product) {
  const declared = product && product.overlays;
  if (declared === undefined || declared === null) {
    return [];
  }
  if (!Array.isArray(declared)) {
    throw new Error(
      `"overlays" for product "${product.name}" must be a list of {locale, path} entries`,
    );
  }

  const seen = new Set();
  return declared.map(entry => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(
        `"overlays" for product "${product.name}" must be a list of {locale, path} entries`,
      );
    }

    const locale = canonicalizeLocale(entry.locale);
    if (!locale) {
      throw new Error(
        `Unsupported overlay locale "${entry.locale}" for product "${product.name}". Supported locales: ${SUPPORTED_LOCALES.join(', ')}`,
      );
    }
    if (seen.has(locale)) {
      throw new Error(
        `Duplicate overlay locale "${locale}" for product "${product.name}"`,
      );
    }
    seen.add(locale);

    const overlay = readOverlayFile(entry.path);
    validateOverlayDocument(overlay, `${entry.path} (${locale})`);

    return {locale, overlay};
  });
}

module.exports = {
  SUPPORTED_LOCALES,
  canonicalizeLocale,
  loadOverlays,
  readOverlayFile,
  validateOverlayDocument,
};
