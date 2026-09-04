const SwaggerParser = require('@apidevtools/swagger-parser');
const {isMcpToolsSpecDocument} = require('./mcp');
const {isGraphqlSpecUpload} = require('./graphql');

async function validate(specPath, document) {
  if (isMcpToolsSpecDocument(document)) {
    throw new Error(
      'spec looks like an MCP tools catalogue (portalType is api)',
    );
  }
  if (isGraphqlSpecUpload(document)) {
    throw new Error(
      'spec looks like a GraphQL upload envelope (portalType is api)',
    );
  }
  await SwaggerParser.validate(specPath);
  return document;
}

module.exports = {
  id: 'openapi',
  validate,
};
