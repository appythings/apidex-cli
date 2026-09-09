const crypto = require('crypto');

const base64url = input =>
  Buffer.from(input).toString('base64url');

/**
 * RFC 7515 `x5t`: base64url-encoded SHA-1 thumbprint of the DER certificate.
 * @param {string} publicCert PEM-encoded X.509 certificate
 */
const getX5t = publicCert => {
  const cert = new crypto.X509Certificate(publicCert);
  return crypto.createHash('sha1').update(cert.raw).digest('base64url');
};

module.exports = {
  getX5t,
  /**
   * Builds an RS256 client assertion (JWT) for the OAuth client-credentials
   * flow with certificate authentication.
   *
   * @param {string} client_id
   * @param {string} privateKey PEM-encoded RSA private key
   * @param {string} publicCert PEM-encoded certificate matching the key
   * @param {string} aud token endpoint audience
   * @returns {string} compact JWS
   */
  create: (client_id, privateKey, publicCert, aud) => {
    const now = Math.floor(Date.now() / 1000);
    const header = {alg: 'RS256', typ: 'JWT', x5t: getX5t(publicCert)};
    const payload = {
      aud,
      iss: client_id,
      sub: client_id,
      jti: crypto.randomUUID(),
      iat: now,
      nbf: now,
      exp: now + 60,
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
      JSON.stringify(payload),
    )}`;
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
      .toString('base64url');
    return `${signingInput}.${signature}`;
  },
};
