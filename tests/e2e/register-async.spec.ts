import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';
import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Agent,
  getAgentToken,
  LangChainModule,
  LangChainModuleOptions,
  LangChainOptionsFactory,
} from '../../lib/index.js';
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

@Injectable()
class MathAgentOptions implements LangChainOptionsFactory {
  constructor(private readonly settings: Settings) {}

  createLangChainOptions(): LangChainModuleOptions {
    return {
      model: this.settings.model('from the class'),
      systemPrompt: this.settings.prompt,
      tools: [MathModule],
    };
  }
}

@Injectable()
class LaterAgentOptions implements LangChainOptionsFactory {
  async createLangChainOptions(): Promise<LangChainModuleOptions> {
    await Promise.resolve();
    return { model: fakeModel().respond(new AIMessage('later')) };
  }
}

@Injectable()
class SharedAgentOptions implements LangChainOptionsFactory {
  calls = 0;

  createLangChainOptions(): LangChainModuleOptions {
    this.calls += 1;
    return { model: fakeModel().respond(new AIMessage('shared')) };
  }
}

@Module({ providers: [SharedAgentOptions], exports: [SharedAgentOptions] })
class SharedOptionsModule {}

describe('registerAsync with an options class', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('builds a named agent from a class injecting another module', async () => {
    app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.registerAsync({
          name: 'MATH',
          imports: [SettingsModule],
          useClass: MathAgentOptions,
        }),
      ],
    }).compile();
    await app.init();

    await expect(
      app.get<Agent>(getAgentToken('MATH')).run('?'),
    ).resolves.toMatchObject({ output: 'from the class' });
  });

  it('awaits an async options method', async () => {
    app = await Test.createTestingModule({
      imports: [LangChainModule.registerAsync({ useClass: LaterAgentOptions })],
    }).compile();
    await app.init();

    await expect(app.get(Agent).run('?')).resolves.toMatchObject({
      output: 'later',
    });
  });

  it('reuses the existing instance with useExisting', async () => {
    app = await Test.createTestingModule({
      imports: [
        SharedOptionsModule,
        LangChainModule.registerAsync({
          name: 'SHARED',
          imports: [SharedOptionsModule],
          useExisting: SharedAgentOptions,
        }),
      ],
    }).compile();
    await app.init();

    await expect(
      app.get<Agent>(getAgentToken('SHARED')).run('?'),
    ).resolves.toMatchObject({ output: 'shared' });
    // The instance the other module exports, not a copy of its own.
    const exported = app
      .select(SharedOptionsModule)
      .get(SharedAgentOptions, { strict: true });

    expect(exported.calls).toBe(1);
  });
});
