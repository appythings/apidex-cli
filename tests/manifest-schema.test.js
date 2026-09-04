const schema = require('../schema/apidex-manifest.schema.json');

describe('manifest schema', () => {
  it('documents spec as the generic file pointer and openapi as the alias', () => {
    expect(schema.$defs.product.properties.spec).toEqual({type: 'string'});
    expect(schema.$defs.product.properties.openapi).toEqual({type: 'string'});
    expect(schema.properties.categories.items.properties.spec).toEqual({
      type: 'string',
    });
    expect(schema.properties.categories.items.properties.openapi).toEqual({
      type: 'string',
    });
  });

  it('documents api and mcp portal types with api as the default', () => {
    expect(schema.$defs.product.properties.portalType).toEqual({
      type: 'string',
      enum: ['api', 'mcp'],
      default: 'api',
    });
  });

  it('discriminates regular docs from overview entries', () => {
    const docsEntry = schema.$defs.docs.items;
    expect(docsEntry.oneOf).toEqual([
      {$ref: '#/$defs/docEntry'},
      {$ref: '#/$defs/overviewEntry'},
    ]);
    expect(schema.$defs.docEntry.properties.type).toEqual({
      const: 'doc',
    });
    expect(schema.$defs.docEntry.required).toEqual(['markdown']);
    expect(schema.$defs.overviewEntry).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: {const: 'overview'},
      },
    });
  });

  it('reserves spec and overview doc slugs', () => {
    expect(schema.$defs.docEntry.properties.slug.not.enum).toEqual([
      'spec',
      'overview',
    ]);
  });

  it('allows at most one overview entry', () => {
    expect(schema.$defs.docs).toEqual(
      expect.objectContaining({
        contains: {$ref: '#/$defs/overviewEntry'},
        minContains: 0,
        maxContains: 1,
      }),
    );
  });
});
