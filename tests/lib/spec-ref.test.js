const path = require('path');
const {
  specField,
  specPath,
  portalType,
  hasSpecRef,
} = require('../../src/lib/spec-ref');

describe('spec-ref', () => {
  it('prefers spec over nothing and treats openapi as the alias', () => {
    expect(specField({spec: 'tools.json'})).toEqual({
      field: 'spec',
      value: 'tools.json',
    });
    expect(specField({openapi: 'echo.yaml'})).toEqual({
      field: 'openapi',
      value: 'echo.yaml',
    });
    expect(hasSpecRef({spec: 'tools.json'})).toBe(true);
    expect(hasSpecRef({name: 'none'})).toBe(false);
  });

  it('rejects declaring both spec and openapi', () => {
    const result = specField({name: 'echo', spec: 'a.json', openapi: 'b.yaml'});
    expect(result.error).toMatch(/echo: declare spec or openapi, not both/);
    expect(result.value).toBeUndefined();
  });

  it('resolves the declared path from the manifest directory', () => {
    expect(specPath({spec: 'specs/a.json'}, '/repo')).toEqual({
      field: 'spec',
      value: 'specs/a.json',
      path: path.join('/repo', 'specs/a.json'),
    });
  });

  it('defaults portalType to api', () => {
    expect(portalType({})).toBe('api');
    expect(portalType({portalType: 'mcp'})).toBe('mcp');
  });
});
