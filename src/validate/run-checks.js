async function runChecks(ctx, checks) {
  const results = [];
  for (const check of checks) {
    const result = await check.run(ctx);
    results.push({
      id: check.id,
      ok: Boolean(result && result.ok),
      messages: (result && result.messages) || [],
    });
  }
  return results;
}

module.exports = {runChecks};
