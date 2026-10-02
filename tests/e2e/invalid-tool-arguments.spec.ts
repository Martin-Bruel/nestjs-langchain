import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';
import { Test } from '@nestjs/testing';
import { Agent, LangChainModule } from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';

// The outcome pinned here is LangChain's: arguments the schema rejects never
// reach the method, and the error goes back to the model as the tool's result,
// so the run carries on and the model may correct itself.
describe('a tool call whose arguments the schema rejects', () => {
  it('hands the error back to the model and completes the run', async () => {
    const model = fakeModel()
      .respondWithTools([{ name: 'add', args: { a: 'one', b: 2 } }])
      .respondWithTools([{ name: 'add', args: { a: 1, b: 2 } }])
      .respond(new AIMessage('The result is 3.'));

    const app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.register({ model, tools: [MathModule] }),
      ],
    }).compile();
    await app.init();

    const run = await app.get(Agent).run('1 + 2?');

    expect(run).toMatchObject({
      status: 'completed',
      output: 'The result is 3.',
      tools: ['add', 'add'],
    });

    const [, second, third] = model.calls.map(({ messages }) => messages);
    const rejected = second[second.length - 1];
    expect(rejected.getType()).toBe('tool');
    expect(rejected.text).toContain(
      'Received tool input did not match expected schema',
    );

    expect(third[third.length - 1].text).toBe('3');

    await app.close();
  });
});
