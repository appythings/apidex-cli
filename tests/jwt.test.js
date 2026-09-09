const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwtLib = require('../src/lib/jwt');

// Throwaway self-signed key pair generated for tests only; never used anywhere real.
const privateKey = fs.readFileSync(
  path.join(__dirname, 'fixtures/test-client.key.pem'),
  'utf8',
);
const publicCert = fs.readFileSync(
  path.join(__dirname, 'fixtures/test-client.cert.pem'),
  'utf8',
);

const decodePart = part =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('jwt.create', () => {
  const fixedNow = new Date('2026-06-17T12:00:00.000Z');
  const expectedIat = Math.floor(fixedNow.getTime() / 1000);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('signs an RS256 client assertion with expected claims', () => {
    const token = jwtLib.create(
      'client-id',
      privateKey,
      publicCert,
      'audience-value',
    );
    const [header, payload, signature] = token.split('.');

    expect(decodePart(header)).toEqual({
      alg: 'RS256',
      typ: 'JWT',
      x5t: jwtLib.getX5t(publicCert),
    });
    expect(decodePart(payload)).toEqual({
      aud: 'audience-value',
      iss: 'client-id',
      sub: 'client-id',
      jti: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      iat: expectedIat,
      nbf: expectedIat,
      exp: expectedIat + 60,
    });
    expect(
      crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        new crypto.X509Certificate(publicCert).publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });

  it('uses a fresh jti per assertion', () => {
    const jti = token => decodePart(token.split('.')[1]).jti;
    expect(jti(jwtLib.create('c', privateKey, publicCert, 'a'))).not.toBe(
      jti(jwtLib.create('c', privateKey, publicCert, 'a')),
    );
  });

  it('derives x5t as the base64url SHA-1 thumbprint of the DER certificate', () => {
    const der = new crypto.X509Certificate(publicCert).raw;
    const expected = crypto
      .createHash('sha1')
      .update(der)
      .digest('base64url');
    expect(jwtLib.getX5t(publicCert)).toBe(expected);
    expect(jwtLib.getX5t(publicCert)).not.toMatch(/[+/=]/);
  });

  it('rejects a certificate that is not PEM', () => {
    expect(() => jwtLib.create('c', privateKey, 'not a cert', 'a')).toThrow();
  });
});
