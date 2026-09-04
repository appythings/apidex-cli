const {validateDocument, isMcpToolsSpecDocument} = require('../../src/specs/mcp');

function validMcp(overrides = {}) {
  return {
    info: {title: 'Echo MCP', version: '1.0.0'},
    serverUrl: 'https://api.example.com/mcp',
    transport: 'Streamable HTTP',
    tools: [{name: 'echo', description: 'Echo a message'}],
    ...overrides,
  };
}

describe('mcp adapter', () => {
  it('accepts a tools catalogue document', () => {
    expect(isMcpToolsSpecDocument(validMcp())).toBe(true);
    expect(validateDocument(validMcp())).toEqual({ok: true, messages: []});
  });

  it('rejects swagger 2 documents as MCP', () => {
    expect(isMcpToolsSpecDocument({swagger: '2.0', tools: []})).toBe(false);
  });

  it('rejects OpenAPI documents and missing tool names', () => {
    expect(isMcpToolsSpecDocument({openapi: '3.0.0', tools: []})).toBe(false);
    expect(validateDocument({openapi: '3.0.0', paths: {}}).ok).toBe(false);
    expect(validateDocument({tools: [{description: 'no name'}]}).messages.join('\n')).toMatch(
      /tool 1 is missing a name/,
    );
  });

  it('rejects duplicate tool names and invalid versions', () => {
    const dup = validMcp({
      tools: [{name: 'echo'}, {name: 'echo'}],
    });
    expect(validateDocument(dup).messages.join('\n')).toMatch(/duplicate tool name "echo"/);
    expect(
      validateDocument(validMcp({info: {version: 'not-semver'}})).messages.join('\n'),
    ).toMatch(/semantic version/);
  });

  it('requires resource and prompt identifiers when those arrays are present', () => {
    expect(
      validateDocument(validMcp({resources: [{}]})).messages.join('\n'),
    ).toMatch(/resource 1 needs a name or uri/);
    expect(
      validateDocument(validMcp({prompts: [{}]})).messages.join('\n'),
    ).toMatch(/prompt 1 is missing a name/);
    expect(validateDocument(validMcp({resources: {oops: true}})).ok).toBe(false);
    expect(validateDocument(validMcp({prompts: {oops: true}})).ok).toBe(false);
    expect(
      validateDocument(validMcp({prompts: [{description: 'no name'}]})).ok,
    ).toBe(false);
  });

  it('throws from validate when the document is invalid', async () => {
    await expect(
      require('../../src/specs/mcp').validate('/tmp/x.json', {tools: [{}]}),
    ).rejects.toThrow(/missing a name/);
  });
});

