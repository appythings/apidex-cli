const path = require('path');
const Portal = require('../src/devportal/portal');

describe('Portal.pushProductDocs', () => {
  const fixtures = path.join(__dirname, 'fixtures');

  it('skips when skipDocs is set', async () => {
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e', token: 't', skipDocs: true},
      path.join(fixtures, 'manifest-products-only.yaml'),
    );
    portal.request.post = jest.fn();
    await portal.pushProductDocs();
    expect(portal.request.post).not.toHaveBeenCalled();
  });

  it('posts docs with force query when forceDocs is set', async () => {
    const tmp = require('fs-extra').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-push-'),
    );
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'pep-echo',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [{markdown: 'hi.md', slug: 'hi', title: 'Hi'}],
          },
        ],
      }),
    );
    const portal = new Portal(
      {
        hostname: 'https://h',
        environment: 'e',
        token: 't',
        forceDocs: true,
      },
      path.join(tmp, 'apis.yaml'),
    );
    portal.request.post = jest.fn().mockResolvedValue({
      data: {widgetId: 'w1', docs: [{slug: 'hi', id: 'd1'}]},
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await portal.pushProductDocs();
    expect(portal.request.post).toHaveBeenCalledWith(
      'api/cms/product-docs?force=true',
      expect.objectContaining({
        productId: 'pep-echo',
        force: true,
        docs: [expect.objectContaining({slug: 'hi', title: 'Hi'})],
      }),
    );
    log.mockRestore();
    fs.removeSync(tmp);
  });

  it('keeps default api payloads compatible with older BFFs', async () => {
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    const tmp = fs.mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-api-'),
    );
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'api-product',
            portalType: 'api',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [{type: 'doc', markdown: 'hi.md', slug: 'hi'}],
          },
        ],
      }),
    );
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e', token: 't'},
      path.join(tmp, 'apis.yaml'),
    );
    portal.request.post = jest.fn().mockResolvedValue({data: {}});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await portal.pushProductDocs();

    expect(portal.request.post.mock.calls[0][1]).toEqual({
      productId: 'api-product',
      force: false,
      docs: [{slug: 'hi', title: 'Hi', markdown: '# Hi\n'}],
    });
    log.mockRestore();
    fs.removeSync(tmp);
  });

  it('routes mcp products with portalType and ordered overview entries', async () => {
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    const tmp = fs.mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-mcp-'),
    );
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'mcp-product',
            portalType: 'mcp',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [
              {type: 'overview'},
              {markdown: 'hi.md', slug: 'hi'},
            ],
          },
        ],
      }),
    );
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e', token: 't'},
      path.join(tmp, 'apis.yaml'),
    );
    portal.request.post = jest.fn().mockResolvedValue({data: {}});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await portal.pushProductDocs();

    expect(portal.request.post).toHaveBeenCalledWith(
      'api/cms/product-docs',
      {
        productId: 'mcp-product',
        portalType: 'mcp',
        force: false,
        docs: [
          {type: 'overview'},
          {slug: 'hi', title: 'Hi', markdown: '# Hi\n'},
        ],
      },
    );
    log.mockRestore();
    fs.removeSync(tmp);
  });

  it('routes graphql products with portalType', async () => {
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    const tmp = fs.mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-gql-'),
    );
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'gql-product',
            portalType: 'graphql',
            spec: path.join(fixtures, 'echo-graphql.json'),
            docs: [{markdown: 'hi.md', slug: 'hi'}],
          },
        ],
      }),
    );
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e', token: 't'},
      path.join(tmp, 'apis.yaml'),
    );
    portal.request.post = jest.fn().mockResolvedValue({data: {}});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await portal.pushProductDocs();

    expect(portal.request.post).toHaveBeenCalledWith('api/cms/product-docs', {
      productId: 'gql-product',
      portalType: 'graphql',
      force: false,
      docs: [{slug: 'hi', title: 'Hi', markdown: '# Hi\n'}],
    });
    log.mockRestore();
    fs.removeSync(tmp);
  });

  it('warns once when Payload is not the CMS', async () => {
    const tmp = require('fs-extra').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-skip-'),
    );
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'a',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [{markdown: 'hi.md', slug: 'a', title: 'A'}],
          },
          {
            name: 'b',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [{markdown: 'hi.md', slug: 'b', title: 'B'}],
          },
        ],
      }),
    );
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e', token: 't'},
      path.join(tmp, 'apis.yaml'),
    );
    portal.request.post = jest.fn().mockResolvedValue({
      data: {skipped: 'not-payload'},
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await portal.pushProductDocs();
    expect(portal.request.post).toHaveBeenCalledTimes(2);
    expect(
      log.mock.calls.filter(c => String(c[0]).includes('not using Payload')).length,
    ).toBe(1);
    log.mockRestore();
    fs.removeSync(tmp);
  });

  it('returns when there is no manifest', async () => {
    const portal = new Portal({
      hostname: 'https://h',
      environment: 'e',
      token: 't',
    });
    portal.request.post = jest.fn();
    await portal.pushProductDocs();
    expect(portal.request.post).not.toHaveBeenCalled();
  });

  it('logs in when no token and fails the command on CMS errors', async () => {
    const tmp = require('fs-extra').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'apidex-docs-err-'),
    );
    const fs = require('fs-extra');
    const yaml = require('js-yaml');
    fs.writeFileSync(path.join(tmp, 'hi.md'), '# Hi\n');
    fs.writeFileSync(
      path.join(tmp, 'apis.yaml'),
      yaml.dump({
        products: [
          {
            name: 'pep-echo',
            openapi: path.join(fixtures, 'spec-min.json'),
            docs: [{markdown: 'hi.md', slug: 'hi', title: 'Hi'}],
          },
        ],
      }),
    );
    const portal = new Portal(
      {hostname: 'https://h', environment: 'e'},
      path.join(tmp, 'apis.yaml'),
    );
    portal.login = jest.fn().mockResolvedValue();
    portal.request.post = jest.fn().mockRejectedValue(new Error('conflict'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(portal.pushProductDocs()).rejects.toThrow('conflict');
    expect(portal.login).toHaveBeenCalled();
    log.mockRestore();
    fs.removeSync(tmp);
  });
});
