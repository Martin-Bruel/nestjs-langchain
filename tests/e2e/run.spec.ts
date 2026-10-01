import { Test, TestingModule } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import {
  Agent,
  AgentRunError,
  getAgentToken,
  LangChainModule,
  LangChainModuleOptions,
  ModelOption,
  RunErrorEvent,
} from '../../lib/index.js';

/** Answers in content blocks, the way Anthropic and Bedrock do. */
class BlockContentModel extends BaseChatModel {
  _llmType(): string {
    return 'block-content';
  }

  // Required by `createAgent`, even with nothing to bind.
  bindTools(): this {
    return this;
  }

  _generate(): Promise<ChatResult> {
    const message = new AIMessage({
      content: [
        { type: 'text', text: 'forty' },
        { type: 'text', text: '-two' },
      ],
    });
    return Promise.resolve({ generations: [{ text: '', message }] });
  }
}

/** Fails every call, the way a provider does when it rate limits. */
class FailingModel extends BaseChatModel {
  constructor(readonly error: Error) {
    // No retry, so the failure surfaces at once.
    super({ maxRetries: 0 });
  }

  _llmType(): string {
    return 'failing';
  }

  bindTools(): this {
    return this;
  }

  _generate(): Promise<ChatResult> {
    return Promise.reject(this.error);
  }
}

const boot = async (
  model: ModelOption,
  extra: Partial<LangChainModuleOptions> & { name?: string } = {},
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [LangChainModule.register({ model, ...extra })],
  }).compile();
  await app.init();
  return app;
};

describe('run', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  // #57: empty `response_metadata` used to throw `No response from agent`.
  it('returns the answer from a model that sets no finish_reason', async () => {
    app = await boot(new FakeListChatModel({ responses: ['42'] }));

    await expect(app.get(Agent).run('question')).resolves.toBe('42');
  });

  it('returns the answer when it arrives as content blocks', async () => {
    app = await boot(new BlockContentModel({}));

    await expect(app.get(Agent).run('question')).resolves.toBe('forty-two');
  });

  it('raises when the model replies with nothing, and says so', async () => {
    app = await boot(new FakeListChatModel({ responses: [''] }));

    const run = app.get(Agent).run('question');

    await expect(run).rejects.toBeInstanceOf(AgentRunError);
    await expect(run).rejects.toThrow(
      'The model replied with no text content.',
    );
  });

  it('raises an AgentRunError when run before the application bootstrapped', async () => {
    app = await Test.createTestingModule({
      imports: [
        LangChainModule.register({
          model: new FakeListChatModel({ responses: ['42'] }),
        }),
      ],
    }).compile();

    // compile() alone: onModuleInit never ran.
    const run = app.get(Agent).run('question');

    await expect(run).rejects.toBeInstanceOf(AgentRunError);
    await expect(run).rejects.toMatchObject({
      agent: 'default',
      message:
        'The agent ran before the application bootstrapped. ' +
        'Call `app.init()` or `app.listen()` first.',
    });
  });

  describe('when a run fails', () => {
    const rateLimited = new Error('rate limited');

    it('wraps a provider error, keeping it as the cause', async () => {
      app = await boot(new FailingModel(rateLimited), { name: 'MATH' });

      const failure = app.get<Agent>(getAgentToken('MATH')).run('question');

      await expect(failure).rejects.toBeInstanceOf(AgentRunError);
      await expect(failure).rejects.toMatchObject({
        agent: 'MATH',
        message: "The MATH agent's run failed: rate limited",
        cause: rateLimited,
      });
    });

    it('hands the observer the very error the caller receives', async () => {
      const errors: RunErrorEvent[] = [];
      const onRunFinish = vi.fn();

      app = await boot(new FailingModel(rateLimited), {
        observer: {
          onRunError: (event) => void errors.push(event),
          onRunFinish,
        },
      });

      const caught = await app
        .get(Agent)
        .run('question')
        .catch((error: unknown) => error);

      expect(errors).toEqual([
        { agent: 'default', durationMs: expect.any(Number), error: caught },
      ]);
      expect(errors[0].error).toBe(caught);
      expect(onRunFinish).not.toHaveBeenCalled();
    });

    it('reports a reply it rejects, and does not count it as finished', async () => {
      const onRunError = vi.fn();
      const onRunFinish = vi.fn();

      app = await boot(new FakeListChatModel({ responses: [''] }), {
        observer: { onRunError, onRunFinish },
      });

      await expect(app.get(Agent).run('question')).rejects.toThrow(
        AgentRunError,
      );
      expect(onRunError).toHaveBeenCalledOnce();
      expect(onRunFinish).not.toHaveBeenCalled();
    });

    it('reports a run before the application bootstrapped', async () => {
      const onRunError = vi.fn();

      app = await Test.createTestingModule({
        imports: [
          LangChainModule.register({
            model: new FakeListChatModel({ responses: ['42'] }),
            observer: { onRunError },
          }),
        ],
      }).compile();

      await expect(app.get(Agent).run('question')).rejects.toThrow(
        AgentRunError,
      );
      expect(onRunError).toHaveBeenCalledOnce();
    });

    it('still throws the run error when the observer throws on it', async () => {
      const logged: string[] = [];

      app = await Test.createTestingModule({
        imports: [
          LangChainModule.register({
            model: new FailingModel(rateLimited),
            observer: {
              onRunError: () => {
                throw new Error('metrics down');
              },
            },
          }),
        ],
      })
        .setLogger({
          log: () => undefined,
          warn: () => undefined,
          error: (message: unknown) => void logged.push(String(message)),
        })
        .compile();
      await app.init();

      await expect(app.get(Agent).run('question')).rejects.toThrow(
        "The agent's run failed: rate limited",
      );
      expect(logged).toContain('the observer failed: metrics down');
    });
  });
});
