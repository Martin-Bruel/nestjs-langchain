import { AgentRunError } from './agent-run.error.js';
import { AgentRecursionLimitError } from './agent-recursion-limit.error.js';

describe('AgentRecursionLimitError', () => {
  it('is an AgentRunError, with the agent and the cause', () => {
    const cause = new Error('reason');
    const error = new AgentRecursionLimitError('Stopped.', 'SUPPORT', {
      cause,
    });

    expect(error).toBeInstanceOf(AgentRunError);
    expect(error).toMatchObject({
      name: 'AgentRecursionLimitError',
      message: 'Stopped.',
      agent: 'SUPPORT',
      cause,
    });
  });
});
