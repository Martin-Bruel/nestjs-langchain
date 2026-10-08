import { fakeModel } from '@langchain/core/testing';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { Injectable, Module, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Agent, LangChainModule, Tool, ToolParam } from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';

@Injectable()
class CollectionService {
  @Tool({ description: 'Counts the documents of a collection.' })
  count(@ToolParam({ name: 'collection' }) collection: string): number {
    throw new Error(`no collection named "${collection}"`);
  }
}

@Module({ providers: [CollectionService] })
class CollectionModule {}

// The last message of the model's `call`-th call: a tool's result.
const toolResult = (model: ReturnType<typeof fakeModel>, call: number) => {
  const messages: BaseMessage[] = model.calls[call].messages;
  return messages[messages.length - 1];
};

const boot = async (model: ReturnType<typeof fakeModel>, tools: Type) => {
  const app = await Test.createTestingModule({
    imports: [tools, LangChainModule.register({ model, tools: [tools] })],
  }).compile();
  await app.init();
  return app;
};

describe('a failed tool call, as the model sees it', () => {
  // The error goes back to the model as the tool's result, so the run carries
  // on and the model may correct itself.
  it('gives arguments the schema rejects back without a stack', async () => {
    const model = fakeModel()
      .respondWithTools([{ name: 'add', args: { a: 'one', b: 2 } }])
      .respondWithTools([{ name: 'add', args: { a: 1, b: 2 } }])
      .respond(new AIMessage('The result is 3.'));
    const app = await boot(model, MathModule);

    await expect(app.get(Agent).run('1 + 2?')).resolves.toMatchObject({
      output: 'The result is 3.',
      tools: ['add', 'add'],
    });

    const rejected = toolResult(model, 1);
    expect(rejected.type).toBe('tool');
    // #176: LangChain's own text, with the message where it put the stack.
    expect(rejected.text).toBe(
      `Error invoking tool 'add' with kwargs {"a":"one","b":2} with error: ` +
        'Error: Received tool input did not match expected schema\n\n' +
        '✖ Invalid input: expected number, received string\n  → at a\n' +
        ' Please fix the error and try again.',
    );
    expect(toolResult(model, 2).text).toBe('3');

    await app.close();
  });

  it("gives LangChain's answer to a tool the agent does not have", async () => {
    const model = fakeModel()
      .respondWithTools([{ name: 'multiply', args: { a: 2, b: 3 } }])
      .respond(new AIMessage('I cannot multiply.'));
    const app = await boot(model, MathModule);

    await app.get(Agent).run('2 * 3?');

    expect(toolResult(model, 1).text).toBe(
      'Error: multiply is not a valid tool, try one of [add].',
    );

    await app.close();
  });

  it("gives a method's own error back, without a stack", async () => {
    const model = fakeModel()
      .respondWithTools([{ name: 'count', args: { collection: 'users' } }])
      .respond(new AIMessage('There is no such collection.'));
    const app = await boot(model, CollectionModule);

    await app.get(Agent).run('How many users?');

    expect(toolResult(model, 1).text).toBe(
      'Error: no collection named "users"\n Please fix your mistakes.',
    );

    await app.close();
  });
});
