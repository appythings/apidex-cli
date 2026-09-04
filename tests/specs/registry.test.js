const {getAdapter} = require('../../src/specs');

describe('spec adapter registry', () => {
  it('returns openapi for api and mcp for mcp', () => {
    expect(getAdapter('api').id).toBe('openapi');
    expect(getAdapter(undefined).id).toBe('openapi');
    expect(getAdapter('mcp').id).toBe('mcp');
  });

  it('returns graphql for graphql', () => {
    expect(getAdapter('graphql').id).toBe('graphql');
  });

  it('rejects unknown portal types', () => {
    expect(() => getAdapter('website')).toThrow('unknown portalType "website"');
  });
});

