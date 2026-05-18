const {formatRequestError} = require('../src/lib/formatAxiosError');

describe('formatRequestError', () => {
  it('formats axios-style HTTP errors with URL and JSON body', () => {
    const err = {
      response: {
        status: 403,
        statusText: 'Forbidden',
        data: {message: 'no access'},
      },
      config: {
        baseURL: 'https://portal.test',
        url: '/api/teams',
        method: 'get',
      },
    };
    expect(formatRequestError(err)).toContain('HTTP 403');
    expect(formatRequestError(err)).toContain(
      'GET https://portal.test/api/teams',
    );
    expect(formatRequestError(err)).toContain('no access');
  });

  it('handles missing baseURL/url', () => {
    const err = {
      response: {status: 500, statusText: 'Error', data: 'plain'},
      config: {},
    };
    expect(formatRequestError(err)).toContain('HTTP 500');
  });

  it('works when statusText is missing', () => {
    const err = {
      response: {status: 418, data: {a: 1}},
      config: {method: 'PUT', baseURL: 'https://h', url: 'p'},
    };
    const out = formatRequestError(err);
    expect(out).toContain('HTTP 418');
  });

  it('omits body suffix when response data is absent', () => {
    const err = {
      response: {status: 204},
      config: {method: 'DELETE', baseURL: 'https://x', url: 'y'},
    };
    expect(formatRequestError(err)).not.toContain('—');
  });

  it('network error without node code suffix', () => {
    expect(
      formatRequestError({
        request: {},
        message: 'socket hang up',
      }),
    ).toBe('socket hang up');

  });



  it('handles plain Error', () => {
    expect(formatRequestError(new Error('oops'))).toBe('oops');
  });

  it('handles null and string', () => {
    expect(formatRequestError(null)).toBe('Unknown error');
    expect(formatRequestError('x')).toBe('x');
  });

  it('handles circular JSON response data', () => {
    const cyclic = {a: 1};
    cyclic.self = cyclic;
    const err = {
      response: {status: 400, statusText: 'Bad', data: cyclic},
      config: {method: 'post', baseURL: 'https://z', url: 'x'},
    };
    expect(formatRequestError(err)).toContain('[unserializable response body]');
  });

  it('stringifies non-object response data', () => {
    const err = {
      response: {status: 422, statusText: 'x', data: 42},
      config: {method: 'get', baseURL: 'https://a', url: 'b'},
    };
    expect(formatRequestError(err)).toContain('42');
  });

  it('falls back when String(error) throws', () => {
    const weird = {
      toString() {
        throw new Error('boom');
      },
    };
    expect(formatRequestError(weird)).toBe('Error (could not be stringified)');
  });
});
