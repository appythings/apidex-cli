const path = require('path');
const {validate} = require('../../src/specs/openapi');

describe('openapi adapter', () => {
  it('rejects an MCP tools catalogue on the api portal type', async () => {
    await expect(
      validate('/tmp/unused.yaml', {tools: [{name: 'echo'}]}),
    ).rejects.toThrow(/MCP tools catalogue/);
  });

  it('rejects a GraphQL envelope on the api portal type', async () => {
    await expect(
      validate('/tmp/unused.json', {
        document: {kind: 'graphql', schemaVersion: 1},
      }),
    ).rejects.toThrow(/GraphQL upload envelope/);
  });

  it('validates a real OpenAPI file', async () => {
    const specPath = path.join(__dirname, '../fixtures/validate/spec.yaml');
    const document = require('../../src/lib/spec-file').parseSpecFile(specPath);
    await expect(validate(specPath, document)).resolves.toEqual(document);
  });
});
