const path = require('path');
const {runValidate} = require('../../src/validate');
const {runValidateCli} = require('../../src/commands/validate');

const fixtures = path.join(__dirname, '../fixtures/validate');

describe('validate command', () => {
  it('exits 0 for a valid manifest', async () => {
    const log = jest.fn();
    const exit = jest.fn();
    await runValidateCli(
      {manifestPath: path.join(fixtures, 'manifest-ok.yaml')},
      {log, exit},
    );
    expect(exit).toHaveBeenCalledWith(0);
    expect(log.mock.calls.some(args => String(args[0]).startsWith('ok '))).toBe(
      true,
    );
  });

  it('exits 1 when a check fails', async () => {
    const log = jest.fn();
    const exit = jest.fn();
    await runValidateCli(
      {manifestPath: path.join(fixtures, 'manifest-zero-target.yaml')},
      {log, exit},
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(
      log.mock.calls.some(args => String(args[0]).startsWith('FAIL ')),
    ).toBe(true);
  });

  it('exits 1 when options cannot be resolved', async () => {
    const log = jest.fn();
    const exit = jest.fn();
    await runValidateCli({}, {log, exit});
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/manifest path/));
  });

  it('still reports later checks after an earlier failure', async () => {
    const {ok, results} = await runValidate({
      manifestPath: path.join(fixtures, 'manifest-missing-file.yaml'),
    });
    expect(ok).toBe(false);
    expect(results.map(result => result.id)).toEqual([
      'overlay-files',
      'overlay-locales',
      'overlay-shape',
      'overlay-targets',
      'required-locales',
    ]);
    expect(results.find(result => result.id === 'overlay-files').ok).toBe(
      false,
    );
  });

  it('uses console.log and process.exit when deps are omitted', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await runValidateCli({
      manifestPath: path.join(fixtures, 'manifest-ok.yaml'),
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
