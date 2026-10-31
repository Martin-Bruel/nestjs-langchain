import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Agent,
  AgentAbortedError,
  AgentRecursionLimitError,
  AgentRunError,
  getAgentToken,
  InjectAgent,
  LangChainModule,
  LangChainModuleOptions,
  ModelOption,
  RunErrorEvent,
  Tool,
  ToolParam,
} from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';
import { silentLogger } from '../fixtures/logging.js';

const boot = async (
  model: ModelOption,
  extra: Partial<LangChainModuleOptions> & { name?: string } = {},
  imports: NonNullable<LangChainModuleOptions['tools']> = [MathModule],
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [
      ...imports,
      LangChainModule.register({ model, tools: imports, ...extra }),
    ],
  })
    .setLogger(silentLogger)
    .compile();
  await app.init();
  return app;
};

const addCall = () =>
  new AIMessage({
    content: '',
    tool_calls: [{ id: 'c1', name: 'add', args: { a: 1, b: 2 } }],
  });

// A model that calls `add` forever.
const looping = () => {
  const model = fakeModel();
  for (let i = 0; i < 30; i += 1) {
    model.respond(addCall());
  }
  return model;
};

describe('run limits', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('signal', () => {
    it('aborts before the run, without calling the model', async () => {
      const errors: RunErrorEvent[] = [];
      const model = fakeModel().respond(new AIMessage('never'));
      app = await boot(model, {
        observer: { onRunError: (event) => void errors.push(event) },
      });
      const reason = new Error('client left');

      const run = app
        .get(Agent)
        .run('question', { signal: AbortSignal.abort(reason) });

      await expect(run).rejects.toThrow(AgentAbortedError);
      await expect(run).rejects.toMatchObject({
        message: "The agent's run was aborted.",
        agent: 'default',
        cause: reason,
      });
      expect(model.callCount).toBe(0);
      expect(errors).toMatchObject([{ error: { name: 'AgentAbortedError' } }]);
    });

    it('aborts during a model call, before its tool calls run', async () => {
      const controller = new AbortController();
      const model = fakeModel()
        .respond(() => {
          controller.abort();
          return addCall();
        })
        .respond(new AIMessage('3'));
      const ran: string[] = [];
      app = await boot(model, {
        observer: { onToolStart: ({ tool }) => void ran.push(tool) },
      });

      await expect(
        app.get(Agent).run('1 + 2?', { signal: controller.signal }),
      ).rejects.toThrow(AgentAbortedError);
      expect(ran).toEqual([]);
      expect(model.callCount).toBe(1);
    });

    it('aborts at a deadline, as the README shows', async () => {
      app = await boot(
        new FakeListChatModel({ responses: ['late'], sleep: 500 }),
      );

      await expect(
        app.get(Agent).run('question', { signal: AbortSignal.timeout(20) }),
      ).rejects.toMatchObject({
        name: 'AgentAbortedError',
        cause: { name: 'TimeoutError' },
      });
    });

    it('keeps a reason that is not an Error as the cause', async () => {
      const controller = new AbortController();
      app = await boot(
        fakeModel().respond(() => {
          controller.abort('client left');
          return addCall();
        }),
      );

      await expect(
        app.get(Agent).run('1 + 2?', { signal: controller.signal }),
      ).rejects.toMatchObject({
        name: 'AgentAbortedError',
        cause: 'client left',
      });
    });

    it('aborts during a tool call, without sending its result to the model', async () => {
      const controller = new AbortController();
      let finish = () => {};

      @Injectable()
      class SlowService {
        @Tool({ description: 'Takes its time.' })
        async slow(): Promise<string> {
          controller.abort();
          await new Promise<void>((resolve) => (finish = resolve));
          return 'done';
        }
      }

      @Module({ providers: [SlowService], exports: [SlowService] })
      class SlowModule {}

      const model = fakeModel()
        .respondWithTools([{ name: 'slow', args: {} }])
        .respond(new AIMessage('never'));
      app = await boot(model, {}, [SlowModule]);

      await expect(
        app.get(Agent).run('go', { signal: controller.signal }),
      ).rejects.toThrow(AgentAbortedError);
      finish();
      expect(model.callCount).toBe(1);
    });

    it('stops an agent run from a tool, which inherits the signal', async () => {
      const controller = new AbortController();
      let inner: Promise<unknown> = Promise.resolve();

      @Injectable()
      class AskService {
        constructor(@InjectAgent('INNER') private readonly agent: Agent) {}

        @Tool({ description: 'Asks the inner agent.' })
        ask(@ToolParam({ name: 'q' }) q: string): string {
          inner = this.agent.run(q).catch((error: unknown) => error);
          return 'asked';
        }
      }

      const innerModel = fakeModel()
        .respond(() => {
          controller.abort();
          return addCall();
        })
        .respond(new AIMessage('3'));

      @Module({
        imports: [
          MathModule,
          LangChainModule.register({
            name: 'INNER',
            model: innerModel,
            tools: [MathModule],
          }),
        ],
        providers: [AskService],
        exports: [AskService],
      })
      class AskModule {}

      app = await Test.createTestingModule({
        imports: [
          AskModule,
          LangChainModule.register({
            name: 'OUTER',
            model: fakeModel()
              .respondWithTools([{ name: 'ask', args: { q: '1 + 2?' } }])
              .respond(new AIMessage('never')),
            tools: [AskModule],
          }),
        ],
      })
        .setLogger(silentLogger)
        .compile();
      await app.init();

      await expect(
        app
          .get<Agent>(getAgentToken('OUTER'))
          .run('go', { signal: controller.signal }),
      ).rejects.toThrow(AgentAbortedError);
      await expect(inner).resolves.toBeInstanceOf(AgentRunError);
      expect(innerModel.callCount).toBe(1);
    });

    it('leaves a run whose signal never aborts alone', async () => {
      app = await boot(
        fakeModel().respond(addCall()).respond(new AIMessage('3')),
      );

      await expect(
        app.get(Agent).run('1 + 2?', { signal: new AbortController().signal }),
      ).resolves.toMatchObject({ output: '3', tools: ['add'] });
    });
  });

  describe('recursionLimit', () => {
    it("stops a run at the agent's limit", async () => {
      const model = looping();
      app = await boot(model, { name: 'MATH', recursionLimit: 4 });

      const run = app.get<Agent>(getAgentToken('MATH')).run('1 + 2?');

      await expect(run).rejects.toThrow(AgentRecursionLimitError);
      await expect(run).rejects.toMatchObject({
        message:
          "The MATH agent's run reached its recursion limit of 4 steps " +
          'without an answer. Raise `recursionLimit`, or check what makes the ' +
          'model keep calling tools.',
        agent: 'MATH',
        cause: { name: 'GraphRecursionError' },
      });
      expect(model.callCount).toBe(2);
    });

    it("lets a run's limit override the agent's", async () => {
      const model = looping();
      app = await boot(model, { recursionLimit: 4 });

      await expect(
        app.get(Agent).run('1 + 2?', { recursionLimit: 6 }),
      ).rejects.toThrow('recursion limit of 6 steps');
      expect(model.callCount).toBe(3);
    });

    it("stops at LangGraph's default, without a limit set", async () => {
      app = await boot(looping());

      await expect(app.get(Agent).run('1 + 2?')).rejects.toThrow(
        "The agent's run reached its recursion limit without an answer.",
      );
    });

    it.each([0, 1.5, Number.NaN])(
      'rejects a run limit of %s before calling the model',
      async (recursionLimit) => {
        const model = fakeModel().respond(new AIMessage('never'));
        app = await boot(model);

        await expect(
          app.get(Agent).run('question', { recursionLimit }),
        ).rejects.toThrow(
          new AgentRunError(
            "The agent's `recursionLimit` must be an integer of at least 1, " +
              `not ${recursionLimit}.`,
            'default',
          ),
        );
        expect(model.callCount).toBe(0);
      },
    );

    it('fails the bootstrap on an invalid agent limit', async () => {
      await expect(
        boot(fakeModel(), { name: 'MATH', recursionLimit: Number.NaN }),
      ).rejects.toThrow(
        "The MATH agent's `recursionLimit` must be an integer of at least 1, " +
          'not NaN.',
      );
    });
  });
});
