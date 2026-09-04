const check = require('../../../src/validate/checks/manifest-products');

describe('manifest-products check', () => {
  it('passes when every manifest product exists by name or id', async () => {
    const result = await check.run({
      options: {environment: '123456', checkPortal: true},
      gatewayProducts: [
        {id: 'pep-echo', name: 'pep-echo'},
        {id: 'fef4f071-be87-39e8-bf0c-210aaef98326', name: 'some-plan'},
      ],
      entries: [
        {kind: 'category', name: 'CLI category'},
        {kind: 'product', name: 'pep-echo', inheritSpec: true},
        {
          kind: 'product',
          name: 'fef4f071-be87-39e8-bf0c-210aaef98326',
          inheritSpec: true,
        },
      ],
    });
    expect(result).toEqual({ok: true, messages: []});
  });

  it('fails when a product is missing and ignores displayName-only matches', async () => {
    const result = await check.run({
      options: {environment: '123456', checkPortal: true},
      gatewayProducts: [{id: 'pep-echo', name: 'pep-echo', displayName: 'Echo v1'}],
      entries: [{kind: 'product', name: 'Echo V1'}],
    });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toContain('Echo V1');
    expect(result.messages[0]).toContain('not displayName');
  });

  it('skips nameless product entries', async () => {
    const result = await check.run({
      gatewayProducts: [],
      entries: [{kind: 'product'}],
    });
    expect(result).toEqual({ok: true, messages: []});
  });

  it('treats a missing context as an empty product list', async () => {
    await expect(check.run()).resolves.toEqual({ok: true, messages: []});
  });

  it('ignores null gateway product rows', async () => {
    const result = await check.run({
      options: {environment: '123456', checkPortal: true},
      gatewayProducts: [null],
      entries: [{kind: 'product', name: 'pep-echo'}],
    });
    expect(result.ok).toBe(false);
  });

  it('fails with the gateway load error instead of listing missing products', async () => {
    const result = await check.run({
      options: {checkPortal: true},
      gatewayProductsError: 'portal down',
      gatewayProducts: [],
      entries: [{kind: 'product', name: 'pep-echo'}],
    });
    expect(result).toEqual({ok: false, messages: ['portal down']});
  });
});
