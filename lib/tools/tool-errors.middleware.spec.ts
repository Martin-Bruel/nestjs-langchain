import { ToolInvocationError } from 'langchain';

// Watches LangChain, not our code: Dependabot's weekly bump runs it.
describe('LangChain upstream', () => {
  // Fails once langchain-ai/langchainjs#11830 is released: LangChain's own
  // text no longer needs rewriting. Leave the schema text of `toolErrors` to
  // LangChain; the middleware stays to report rejected calls (#177).
  it('still puts the stack in a ToolInvocationError', () => {
    const error = new ToolInvocationError(new Error('bad'), {
      name: 'add',
      args: {},
    });

    expect(error.message).toMatch(/\n\s+at /);
  });
});
