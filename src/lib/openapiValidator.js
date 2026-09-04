const fs = require('fs-extra');

let scalarValidate;
let importParser = () => import('@scalar/openapi-parser');

async function getScalarValidate() {
  if (!scalarValidate) {
    const parser = await importParser();
    scalarValidate = parser.validate;
  }
  return scalarValidate;
}

async function validateOpenApiFile(filePath) {
  const validate = await getScalarValidate();
  const content = fs.readFileSync(filePath, 'utf8');
  return validate(content, {throwOnError: true});
}

module.exports = {
  validateOpenApiFile,
  __setImportParser: (fn) => {
    importParser = fn;
    scalarValidate = undefined;
  },
};
