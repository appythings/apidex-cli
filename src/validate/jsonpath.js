const {JSONPath} = require('jsonpath-plus');

/**
 * Overlay JSONPath evaluation. Unmatched targets are a silent no-op in the
 * portal applier, so validate must fail them.
 */
function nodesMatching(spec, target) {
  if (!spec || typeof target !== 'string' || target.trim() === '') {
    return [];
  }
  try {
    const result = JSONPath({path: target, json: spec, wrap: true});
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

function targetMatches(spec, target) {
  return nodesMatching(spec, target).length > 0;
}

module.exports = {nodesMatching, targetMatches};
