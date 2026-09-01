const {resolveValidateOptions} = require('../../src/validate/resolve-options');

const portal = {
  host: 'http://127.0.0.1:3000',
  environment: '123456',
  token: 'tok',
};

const emptyClient = {
  clientId: '',
  clientSecret: '',
  aud: '',
  scope: '',
  tokenUrl: '',
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
    });
  });

  it('requires a manifest path until a settings file supplies one', () => {
    expect(() => resolveValidateOptions()).toThrow(/manifest path/);
    expect(() => resolveValidateOptions({manifestPath: 12})).toThrow(
      /manifest path/,
    );
  });

  it('requires host and environment', () => {
    expect(() =>
      resolveValidateOptions({manifestPath: 'apis.yaml', token: 'tok'}),
    ).toThrow(/validate requires --host and --environment/);
  });

  it('requires token or client credentials', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
      }),
    ).toThrow(/validate requires --token or client credentials/);
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
    });
  });

  it('rejects clientId without tokenUrl when no token is set', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        clientId: 'cid',
      }),
    ).toThrow(/validate requires --token or client credentials/);
  });

  it('rejects tokenUrl without clientId when no token is set', () => {
    expect(() =>
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: 'http://127.0.0.1:3000',
        environment: '123456',
        tokenUrl: 'https://token.test/oauth',
      }),
    ).toThrow(/validate requires --token or client credentials/);
  });

  it('trims portal connection fields', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        host: ' http://127.0.0.1:3000 ',
        environment: ' 123456 ',
        token: ' tok ',
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: [],
      host: 'http://127.0.0.1:3000',
      environment: '123456',
      token: 'tok',
      ...emptyClient,
    });
  });
});
