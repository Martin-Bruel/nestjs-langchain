import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, LangChainService } from '../../lib/index.js';
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

    expect(app.get(LangChainService)).toBeInstanceOf(LangChainService);
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

    expect(app.get(LangChainService)).toBeInstanceOf(LangChainService);
    await app.close();
  });
});
