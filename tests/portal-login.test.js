jest.mock('../src/lib/jwt', () => ({
  create: jest.fn(() => 'mock-jwt-assertion'),
}));

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

const jwt = require('../src/lib/jwt');
const Portal = require('../src/devportal/portal');

describe('Portal OAuth login', () => {
  const origPrivate = process.env.PRIVATE_KEY_BASE64;
  const origPublic = process.env.PUBLIC_KEY_BASE64;

  afterEach(() => {
    if (origPrivate === undefined) {
      delete process.env.PRIVATE_KEY_BASE64;
    } else {
      process.env.PRIVATE_KEY_BASE64 = origPrivate;
    }
    if (origPublic === undefined) {
      delete process.env.PUBLIC_KEY_BASE64;
    } else {
      process.env.PUBLIC_KEY_BASE64 = origPublic;
    }
    jest.clearAllMocks();
  });

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

  it('uses client_assertion when certificate env vars are set', async () => {
    process.env.PRIVATE_KEY_BASE64 = Buffer.from('private-key-pem').toString(
      'base64',
    );
    process.env.PUBLIC_KEY_BASE64 = Buffer.from('public-key-pem').toString(
      'base64',
    );

    const portal = new Portal({
      hostname: 'https://api.example',
      clientId: 'cid',
      clientSecret: 'csec',
      grantType: 'client_credentials',
      scope: 's',
      aud: 'audience',
      tokenUrl: 'https://idp/token.test.oauth/v2/token',
    });

    await portal.login();

    expect(jwt.create).toHaveBeenCalledWith(
      'cid',
      'private-key-pem',
      'public-key-pem',
      'audience',
    );
    expect(portal.request.defaults.headers.common.Authorization).toBe(
      'Bearer mock-access',
    );
  });
});
