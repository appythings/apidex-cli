const fs = require('fs-extra');
const yaml = require('js-yaml');

function parseSpecFile(specPath) {
  const raw = fs.readFileSync(specPath, 'utf8');
  if (/\.(yml|yaml)$/.test(specPath)) {
    return yaml.load(raw);
  }
  if (specPath.endsWith('.json')) {
    return JSON.parse(raw);
  }
  throw new Error(`Spec ${specPath} must be yaml/yml or json`);
}

module.exports = {parseSpecFile};
