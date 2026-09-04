function skipMcpOverlays(entry) {
  return Boolean(entry && entry.portalType === 'mcp');
}

module.exports = {skipMcpOverlays};
