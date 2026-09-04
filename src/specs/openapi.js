const SwaggerParser = require('@apidevtools/swagger-parser');
const {isMcpToolsSpecDocument} = require('./mcp');

async function validate(specPath, document) {
  if (isMcpToolsSpecDocument(document)) {
    throw new Error(
      'spec looks like an MCP tools catalogue (portalType is api)',
    );
  }
  await SwaggerParser.validate(specPath);
  return document;
}

module.exports = {
  id: 'openapi',
  validate,
};
