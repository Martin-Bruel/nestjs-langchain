import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';
import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Agent, getAgentToken, LangChainModule } from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';

// What a `ConfigService` would be: a provider of another module, injected
// into the factory.
@Injectable()
class Settings {
  readonly prompt = 'You add numbers.';

  model(answer: string) {
    return fakeModel().respond(new AIMessage(answer));
  }
}

@Module({ providers: [Settings], exports: [Settings] })
class SettingsModule {}

describe('registerAsync at runtime', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('builds the unnamed agent from a factory', async () => {
    app = await Test.createTestingModule({
      imports: [
        LangChainModule.registerAsync({
          useFactory: () => ({
            model: fakeModel().respond(new AIMessage('42')),
          }),
        }),
      ],
    }).compile();
    await app.init();

    await expect(app.get(Agent).run('?')).resolves.toMatchObject({
      output: '42',
    });
  });

  it('builds a named agent from a factory injecting another module', async () => {
    app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.registerAsync({
          name: 'MATH',
          imports: [SettingsModule],
          inject: [Settings],
          useFactory: (settings: Settings) => ({
            model: settings.model('from the factory'),
            systemPrompt: settings.prompt,
            tools: [MathModule],
          }),
        }),
      ],
    }).compile();
    await app.init();

    await expect(
      app.get<Agent>(getAgentToken('MATH')).run('?'),
    ).resolves.toMatchObject({ output: 'from the factory' });
  });

  it('awaits an async factory', async () => {
    app = await Test.createTestingModule({
      imports: [
        LangChainModule.registerAsync({
          name: 'LATER',
          useFactory: async () => {
            await Promise.resolve();
            return { model: fakeModel().respond(new AIMessage('later')) };
          },
        }),
      ],
    }).compile();
    await app.init();

    await expect(
      app.get<Agent>(getAgentToken('LATER')).run('?'),
    ).resolves.toMatchObject({ output: 'later' });
  });
});
