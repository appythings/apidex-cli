const path = require('path');
const Portal = require('../src/devportal/portal');

const fixtures = path.join(__dirname, 'fixtures');
const baseUrl = 'https://portal.test';

describe('pushSwagger OAS 3.1 integration (real parser, mocked HTTP)', () => {
  let origCwd;

  beforeEach(() => {
    origCwd = process.cwd();
    process.chdir(fixtures);
  });

  afterEach(() => {
    process.chdir(origCwd);
    jest.restoreAllMocks();
  });

  it('validates and uploads a 3.1 spec to the product specs endpoint', async () => {
    const portal = new Portal(
      {
        hostname: baseUrl,
        environment: 'e1',
        token: 'test-token',
      },
      path.join(fixtures, 'manifest-oas31-valid.yaml'),
    );
    const postSpy = jest.spyOn(portal.request, 'post').mockResolvedValue({
      status: 200,
      data: {id: 'spec-1'},
    });

    await portal.pushSwagger();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toBe(
      'api/environments/e1/apiproducts/api-product-oas31/specs',
    );
    expect(postSpy.mock.calls[0][1]).toMatchObject({
      inheritSpec: false,
      latest: true,
      spec: expect.objectContaining({
        openapi: '3.1.0',
        webhooks: expect.any(Object),
      }),
    });
  });

  it('aborts upload when OAS 3.1 validation fails', async () => {
    const portal = new Portal(
      {
        hostname: baseUrl,
        environment: 'e1',
        token: 'test-token',
      },
      path.join(fixtures, 'manifest-oas31-invalid.yaml'),
    );
    const postSpy = jest.spyOn(portal.request, 'post').mockResolvedValue({});

    await expect(portal.pushSwagger()).rejects.toThrow();
    expect(postSpy).not.toHaveBeenCalled();
  });
});
