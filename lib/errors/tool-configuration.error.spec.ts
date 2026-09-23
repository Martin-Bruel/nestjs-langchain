import { ToolConfigurationError } from './tool-configuration.error.js';

describe('ToolConfigurationError', () => {
  it('counts a single problem in the singular', () => {
    expect(new ToolConfigurationError(['first']).message).toMatch(
      /found 1 problem with the tools/,
    );
  });

  it('counts several problems in the plural', () => {
    expect(new ToolConfigurationError(['first', 'second']).message).toMatch(
      /found 2 problems with the tools/,
    );
  });

  it('lists every problem', () => {
    const error = new ToolConfigurationError(['first', 'second']);

    expect(error.message).toContain('  - first');
    expect(error.message).toContain('  - second');
    expect(error.problems).toEqual(['first', 'second']);
  });
});
