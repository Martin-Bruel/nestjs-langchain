import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { createAgent, ToolInvocationError } from 'langchain';

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

  // Fails once LangChain sends an `extract-` call it does not know to the
  // tools, as it does any unknown one: `unknownTools` can then stop answering
  // it (#264).
  it('still ends the run on an `extract-` call it does not know', async () => {
    const model = fakeModel()
      .respond(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'x1', name: 'extract-anything', args: {} }],
        }),
      )
      .respond(new AIMessage('done'));

    await createAgent({ model, tools: [] }).invoke({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(model.calls).toHaveLength(1);
  });
});
