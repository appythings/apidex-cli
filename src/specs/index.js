const openapi = require('./openapi');
const mcp = require('./mcp');
const graphql = require('./graphql');

function getAdapter(kind) {
  if (kind === 'mcp') {
    return mcp;
  }
  if (kind === 'graphql') {
    return graphql;
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
  graphql,
};
