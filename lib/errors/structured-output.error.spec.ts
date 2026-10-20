import { AgentRunError } from './agent-run.error.js';
import { StructuredOutputError } from './structured-output.error.js';

describe('StructuredOutputError', () => {
  it('is an AgentRunError, with the agent and the cause', () => {
    const cause = new Error('invalid');
    const error = new StructuredOutputError('No match.', 'SUPPORT', { cause });

    expect(error).toBeInstanceOf(AgentRunError);
    expect(error).toMatchObject({
      name: 'StructuredOutputError',
      message: 'No match.',
      agent: 'SUPPORT',
      cause,
    });
  });
});
