const {resolveValidateOptions} = require('../../src/validate/resolve-options');

describe('resolveValidateOptions', () => {
  it('reads manifestPath and requireLocales from argv', () => {
    expect(
      resolveValidateOptions({
        manifestPath: 'apis.yaml',
        requireLocales: 'nl-NL, de-DE',
      }),
    ).toEqual({
      manifestPath: 'apis.yaml',
      requireLocales: ['nl-NL', 'de-DE'],
    });
  });

  it('treats a blank --require-locales value as none required', () => {
    expect(
      resolveValidateOptions({manifestPath: 'apis.yaml', requireLocales: '  '}),
    ).toEqual({manifestPath: 'apis.yaml', requireLocales: []});
  });

  it('treats missing --require-locales as an empty list', () => {
    expect(resolveValidateOptions({manifestPath: './apis.yaml'})).toEqual({
      manifestPath: './apis.yaml',
      requireLocales: [],
    });
  });

  it('requires a manifest path until a settings file supplies one', () => {
    expect(() => resolveValidateOptions()).toThrow(/manifest path/);
    expect(() => resolveValidateOptions({manifestPath: 12})).toThrow(
      /manifest path/,
    );
  });
});
