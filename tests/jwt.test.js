jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-jwt-token'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-jti'),
}));

const mockReadCertPEM = jest.fn();
jest.mock('jsrsasign', () => ({
  X509: jest.fn().mockImplementation(function X509() {
    this.hex = 'cert-hex';
    this.readCertPEM = mockReadCertPEM;
  }),
  hextob64: jest.fn(value => `b64-${value}`),
  KJUR: {
    crypto: {
      Util: {
        hashHex: jest.fn(() => 'thumbprint-hex'),
      },
    },
  },
}));

const jsonwebtoken = require('jsonwebtoken');
const {v4: uuidv4} = require('uuid');
const jsrsasign = require('jsrsasign');
const jwtLib = require('../src/lib/jwt');

describe('jwt.create', () => {
  const fixedNow = new Date('2026-06-17T12:00:00.000Z');
  const expectedIat = Math.floor(fixedNow.getTime() / 1000);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('signs an RS256 client assertion with expected claims', () => {
    const token = jwtLib.create(
      'client-id',
      'private-key-pem',
      'public-cert-pem',
      'audience-value',
    );

    expect(token).toBe('signed-jwt-token');
    expect(uuidv4).toHaveBeenCalled();
    expect(jsonwebtoken.sign).toHaveBeenCalledWith(
      {
        aud: 'audience-value',
        iss: 'client-id',
        sub: 'client-id',
        jti: 'fixed-jti',
        iat: expectedIat,
        nbf: expectedIat,
        exp: expectedIat + 60,
      },
      'private-key-pem',
      {
        algorithm: 'RS256',
        header: {
          x5t: 'b64-thumbprint-hex',
        },
      },
    );
  });

  it('derives x5t from the public certificate via jsrsasign', () => {
    jwtLib.create('cid', 'priv', 'my-public-cert', 'aud');

    expect(jsrsasign.X509).toHaveBeenCalled();
    expect(mockReadCertPEM).toHaveBeenCalledWith('my-public-cert');
    expect(jsrsasign.KJUR.crypto.Util.hashHex).toHaveBeenCalledWith(
      'cert-hex',
      'sha1',
    );
    expect(jsrsasign.hextob64).toHaveBeenCalledWith('thumbprint-hex');
  });
});
