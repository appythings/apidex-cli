const {resolveValidateOptions} = require('../../src/validate/resolve-options');

const portal = {
  host: 'http://127.0.0.1:3000',
  environment: '123456',
  token: 'tok',
  checkPortal: true,
};

const emptyClient = {
  clientId: '',
  clientSecret: '',
  aud: '',
  scope: '',
  tokenUrl: '',
};

const extra = {
  checkPortal: true,
  json: false,
};

describe('resolveValidateOptions', () => {
  it('reads manifestPath and requireLocales from argv', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        requireLocales: 'nl-NL, de-DE',
        ...portal,
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: ['nl-NL', 'de-DE'],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      ...emptyClient,
      ...extra,
    });
  });

  it('treats a blank --require-locales value as none required', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        requireLocales: '  ',
        ...portal,
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: [],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      ...emptyClient,
      ...extra,
    });
  });

  it('treats missing --require-locales as an empty list', () => {
    expect(
      resolveValidateOptions({manifestPath: './apis.yaml', ...portal}),
    ).toEqual({
      manifestPath: './apis.yaml',
      requireLocales: [],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      ...emptyClient,
      ...extra,
    });
  });

  it('requires a manifest path until a settings file supplies one', () => {
    expect(() => resolveValidateOptions()).toThrow(/manifest path/);
    expect(() => resolveValidateOptions({manifestPath: 12})).toThrow(
      /manifest path/,
    );
  });

  it('does not require host offline', () => {
    expect(resolveValidateOptions({manifestPath: 'apis.yaml'})).toMatchObject({
      manifestPath: 'apis.yaml',
      checkPortal: false,
    });
  });

  it('requires host and environment for --check-portal', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        token: 'tok',
        checkPortal: true,
      }),
    ).toThrow(/validate --check-portal requires --host and --environment/);
  });

  it('requires token or client credentials for --check-portal', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        checkPortal: true,
      }),
    ).toThrow(/validate --check-portal requires --token or client credentials/);
  });

  it('accepts client credentials instead of a token', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: ' http://127.0.0.1:3000 ',
        environment: ' 123456 ',
        clientId: ' cid ',
        clientSecret: ' secret ',
        aud: ' aud ',
        scope: ' scope ',
        tokenUrl: ' https://token.test/oauth ',
        checkPortal: true,
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: [],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: '',
      clientId: 'cid',
      clientSecret: 'secret',
      aud: 'aud',
      scope: 'scope',
      tokenUrl: 'https://token.test/oauth',
      checkPortal: true,
      json: false,
    });
  });

  it('rejects clientId without tokenUrl when --check-portal and no token', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        clientId: 'cid',
        checkPortal: true,
      }),
    ).toThrow(/validate --check-portal requires --token or client credentials/);
  });

  it('rejects tokenUrl without clientId when --check-portal and no token', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        tokenUrl: 'https://token.test/oauth',
        checkPortal: true,
      }),
    ).toThrow(/validate --check-portal requires --token or client credentials/);
  });

  it('trims portal connection fields', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: ' http://127.0.0.1:3000 ',
        environment: ' 123456 ',
        token: ' tok ',
        checkPortal: true,
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: [],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      ...emptyClient,
      ...extra,
    });
  });
});
