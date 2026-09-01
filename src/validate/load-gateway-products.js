/**
 * @param {{host: string, environment: string, token: string, manifestPath: string}} options
 * @param {typeof import('../devportal/portal')} [PortalCtor]
 */
async function loadGatewayProducts(options, PortalCtor) {
  const Portal = PortalCtor || require('../devportal/portal');
  const portal = new Portal(
    {
      hostname: options.host,
      environment: options.environment,
      token: options.token,
    },
    options.manifestPath,
  );
  return portal.listApiproducts();
}

module.exports = {loadGatewayProducts};
