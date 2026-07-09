const fs = require('fs-extra');
const path = require('path');
const {
  validateOpenApiFile,
  __setImportParser,
} = require('../src/lib/openapiValidator');

describe('openapiValidator unit', () => {
  afterEach(() => {
    __setImportParser(() => import('@scalar/openapi-parser'));
  });

  it('reads file content and passes it to scalar validate', async () => {
    const mockValidate = jest.fn().mockResolvedValue({valid: true});
    __setImportParser(async () => ({validate: mockValidate}));

    const filePath = path.join(__dirname, 'fixtures/swagger-min.yaml');
    const expectedContent = fs.readFileSync(filePath, 'utf8');

    await validateOpenApiFile(filePath);

    expect(mockValidate).toHaveBeenCalledWith(expectedContent, {
      throwOnError: true,
    });
  });

  it('reuses the cached scalar validate function', async () => {
    const mockValidate = jest.fn().mockResolvedValue({valid: true});
    const mockImport = jest.fn(async () => ({validate: mockValidate}));
    __setImportParser(mockImport);

    const filePath = path.join(__dirname, 'fixtures/swagger-min.yaml');
    await validateOpenApiFile(filePath);
    await validateOpenApiFile(filePath);

    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledTimes(2);
  });
});
