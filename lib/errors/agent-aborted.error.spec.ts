import { AgentRunError } from './agent-run.error.js';
import { AgentAbortedError } from './agent-aborted.error.js';

describe('AgentAbortedError', () => {
  it('is an AgentRunError, with the agent and the cause', () => {
    const cause = new Error('reason');
    const error = new AgentAbortedError('Stopped.', 'SUPPORT', { cause });

    expect(error).toBeInstanceOf(AgentRunError);
    expect(error).toMatchObject({
      name: 'AgentAbortedError',
      message: 'Stopped.',
      agent: 'SUPPORT',
      cause,
    });
  });
});
