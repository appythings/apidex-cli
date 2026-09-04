const {getAdapter} = require('../../src/specs');

describe('spec adapter registry', () => {
  it('returns openapi for api and mcp for mcp', () => {
    expect(getAdapter('api').id).toBe('openapi');
    expect(getAdapter(undefined).id).toBe('openapi');
    expect(getAdapter('mcp').id).toBe('mcp');
  });

  it('rejects graphql as not supported yet', () => {
    expect(() => getAdapter('graphql')).toThrow(
      'portalType "graphql" is not supported yet',
    );
  });

  it('rejects unknown portal types', () => {
    expect(() => getAdapter('website')).toThrow('unknown portalType "website"');
  });
});

