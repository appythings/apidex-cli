const {parse, buildSchema, validateSchema} = require('graphql');
const {isMcpToolsSpecDocument} = require('./mcp');

const GRAPHQL_SDL_MAX_BYTES = 1024 * 1024;
const GRAPHQL_INITIAL_QUERY_MAX_BYTES = 64 * 1024;
const GRAPHQL_ENDPOINT_MAX_CHARS = 2048;
const GRAPHQL_SDL_MAX_DEFINITIONS = 10_000;
const AUTH_TYPES = new Set(['none', 'bearer', 'apiKey']);

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isSemver(value) {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      value,
    )
  );
}

function looksLikeOpenApi(spec) {
  const root = asRecord(spec);
  return (
    typeof root.openapi === 'string' ||
    root.swagger === '2.0' ||
    root.swagger === '2'
  );
}

function isGraphqlSpecDocument(spec) {
  const root = asRecord(spec);
  return root.kind === 'graphql' && root.schemaVersion === 1;
}

function isGraphqlSpecUpload(upload) {
  return isGraphqlSpecDocument(asRecord(upload).document);
}

function validateSdl(schemaSdl, messages) {
  if (Buffer.byteLength(schemaSdl, 'utf8') > GRAPHQL_SDL_MAX_BYTES) {
    messages.push('document.schema exceeds maximum size');
    return;
  }
  let document;
  try {
    document = parse(schemaSdl);
  } catch (error) {
    messages.push(
      error instanceof Error ? error.message : 'Invalid GraphQL SDL',
    );
    return;
  }
  if (document.definitions.length > GRAPHQL_SDL_MAX_DEFINITIONS) {
    messages.push('document.schema has too many definitions');
    return;
  }
  try {
    const schema = buildSchema(schemaSdl);
    const errors = validateSchema(schema);
    if (errors.length > 0) {
      messages.push(errors.map(error => error.message).join('; '));
    }
  } catch (error) {
    messages.push(
      error instanceof Error ? error.message : 'Invalid GraphQL SDL',
    );
  }
}

function validateExecution(execution, messages) {
  const exec = asRecord(execution);
  const endpoint = typeof exec.endpoint === 'string' ? exec.endpoint : '';
  if (endpoint.length > GRAPHQL_ENDPOINT_MAX_CHARS) {
    messages.push('execution.endpoint exceeds maximum length');
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      messages.push('execution.endpoint must be an http or https URL');
    }
  } catch {
    messages.push('execution.endpoint must be an http or https URL');
  }
  const auth = asRecord(exec.auth);
  if (!AUTH_TYPES.has(auth.type)) {
    messages.push('execution.auth.type must be none, bearer, or apiKey');
  }
  if (auth.type === 'apiKey' && !String(auth.headerName || '').trim()) {
    messages.push('apiKey auth requires headerName');
  }
}

function validateDocument(spec) {
  if (looksLikeOpenApi(spec) || isMcpToolsSpecDocument(spec)) {
    return {
      ok: false,
      messages: ['spec is not a GraphQL v1 upload envelope'],
    };
  }
  if (!isGraphqlSpecUpload(spec)) {
    return {
      ok: false,
      messages: [
        'invalid GraphQL upload: must wrap a document with kind "graphql" and schemaVersion 1',
      ],
    };
  }

  const messages = [];
  const document = asRecord(asRecord(spec).document);
  const info = asRecord(document.info);
  if (!String(info.title || '').trim()) {
    messages.push('document.info.title is required');
  }
  if (!isSemver(info.version)) {
    messages.push(
      'document.info.version must be a semantic version like "1.0.0"',
    );
  }
  const schemaSdl = typeof document.schema === 'string' ? document.schema : '';
  if (!schemaSdl.trim()) {
    messages.push('document.schema is required');
  } else {
    validateSdl(schemaSdl, messages);
  }
  if (
    document.initialQuery &&
    Buffer.byteLength(String(document.initialQuery), 'utf8') >
      GRAPHQL_INITIAL_QUERY_MAX_BYTES
  ) {
    messages.push('initialQuery exceeds maximum size');
  }
  if (asRecord(spec).execution !== undefined) {
    validateExecution(asRecord(spec).execution, messages);
  }
  return {ok: messages.length === 0, messages};
}

async function validate(_specPath, document) {
  const result = validateDocument(document);
  if (!result.ok) {
    throw new Error(result.messages.join('; '));
  }
  return document;
}

module.exports = {
  id: 'graphql',
  isGraphqlSpecDocument,
  isGraphqlSpecUpload,
  validateDocument,
  validate,
};
