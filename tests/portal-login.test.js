jest.mock('axios', () => {
  const real = jest.requireActual('axios');
  const fn = function (config) {
    if (
      config &&
      typeof config === 'object' &&
      String(config.url || '').includes('token.test.oauth')
    ) {
      return Promise.resolve({data: {access_token: 'mock-access'}});
    }
    return real(config);
  };
  fn.create = real.create;
  return fn;
});

const Portal = require('../src/devportal/portal');

describe('Portal OAuth login', () => {
  it('sets Authorization from tokenUrl exchange', async () => {
    const portal = new Portal({
      hostname: 'https://api.example',
      clientId: 'cid',
      clientSecret: 'csec',
      grantType: 'client_credentials',
      scope: 's',
      tokenUrl: 'https://idp/token.test.oauth/v2/token',
    });

    await portal.login();

    expect(portal.request.defaults.headers.common.Authorization).toBe(
      'Bearer mock-access',
    );
  });

  it('does not clear preset token', async () => {
    const portal = new Portal({
      hostname: 'https://api.example',
      token: 'preset',
      tokenUrl: 'https://ignored',
    });

    await portal.login();
    await portal.login();
    expect(portal.request.defaults.headers.common.Authorization).toBe(
      'Bearer preset',
    );
  });
});
