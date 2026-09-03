/**
 * @param {{host: string, environment: string, token?: string, clientId?: string, clientSecret?: string, aud?: string, scope?: string, tokenUrl?: string, manifestPath: string}} options
 * @param {typeof import('../devportal/portal')} [PortalCtor]
 */
function portalConfig(options) {
  const config = {
    hostname: options.host,
    environment: options.environment,
    grantType: 'client_credentials',
  };
  if (options.token) config.token = options.token;
  if (options.clientId) config.clientId = options.clientId;
  if (options.clientSecret) config.clientSecret = options.clientSecret;
  if (options.aud) config.aud = options.aud;
  if (options.scope) config.scope = options.scope;
  if (options.tokenUrl) config.tokenUrl = options.tokenUrl;
  return config;
}

async function loadGatewayProducts(options, PortalCtor) {
  const Portal = PortalCtor || require('../devportal/portal');
  const portal = new Portal(portalConfig(options), options.manifestPath);
  return portal.listApiproducts();
}

module.exports = {loadGatewayProducts};
