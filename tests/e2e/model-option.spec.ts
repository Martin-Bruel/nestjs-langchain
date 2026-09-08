import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, LangChainService } from '../../lib';
import { MathModule } from '../src/math/math.module';

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

  it('still hands a configuration object to initChatModel', async () => {
    const app = await Test.createTestingModule({
      imports: [
        LangChainModule.register({
          model: { model: 'openai:gpt-4o', apiKey: 'fake' },
        }),
      ],
    }).compile();

    // initChatModel loads the provider with a dynamic `import()`, which Jest
    // refuses without --experimental-vm-modules. Only reachable through
    // initChatModel, so it is what separates the two branches. Rewrite against
    // a fake provider the day that flag is on.
    await expect(app.init()).rejects.toThrow();
  });
});
