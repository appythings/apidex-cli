const path = require('path');

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function specField(entry) {
  const spec = trimString(entry && entry.spec);
  const openapi = trimString(entry && entry.openapi);
  if (spec && openapi) {
    const owner = (entry && entry.name) || 'entry';
    return {
      field: undefined,
      value: undefined,
      error: `${owner}: declare spec or openapi, not both`,
    };
  }
  if (spec) {
    return {field: 'spec', value: spec};
  }
  if (openapi) {
    return {field: 'openapi', value: openapi};
  }
  return {field: undefined, value: undefined};
}

function specPath(entry, baseDir) {
  const ref = specField(entry);
  if (ref.error || !ref.value) {
    return ref;
  }
  return {
    ...ref,
    path: path.resolve(baseDir, ref.value),
  };
}

function portalType(entry) {
  const value = entry && entry.portalType;
  if (value === undefined || value === null || value === '') {
    return 'api';
  }
  return value;
}

function hasSpecRef(entry) {
  const ref = specField(entry);
  return !ref.error && Boolean(ref.value);
}

function inheritsCategorySpec(product) {
  return !product || product.inheritSpec !== false;
}

module.exports = {
  specField,
  specPath,
  portalType,
  hasSpecRef,
  inheritsCategorySpec,
};
