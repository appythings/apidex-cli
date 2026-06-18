const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');

const fixtures = path.join(__dirname, 'fixtures');

describe('SwaggerParser OAS 3.x validation (real parser)', () => {
  it('accepts a valid OAS 3.1.0 fixture', async () => {
    await expect(
      SwaggerParser.validate(path.join(fixtures, 'spec-oas31-valid.yaml')),
    ).resolves.toBeDefined();
  });

  it('accepts OAS 3.1.2 (parser 12 allowlist)', async () => {
    await expect(
      SwaggerParser.validate(path.join(fixtures, 'spec-oas31-312.yaml')),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid OAS 3.1 fixture', async () => {
    await expect(
      SwaggerParser.validate(path.join(fixtures, 'spec-oas31-invalid.yaml')),
    ).rejects.toThrow();
  });

  it('still accepts an existing OAS 3.0 fixture (regression)', async () => {
    await expect(
      SwaggerParser.validate(path.join(fixtures, 'swagger-min.yaml')),
    ).resolves.toBeDefined();
  });
});
