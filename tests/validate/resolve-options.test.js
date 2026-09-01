const {resolveValidateOptions} = require('../../src/validate/resolve-options');

const portal = {
  host: 'http://127.0.0.1:3000',
  environment: '123456',
  token: 'tok',
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
    });
  });

  it('requires a manifest path until a settings file supplies one', () => {
    expect(() => resolveValidateOptions()).toThrow(/manifest path/);
    expect(() => resolveValidateOptions({manifestPath: 12})).toThrow(
      /manifest path/,
    );
  });

  it('requires host, environment, and token', () => {
    expect(() =>
      resolveValidateOptions({manifestPath: 'apis.yaml'}),
    ).toThrow(/validate requires --host/);
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
    });
  });
});
