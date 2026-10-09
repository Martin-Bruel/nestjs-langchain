import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';
import { Test, TestingModule } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  Agent,
  AgentRunError,
  getAgentToken,
  LangChainModule,
  LangChainModuleOptions,
  ModelOption,
  RunErrorEvent,
} from '../../lib/index.js';
import { silentLogger } from '../fixtures/logging.js';

const boot = async (
  model: ModelOption,
  extra: Partial<LangChainModuleOptions> & { name?: string } = {},
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [LangChainModule.register({ model, ...extra })],
  })
    .setLogger(silentLogger)
    .compile();
  await app.init();
  return app;
};

describe('run', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns a completed run carrying the answer', async () => {
    app = await boot(new FakeListChatModel({ responses: ['42'] }));

    const run = await app.get(Agent).run('question');

    // No `tokens`: this model reports no usage.
    expect(run).toEqual({
      status: 'completed',
      output: '42',
      tools: [],
      durationMs: expect.any(Number),
    });
  });

  it('carries on the model across runs, as a conversation would', async () => {
    app = await boot(
      fakeModel()
        .respond(new AIMessage('first'))
        .respond(new AIMessage('second')),
    );

    await expect(app.get(Agent).run('one')).resolves.toMatchObject({
      output: 'first',
    });
    await expect(app.get(Agent).run('two')).resolves.toMatchObject({
      output: 'second',
    });
  });

  // #57: empty `response_metadata` used to throw `No response from agent`.
  it('returns the answer from a model that sets no finish_reason', async () => {
    app = await boot(new FakeListChatModel({ responses: ['42'] }));

    await expect(app.get(Agent).run('question')).resolves.toMatchObject({
      output: '42',
    });
  });

  it('returns the answer when it arrives as content blocks', async () => {
    app = await boot(
      // Content blocks, the way Anthropic and Bedrock answer.
      fakeModel().respond(
        new AIMessage({
          content: [
            { type: 'text', text: 'forty' },
            { type: 'text', text: '-two' },
          ],
        }),
      ),
    );

    await expect(app.get(Agent).run('question')).resolves.toMatchObject({
      output: 'forty-two',
    });
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
      app = await boot(fakeModel().respond(rateLimited), { name: 'MATH' });

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

      app = await boot(fakeModel().respond(rateLimited), {
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
            model: fakeModel().respond(rateLimited),
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
