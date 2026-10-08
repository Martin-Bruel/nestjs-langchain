import { AgentRunError } from './agent-run.error.js';

describe('AgentRunError', () => {
  it('carries the agent and the cause', () => {
    const cause = new Error('provider down');
    const error = new AgentRunError('The run failed.', 'MATH', { cause });

    expect(error).toMatchObject({
      name: 'AgentRunError',
      message: 'The run failed.',
      agent: 'MATH',
      cause,
    });
  });

  // #139: a class field would set `cause` on every error, given or not.
  it('has no cause when none is given', () => {
    expect('cause' in new AgentRunError('The run failed.', 'MATH')).toBe(false);
  });

  it('keeps a cause given as undefined, as `Error` does', () => {
    const error = new AgentRunError('The run failed.', 'MATH', {
      cause: undefined,
    });

    expect(Object.hasOwn(error, 'cause')).toBe(true);
  });
});
