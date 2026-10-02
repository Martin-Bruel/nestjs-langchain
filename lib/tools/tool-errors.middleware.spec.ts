import { ToolInvocationError } from 'langchain';

// Watches LangChain, not our code: Dependabot's weekly bump runs it.
describe('LangChain upstream', () => {
  // Fails once langchain-ai/langchainjs#11830 is released: LangChain's own
  // text no longer needs rewriting. Drop the schema branch of
  // `toolErrorsWithoutStack`, and the whole middleware unless something else
  // relies on it (reporting rejected calls, #177; user middlewares, #152).
  it('still puts the stack in a ToolInvocationError', () => {
    const error = new ToolInvocationError(new Error('bad'), {
      name: 'add',
      args: {},
    });

    expect(error.message).toMatch(/\n\s+at /);
  });
});
