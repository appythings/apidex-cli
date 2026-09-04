const {runChecks} = require('../../src/validate/run-checks');

describe('runChecks', () => {
  it('runs every check even after an earlier one fails', async () => {
    const results = await runChecks({}, [
      {
        id: 'a',
        async run() {
          return {ok: false, messages: ['first failed']};
        },
      },
      {
        id: 'b',
        async run() {
          return {ok: true, messages: []};
        },
      },
    ]);
    expect(results).toEqual([
      {id: 'a', ok: false, messages: ['first failed']},
      {id: 'b', ok: true, messages: []},
    ]);
  });

  it('treats a missing result as a failed check with no messages', async () => {
    const results = await runChecks({}, [
      {id: 'empty', async run() {}},
    ]);
    expect(results).toEqual([{id: 'empty', ok: false, messages: []}]);
  });
});
