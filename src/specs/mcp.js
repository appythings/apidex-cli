function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function isSemver(value) {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      value,
    )
  );
}

function isMcpToolsSpecDocument(spec) {
  const root = asRecord(spec);
  if (typeof root.openapi === 'string') {
    return false;
  }
  if (root.swagger === '2.0' || root.swagger === '2') {
    return false;
  }
  return Array.isArray(root.tools);
}

function validateDocument(spec) {
  if (!isMcpToolsSpecDocument(spec)) {
    return {
      ok: false,
      messages: [
        'invalid MCP tools document: must have a tools array and must not declare openapi/swagger',
      ],
    };
  }

  const messages = [];
  const root = asRecord(spec);
  const rawVersion = asRecord(root.info).version;
  if (
    rawVersion !== undefined &&
    rawVersion !== null &&
    !isSemver(rawVersion)
  ) {
    messages.push('info.version must be a semantic version like "1.0.0"');
  }

  const seenToolNames = new Set();
  root.tools.forEach((tool_, index) => {
    const name = stringValue(asRecord(tool_).name).trim();
    if (!name) {
      messages.push(`tool ${index + 1} is missing a name`);
      return;
    }
    if (seenToolNames.has(name)) {
      messages.push(`duplicate tool name "${name}"`);
      return;
    }
    seenToolNames.add(name);
  });

  if (root.resources !== undefined && !Array.isArray(root.resources)) {
    messages.push('resources must be an array');
  }
  if (Array.isArray(root.resources)) {
    root.resources.forEach((resource_, index) => {
      const resource = asRecord(resource_);
      if (
        !stringValue(resource.name).trim() &&
        !stringValue(resource.uri).trim()
      ) {
        messages.push(`resource ${index + 1} needs a name or uri`);
      }
    });
  }

  if (root.prompts !== undefined && !Array.isArray(root.prompts)) {
    messages.push('prompts must be an array');
  }
  if (Array.isArray(root.prompts)) {
    root.prompts.forEach((prompt_, index) => {
      if (!stringValue(asRecord(prompt_).name).trim()) {
        messages.push(`prompt ${index + 1} is missing a name`);
      }
    });
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
  id: 'mcp',
  isMcpToolsSpecDocument,
  validateDocument,
  validate,
};
