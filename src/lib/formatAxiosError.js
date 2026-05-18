/**
 * @param {import('axios').AxiosError | Error | unknown} error
 * @returns {string}
 */
function formatRequestError(error) {
  if (error == null) {
    return 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  /** @type {any} */
  const err = error;
  if (err.response) {
    const {status} = err.response;
    const statusText = err.response.statusText || '';
    const cfg = err.config || {};
    const method = ((cfg.method && String(cfg.method)) || 'GET').toUpperCase();
    let path = '';
    if (cfg.baseURL && cfg.url) {
      path = `${String(cfg.baseURL).replace(/\/?$/, '')}/${String(cfg.url).replace(/^\/?/, '')}`;
    } else {
      path =
        cfg.baseURL ||
        cfg.url ||
        '(URL unavailable — check Axios request config)';
    }
    let body = err.response.data;
    try {
      if (typeof body === 'object' && body !== null) {
        body = JSON.stringify(body);
      } else if (body != null && typeof body !== 'string') {
        body = String(body);
      }
    } catch (_) {
      body = '[unserializable response body]';
    }
    const suffix = body ? ` — ${body}` : '';
    return `HTTP ${status} ${statusText} ${method} ${path}${suffix}`.trim();
  }
  if (err.request && !err.response) {
    const msg =
      typeof err.message === 'string'
        ? err.message
        : 'No HTTP response received';
    return `${msg}${err.code ? ` (code ${err.code})` : ''}`;
  }
  if (typeof err.message === 'string' && err.message.length > 0) {
    return err.message;
  }
  try {
    return String(error);
  } catch (_) {
    return 'Error (could not be stringified)';
  }
}

module.exports = {formatRequestError};
