const {nodesMatching, targetMatches} = require('../../src/validate/jsonpath');

describe('validate jsonpath', () => {
  const spec = {
    info: {title: 'Pets'},
    paths: {
      '/pets': {get: {summary: 'List'}},
    },
  };

  it('matches a target that selects a node', () => {
    expect(targetMatches(spec, '$.info')).toBe(true);
    expect(nodesMatching(spec, "$.paths['/pets'].get").length).toBe(1);
  });

  it('treats a target that matches zero nodes as a miss', () => {
    expect(targetMatches(spec, "$.paths['/missing']")).toBe(false);
  });

  it('treats empty or missing targets as a miss', () => {
    expect(targetMatches(null, '$.info')).toBe(false);
    expect(targetMatches(spec, '')).toBe(false);
  });

  it('returns no nodes when JSONPath throws or returns a non-array', () => {
    jest.resetModules();
    jest.doMock('jsonpath-plus', () => ({
      JSONPath: () => {
        throw new Error('bad path');
      },
    }));
    const throwing = require('../../src/validate/jsonpath');
    expect(throwing.targetMatches({info: {}}, '$.info')).toBe(false);

    jest.resetModules();
    jest.doMock('jsonpath-plus', () => ({
      JSONPath: () => ({not: 'an array'}),
    }));
    const wrapped = require('../../src/validate/jsonpath');
    expect(wrapped.nodesMatching({info: {}}, '$.info')).toEqual([]);
  });
});
