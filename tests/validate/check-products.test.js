jest.mock('../../src/validate/load-gateway-products', () => ({
  loadGatewayProducts: jest.fn(),
}));

const path = require('path');
const {loadGatewayProducts} = require('../../src/validate/load-gateway-products');
const {runValidate} = require('../../src/validate');

const fixtures = path.join(__dirname, '../fixtures/validate');
const portal = {
  host: 'http://127.0.0.1:3000',
  environment: 'e1',
  token: 'tok',
  checkPortal: true,
};

const checkIds = [
  'manifest-paths',
  'spec-kind',
  'overlay-files',
  'overlay-locales',
  'overlay-shape',
  'overlay-targets',
  'required-locales',
  'markdown-links',
  'manifest-products',
];

describe('runValidate product checks', () => {
  it('loads gateway products only with --check-portal', async () => {
    loadGatewayProducts.mockResolvedValue([
      {id: 'pet-store', name: 'pet-store'},
    ]);

    const {ok, results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      ...portal,
    });

    expect(ok).toBe(true);
    expect(loadGatewayProducts).toHaveBeenCalled();
    expect(results.map(result => result.id)).toEqual(checkIds);
  });

  it('skips the portal product check when --check-portal is omitted', async () => {
    loadGatewayProducts.mockClear();
    const {ok, results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
    });
    expect(ok).toBe(true);
    expect(loadGatewayProducts).not.toHaveBeenCalled();
    expect(results.find(result => result.id === 'manifest-products').ok).toBe(
      true,
    );
  });

  it('fails when a manifest product is missing from the portal', async () => {
    loadGatewayProducts.mockResolvedValue([]);

    const {ok, results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      ...portal,
    });

    expect(ok).toBe(false);
    const check = results.find(result => result.id === 'manifest-products');
    expect(check.ok).toBe(false);
    expect(check.messages[0]).toContain('pet-store');
  });

  it('still runs overlay checks when listing gateway products fails', async () => {
    loadGatewayProducts.mockRejectedValue(new Error('portal down'));

    const {ok, results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      ...portal,
    });

    expect(ok).toBe(false);
    expect(results.map(result => result.id)).toContain('overlay-files');
    expect(results.find(result => result.id === 'overlay-files').ok).toBe(true);
    const check = results.find(result => result.id === 'manifest-products');
    expect(check).toEqual({
      id: 'manifest-products',
      ok: false,
      messages: ['portal down'],
    });
  });

  it('stringifies non-Error gateway product load failures', async () => {
    loadGatewayProducts.mockRejectedValue('boom');

    const {results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
      ...portal,
    });

    expect(results.find(result => result.id === 'manifest-products').messages).toEqual(
      ['boom'],
    );
  });
});
