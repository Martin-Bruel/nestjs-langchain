import { Test } from '@nestjs/testing';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { Agent, LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math.module.js';

describe('an agent with the calculator tool', () => {
  it('calls the tool and answers with its result', async () => {
    // Replays a tool call, then an answer: no provider key, no network.
    const model = fakeModel()
      .respondWithTools([{ name: 'calculator', args: { a: 12, op: '*', b: 7 } }])
      .respond(new AIMessage('12 * 7 = 84'));

    const moduleRef = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.register({ model, tools: [MathModule] }),
      ],
    }).compile();
    // The agent is built on init, which `compile()` does not run.
    await moduleRef.init();

    const { output, tools } = await moduleRef
      .get(Agent)
      .run('What is 12 * 7?');

    expect(tools).toEqual(['calculator']);
    expect(output).toBe('12 * 7 = 84');
    // What `MathService.calculator` returned, as the model received it.
    expect(model.calls[1].messages.at(-1)?.text).toBe('84');

    await moduleRef.close();
  });
});
