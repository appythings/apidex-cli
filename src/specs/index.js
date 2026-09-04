const openapi = require('./openapi');
const mcp = require('./mcp');

function getAdapter(kind) {
  if (kind === 'mcp') {
    return mcp;
  }
  if (kind === 'graphql') {
    throw new Error('portalType "graphql" is not supported yet');
  }
  if (kind === 'api' || kind === undefined || kind === null || kind === '') {
    return openapi;
  }
  throw new Error(`unknown portalType "${kind}"`);
}

module.exports = {
  getAdapter,
  openapi,
  mcp,
};
