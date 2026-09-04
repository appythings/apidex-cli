import {createRequire} from 'module';
import path from 'path';
import {fileURLToPath} from 'url';

const require = createRequire(import.meta.url);
const {validateOpenApiFile} = require('../src/lib/openapiValidator.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '../tests/fixtures');

const cases = [
  {name: 'OAS 3.1.0 valid', file: 'spec-oas31-valid.yaml', shouldPass: true},
  {name: 'OAS 3.1.2 valid', file: 'spec-oas31-312.yaml', shouldPass: true},
  {name: 'OAS 3.2 valid', file: 'spec-oas32-valid.yaml', shouldPass: true},
  {name: 'OAS 3.1 invalid', file: 'spec-oas31-invalid.yaml', shouldPass: false},
  {name: 'OAS 3.0 regression', file: 'swagger-min.yaml', shouldPass: true},
];

let failed = 0;

for (const testCase of cases) {
  const filePath = path.join(fixtures, testCase.file);
  try {
    await validateOpenApiFile(filePath);
    if (!testCase.shouldPass) {
      console.error(`FAIL: ${testCase.name} — expected rejection`);
      failed += 1;
    } else {
      console.log(`PASS: ${testCase.name}`);
    }
  } catch (error) {
    if (testCase.shouldPass) {
      console.error(`FAIL: ${testCase.name} — ${error.message}`);
      failed += 1;
    } else {
      console.log(`PASS: ${testCase.name} (rejected as expected)`);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
