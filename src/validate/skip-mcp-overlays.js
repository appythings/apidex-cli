function skipNonOpenapiOverlays(entry) {
  const kind = entry && entry.portalType;
  return kind === 'mcp' || kind === 'graphql';
}

function skipMcpOverlays(entry) {
  return skipNonOpenapiOverlays(entry);
}

module.exports = {skipMcpOverlays, skipNonOpenapiOverlays};
