const {addDocToManifest} = require('../lib/product-docs');

function runAddDocCli(argv, deps = {}) {
  const log = deps.log || (msg => console.log(msg));
  const exit = deps.exit || (code => process.exit(code));
  try {
    const result = addDocToManifest({
      manifestPath: argv.manifest,
      productName: argv.product,
      markdownPath: argv.markdown,
      title: argv.title,
      slug: argv.slug,
      locale: argv.locale,
      update: Boolean(argv.update),
    });
    log(
      `Added docs tab "${result.slug}"${result.locale ? ` locale "${result.locale}"` : ''} to ${result.product} (${result.markdown})`,
    );
    exit(0);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

module.exports = {runAddDocCli};
