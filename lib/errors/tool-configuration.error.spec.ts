import { ToolConfigurationError } from './tool-configuration.error.js';

describe('ToolConfigurationError', () => {
  it('counts a single problem in the singular', () => {
    expect(new ToolConfigurationError(['first'], 'default').message).toMatch(
      /found 1 problem with the tools/,
    );
  });

  it('counts several problems in the plural', () => {
    expect(
      new ToolConfigurationError(['first', 'second'], 'default').message,
    ).toMatch(/found 2 problems with the tools/);
  });

  it('lists every problem', () => {
    const error = new ToolConfigurationError(['first', 'second'], 'default');

    expect(error.message).toContain('  - first');
    expect(error.message).toContain('  - second');
    expect(error.problems).toEqual(['first', 'second']);
  });

  it('names the agent, and carries it', () => {
    const error = new ToolConfigurationError(['first'], 'MATH');

    expect(error).toMatchObject({
      name: 'ToolConfigurationError',
      agent: 'MATH',
      message:
        'nestjs-langchain found 1 problem with the tools of the MATH agent:\n' +
        '  - first',
    });
  });

  it('names the unnamed agent as "the agent"', () => {
    expect(new ToolConfigurationError(['first'], 'default').message).toMatch(
      /^nestjs-langchain found 1 problem with the tools of the agent:\n/,
    );
  });
});
