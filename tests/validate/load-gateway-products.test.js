const path = require('path');
const {loadGatewayProducts} = require('../../src/validate/load-gateway-products');

jest.mock('../../src/devportal/portal', () =>
  jest.fn().mockImplementation(function () {
    this.listApiproducts = jest.fn().mockResolvedValue([{name: 'from-module'}]);
  }),
);

const Portal = require('../../src/devportal/portal');

describe('loadGatewayProducts', () => {
  it('constructs a Portal and returns listApiproducts', async () => {
    const listApiproducts = jest.fn().mockResolvedValue([{name: 'pep-echo'}]);
    function FakePortal(config, manifestPath) {
      FakePortal.calls.push({config, manifestPath});
      this.listApiproducts = listApiproducts;
    }
    FakePortal.calls = [];

    const products = await loadGatewayProducts(
      {
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        token: 'tok',
        manifestPath: '/tmp/apis.yaml',
      },
      FakePortal,
    );

    expect(FakePortal.calls).toEqual([
      {
        config: {
          hostname: 'http://127.0.0.1:3000',
          environment: '123456',
          grantType: 'client_credentials',
          token: 'tok',
        },
        manifestPath: '/tmp/apis.yaml',
      },
    ]);
    expect(products).toEqual([{name: 'pep-echo'}]);
  });

  it('passes client credentials when no token is set', async () => {
    function FakePortal(config, manifestPath) {
      FakePortal.calls.push({config, manifestPath});
      this.listApiproducts = jest.fn().mockResolvedValue([]);
    }
    FakePortal.calls = [];

    await loadGatewayProducts(
      {
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        clientId: 'cid',
        clientSecret: 'secret',
        aud: 'aud-val',
        scope: 'scope-val',
        tokenUrl: 'https://token.test/oauth',
        manifestPath: '/tmp/apis.yaml',
      },
      FakePortal,
    );

    expect(FakePortal.calls[0].config).toEqual({
      hostname: 'http://127.0.0.1:3000',
      environment: '123456',
      grantType: 'client_credentials',
      clientId: 'cid',
      clientSecret: 'secret',
      aud: 'aud-val',
      scope: 'scope-val',
      tokenUrl: 'https://token.test/oauth',
    });
  });

  it('defaults to the Portal module', async () => {
    const manifestPath = path.join(
      __dirname,
      '../fixtures/manifest-products-only.yaml',
    );
    const products = await loadGatewayProducts({
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      manifestPath,
    });
    expect(Portal).toHaveBeenCalled();
    expect(products).toEqual([{name: 'from-module'}]);
  });
});
