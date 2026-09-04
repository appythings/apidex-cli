const {
  validateDocument,
  isGraphqlSpecUpload,
  isGraphqlSpecDocument,
} = require('../../src/specs/graphql');

function validEnvelope(overrides = {}) {
  return {
    document: {
      kind: 'graphql',
      schemaVersion: 1,
      info: {title: 'Echo', version: '1.0.0'},
      schema: 'type Query { hello: String }',
      ...(overrides.document || {}),
    },
    execution: {
      endpoint: 'https://example.com/graphql',
      auth: {type: 'none'},
      ...(overrides.execution || {}),
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== 'document' && key !== 'execution'),
    ),
  };
}

describe('graphql adapter', () => {
  it('accepts a v1 upload envelope', () => {
    expect(isGraphqlSpecUpload(validEnvelope())).toBe(true);
    expect(isGraphqlSpecDocument(validEnvelope().document)).toBe(true);
    expect(validateDocument(validEnvelope())).toEqual({ok: true, messages: []});
  });

  it('rejects a bare document, OpenAPI, and MCP', () => {
    expect(isGraphqlSpecUpload(validEnvelope().document)).toBe(false);
    expect(validateDocument(validEnvelope().document).ok).toBe(false);
    expect(validateDocument({openapi: '3.0.0', paths: {}}).ok).toBe(false);
    expect(validateDocument({tools: [{name: 'echo'}]}).ok).toBe(false);
  });

  it('requires title, semver version, and schema', () => {
    expect(
      validateDocument(
        validEnvelope({document: {info: {title: '', version: '1.0.0'}}}),
      ).messages.join('\n'),
    ).toMatch(/title/);
    expect(
      validateDocument(
        validEnvelope({document: {info: {title: 'Echo', version: 'not-semver'}}}),
      ).messages.join('\n'),
    ).toMatch(/semantic version/);
    expect(
      validateDocument(validEnvelope({document: {schema: ''}})).messages.join(
        '\n',
      ),
    ).toMatch(/schema is required/);
  });

  it('rejects invalid SDL and unknown auth or a non-http endpoint', () => {
    expect(
      validateDocument(validEnvelope({document: {schema: 'not graphql'}})).ok,
    ).toBe(false);
    expect(
      validateDocument(
        validEnvelope({execution: {auth: {type: 'basic'}}}),
      ).messages.join('\n'),
    ).toMatch(/none, bearer, or apiKey/);
    expect(
      validateDocument(
        validEnvelope({
          execution: {endpoint: 'ftp://example.com', auth: {type: 'none'}},
        }),
      ).messages.join('\n'),
    ).toMatch(/http or https/);
    expect(
      validateDocument(
        validEnvelope({
          execution: {auth: {type: 'apiKey'}, endpoint: 'https://x.test/g'},
        }),
      ).messages.join('\n'),
    ).toMatch(/headerName/);
  });

  it('rejects oversized schema and initialQuery', () => {
    const hugeSchema = `type Query { hello: String }\n${' '.repeat(1024 * 1024)}`;
    expect(
      validateDocument(validEnvelope({document: {schema: hugeSchema}}))
        .messages.join('\n'),
    ).toMatch(/exceeds maximum size/);
    expect(
      validateDocument(
        validEnvelope({document: {initialQuery: 'q'.repeat(65 * 1024)}}),
      ).messages.join('\n'),
    ).toMatch(/initialQuery exceeds maximum size/);
  });

  it('throws from validate when the envelope is invalid', async () => {
    await expect(
      require('../../src/specs/graphql').validate('/tmp/x.json', {}),
    ).rejects.toThrow(/invalid GraphQL upload/);
  });
});
