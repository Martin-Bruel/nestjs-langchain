import { AgentRunError } from './agent-run.error.js';
import { AgentContextError } from './agent-context.error.js';

describe('AgentContextError', () => {
  it('is an AgentRunError, with the agent and the cause', () => {
    const cause = new Error('reason');
    const error = new AgentContextError('No context.', 'SUPPORT', { cause });

    expect(error).toBeInstanceOf(AgentRunError);
    expect(error).toMatchObject({
      name: 'AgentContextError',
      message: 'No context.',
      agent: 'SUPPORT',
      cause,
    });
  });
});
