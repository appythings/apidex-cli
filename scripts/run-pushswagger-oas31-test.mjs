import {createRequire} from 'module';
import path from 'path';
import {fileURLToPath} from 'url';

const require = createRequire(import.meta.url);
const Portal = require('../src/devportal/portal.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '../tests/fixtures');
const baseUrl = 'https://portal.test';

let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function runValidUploadTest() {
  const origCwd = process.cwd();
  process.chdir(fixtures);
  try {
    const portal = new Portal(
      {
        hostname: baseUrl,
        environment: 'e1',
        token: 'test-token',
      },
      path.join(fixtures, 'manifest-oas31-valid.yaml'),
    );

    let postCalled = false;
    portal.request.post = async (url, body) => {
      postCalled = true;
      assert(
        url === 'api/environments/e1/apiproducts/api-product-oas31/specs',
        'posts to product specs endpoint',
      );
      assert(body?.spec?.openapi === '3.1.0', 'upload body contains openapi 3.1.0');
      assert(
        body?.spec?.webhooks && typeof body.spec.webhooks === 'object',
        'upload body contains webhooks',
      );
      return {status: 200, data: {id: 'spec-1'}};
    };

    await portal.pushSwagger();
    assert(postCalled, 'valid OAS 3.1 upload calls POST');
  } finally {
    process.chdir(origCwd);
  }
}

async function runInvalidUploadTest() {
  const origCwd = process.cwd();
  process.chdir(fixtures);
  try {
    const portal = new Portal(
      {
        hostname: baseUrl,
        environment: 'e1',
        token: 'test-token',
      },
      path.join(fixtures, 'manifest-oas31-invalid.yaml'),
    );

    let postCalled = false;
    portal.request.post = async () => {
      postCalled = true;
      return {};
    };

    let rejected = false;
    try {
      await portal.pushSwagger();
    } catch {
      rejected = true;
    }

    assert(rejected, 'invalid OAS 3.1 upload rejects');
    assert(!postCalled, 'invalid OAS 3.1 upload does not call POST');
  } finally {
    process.chdir(origCwd);
  }
}

await runValidUploadTest();
await runInvalidUploadTest();

process.exit(failed > 0 ? 1 : 0);
