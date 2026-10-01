import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, Agent } from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';

// `compile()` never runs lifecycle hooks, so the model is only resolved once
// `init()` is called. Hence `init()` everywhere below.
describe('model option', () => {
  it('boots from a chat model instance without contacting a provider', async () => {
    const model = new FakeListChatModel({ responses: ['42'] });

    const app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.register({ model, tools: [MathModule] }),
      ],
    }).compile();

    // No apiKey, no provider package, no network.
    await expect(app.init()).resolves.toBeDefined();

    expect(app.get(Agent)).toBeInstanceOf(Agent);
    await app.close();
  });

  it('resolves a configuration object through initChatModel', async () => {
    const app = await Test.createTestingModule({
      imports: [
        LangChainModule.register({
          model: { model: 'openai:gpt-4o', apiKey: 'fake' },
        }),
      ],
    }).compile();

    // `@langchain/openai` is a devDependency because initChatModel imports the
    // provider dynamically. Without it installed this asserts its absence
    // rather than the branch. Building the client contacts nothing, so the
    // fake key is never used.
    await expect(app.init()).resolves.toBeDefined();

    expect(app.get(Agent)).toBeInstanceOf(Agent);
    await app.close();
  });

  // #169: the type is structural, so the members `createAgent` needs are
  // checked when the agent assembles, not only by the compiler.
  it('refuses to boot from an object that is not a chat model', async () => {
    const notAModel = {
      invoke: () => Promise.resolve('x'),
      _streamResponseChunks: () => undefined,
    };

    const failing = await Test.createTestingModule({
      imports: [LangChainModule.register({ model: notAModel })],
    }).compile();

    await expect(failing.init()).rejects.toThrow(
      "`model` is neither a LangChain chat model nor a `{ model: 'provider:name' }` " +
        'configuration. Pass a chat model instance (e.g. `new ChatOpenAI(...)`) ' +
        'or a configuration.',
    );
  });
});
