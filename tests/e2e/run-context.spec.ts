import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';
import {
  Agent,
  AgentContextError,
  getAgentToken,
  InjectAgent,
  LangChainModule,
  ModelOption,
  RunErrorEvent,
  Tool,
  ToolContext,
  ToolParam,
} from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';
import { silentLogger } from '../fixtures/logging.js';

interface Caller {
  userId: string;
}

// What each `listOrders` call saw, in call order.
const seen: (Caller | undefined)[] = [];

@Injectable()
class OrdersService {
  @Tool({ description: 'Lists the orders of the current user.' })
  listOrders(
    @ToolParam({ name: 'status' }) status: string,
    @ToolContext() ctx: Caller | undefined,
  ): string {
    seen.push(ctx);
    return `2 ${status} orders`;
  }
}

@Module({ providers: [OrdersService], exports: [OrdersService] })
class OrdersModule {}

const listOrders = { name: 'listOrders', args: { status: 'open' } };

const boot = async (
  model: ModelOption,
  extra: { observer?: { onRunError: (event: RunErrorEvent) => void } } = {},
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [
      OrdersModule,
      LangChainModule.register({ model, tools: [OrdersModule], ...extra }),
    ],
  })
    .setLogger(silentLogger)
    .compile();
  await app.init();
  return app;
};

const text = (messages: BaseMessage[]) =>
  messages.map((message) => message.text).join('\n');

describe('run context', () => {
  let app: TestingModule | undefined;

  beforeEach(() => {
    seen.length = 0;
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('hands the run its context to the tool, never to the model', async () => {
    const model = fakeModel()
      .respondWithTools([listOrders])
      .respond(new AIMessage('You have 2 open orders.'));
    let schema: string[] = [];
    const bindTools = model.bindTools.bind(model);
    model.bindTools = (tools) => {
      const orders = tools.find(
        (tool) => 'name' in tool && tool.name === 'listOrders',
      );
      schema =
        orders && 'schema' in orders
          ? Object.keys((orders.schema as { shape: object }).shape)
          : [];
      return bindTools(tools);
    };
    app = await boot(model);
    const context = { userId: 'alice' };

    await app.get(Agent).run('My open orders?', { context });

    expect(seen).toEqual([context]);
    expect(seen[0]).toBe(context);
    expect(schema).toEqual(['status']);
    expect(text(model.calls.flatMap((call) => call.messages))).not.toContain(
      'alice',
    );
  });

  it('fails a run without context before calling the model', async () => {
    const errors: RunErrorEvent[] = [];
    const model = fakeModel().respondWithTools([listOrders]);
    app = await boot(model, {
      observer: { onRunError: (event) => void errors.push(event) },
    });

    const run = app.get(Agent).run('My open orders?');

    // #328: the same error as a context the `contextSchema` rejects.
    await expect(run).rejects.toThrow(AgentContextError);
    await expect(run).rejects.toThrow(
      "The agent's tool listOrders reads a context: pass `context` to run().",
    );
    expect(model.callCount).toBe(0);
    expect(errors).toMatchObject([{ error: { name: 'AgentContextError' } }]);
  });

  // #291: from untyped JavaScript.
  it('takes a null context as none', async () => {
    app = await boot(fakeModel().respondWithTools([listOrders]));

    await expect(
      // @ts-expect-error `null`, as untyped JavaScript may pass it
      app.get(Agent).run('My open orders?', { context: null }),
    ).rejects.toThrow(AgentContextError);
  });

  it('runs without context an agent whose tools read none', async () => {
    app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.register({
          model: fakeModel()
            .respondWithTools([{ name: 'add', args: { a: 1, b: 2 } }])
            .respond(new AIMessage('3')),
          tools: [MathModule],
        }),
      ],
    })
      .setLogger(silentLogger)
      .compile();
    await app.init();

    await expect(app.get(Agent).run('1 + 2?')).resolves.toMatchObject({
      output: '3',
    });
  });

  it('keeps the contexts of two concurrent runs apart', async () => {
    // Both runs call the tool before either gets its answer.
    const model = fakeModel()
      .respondWithTools([listOrders])
      .respondWithTools([listOrders])
      .respond(new AIMessage('done'))
      .respond(new AIMessage('done'));
    app = await boot(model);
    const agent = app.get(Agent);

    await Promise.all([
      agent.run('for alice', { context: { userId: 'alice' } }),
      agent.run('for bob', { context: { userId: 'bob' } }),
    ]);

    expect(
      seen
        .map((ctx) => ctx?.userId)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['alice', 'bob']);
  });

  // #148: LangChain hands a nested run the running config, `context`
  // included.
  describe("an agent run from another agent's tool", () => {
    // What `ask` passes to the inner run: nothing, the caller's, or another.
    let innerContext: (caller: Caller) => Caller | undefined;
    let innerError: unknown;

    @Injectable()
    class AskService {
      constructor(@InjectAgent('INNER') private readonly inner: Agent) {}

      @Tool({ description: 'Asks the inner agent.' })
      async ask(
        @ToolParam({ name: 'q' }) q: string,
        @ToolContext() ctx: Caller,
      ): Promise<string> {
        await this.inner
          .run(q, { context: innerContext(ctx) })
          .catch((error: unknown) => (innerError = error));
        return 'asked';
      }
    }

    const bootNested = async (inner: ModelOption) => {
      @Module({
        imports: [
          OrdersModule,
          LangChainModule.register({
            name: 'INNER',
            model: inner,
            tools: [OrdersModule],
          }),
        ],
        providers: [AskService],
        exports: [AskService],
      })
      class AskModule {}

      app = await Test.createTestingModule({
        imports: [
          AskModule,
          OrdersModule,
          LangChainModule.register({
            name: 'OUTER',
            // Asks the inner agent, then lists the orders itself.
            model: fakeModel()
              .respondWithTools([{ name: 'ask', args: { q: 'orders?' } }])
              .respondWithTools([listOrders])
              .respond(new AIMessage('done')),
            tools: [AskModule, OrdersModule],
          }),
        ],
      })
        .setLogger(silentLogger)
        .compile();
      await app.init();

      await app
        .get<Agent>(getAgentToken('OUTER'))
        .run('go', { context: { userId: 'alice' } });
    };

    beforeEach(() => {
      innerError = undefined;
    });

    it("takes the caller's context, as LangChain hands it down", async () => {
      innerContext = () => undefined;

      await bootNested(
        fakeModel().respondWithTools([listOrders]).respond(new AIMessage('i')),
      );

      expect(innerError).toBeUndefined();
      expect(seen).toEqual([{ userId: 'alice' }, { userId: 'alice' }]);
    });

    it('takes the context the calling tool passes on', async () => {
      innerContext = (caller) => caller;

      await bootNested(
        fakeModel().respondWithTools([listOrders]).respond(new AIMessage('i')),
      );

      expect(innerError).toBeUndefined();
      expect(seen).toEqual([{ userId: 'alice' }, { userId: 'alice' }]);
    });

    it("takes a context of its own instead, leaving the caller's alone", async () => {
      innerContext = () => ({ userId: 'bob' });

      await bootNested(
        fakeModel().respondWithTools([listOrders]).respond(new AIMessage('i')),
      );

      expect(seen).toEqual([{ userId: 'bob' }, { userId: 'alice' }]);
    });
  });

  it("fails a nested run with neither a context of its own nor its caller's", async () => {
    let innerError: unknown;

    // A tool that reads no context: the caller's run needs none.
    @Injectable()
    class AskService {
      constructor(@InjectAgent('INNER') private readonly inner: Agent) {}

      @Tool({ description: 'Asks the inner agent.' })
      async ask(@ToolParam({ name: 'q' }) q: string): Promise<string> {
        await this.inner.run(q).catch((error: unknown) => (innerError = error));
        return 'asked';
      }
    }

    const inner = fakeModel().respondWithTools([listOrders]);

    @Module({
      imports: [
        OrdersModule,
        LangChainModule.register({
          name: 'INNER',
          model: inner,
          tools: [OrdersModule],
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
            .respondWithTools([{ name: 'ask', args: { q: 'orders?' } }])
            .respond(new AIMessage('done')),
          tools: [AskModule],
        }),
      ],
    })
      .setLogger(silentLogger)
      .compile();
    await app.init();

    await app.get<Agent>(getAgentToken('OUTER')).run('go');

    expect(innerError).toBeInstanceOf(AgentContextError);
    expect((innerError as Error).message).toBe(
      "The INNER agent's tool listOrders reads a context: pass `context` to " +
        'run().',
    );
    expect(inner.callCount).toBe(0);
  });

  // #321: LangChain checks the context against the agent's `contextSchema`.
  describe('contextSchema', () => {
    const Caller = z.object({
      userId: z.string(),
      locale: z.string().default('en'),
    });

    const bootChecked = async (
      model: ModelOption,
      tools: NonNullable<
        Parameters<typeof LangChainModule.register>[0]['tools']
      >,
      extra: { observer?: { onRunError: (event: RunErrorEvent) => void } } = {},
    ) => {
      app = await Test.createTestingModule({
        imports: [
          ...tools,
          LangChainModule.register({
            model,
            tools,
            contextSchema: Caller,
            ...extra,
          }),
        ],
      })
        .setLogger(silentLogger)
        .compile();
      await app.init();
      return app.get(Agent);
    };

    it('hands the tools the context as passed, not as parsed', async () => {
      const agent = await bootChecked(
        fakeModel().respondWithTools([listOrders]).respond(new AIMessage('ok')),
        [OrdersModule],
      );

      await agent.run('My orders?', { context: { userId: 'alice' } });

      expect(seen).toEqual([{ userId: 'alice' }]);
    });

    it('fails a run whose context does not match, before the model', async () => {
      const errors: RunErrorEvent[] = [];
      const model = fakeModel().respondWithTools([listOrders]);
      const agent = await bootChecked(model, [OrdersModule], {
        observer: { onRunError: (event) => void errors.push(event) },
      });

      const run = agent.run('My orders?', { context: { userId: 42 } });

      await expect(run).rejects.toThrow(AgentContextError);
      await expect(run).rejects.toThrow(
        "The agent's run context does not match its `contextSchema`: " +
          '✖ Invalid input: expected string, received number → at userId',
      );
      expect(model.callCount).toBe(0);
      expect(errors).toMatchObject([{ error: { name: 'AgentContextError' } }]);
    });

    it('fails a run without context, though no tool reads it', async () => {
      const model = fakeModel().respond(new AIMessage('3'));
      const agent = await bootChecked(model, [MathModule]);

      await expect(agent.run('1 + 2?')).rejects.toThrow(
        new AgentContextError(
          "The agent's run has no context, which its `contextSchema` requires.",
          'default',
        ),
      );
      expect(model.callCount).toBe(0);
    });

    it('is taken by registerAsync', async () => {
      app = await Test.createTestingModule({
        imports: [
          LangChainModule.registerAsync({
            useFactory: () => ({
              model: fakeModel(),
              contextSchema: Caller,
            }),
          }),
        ],
      })
        .setLogger(silentLogger)
        .compile();
      await app.init();

      await expect(app.get(Agent).run('?')).rejects.toThrow(AgentContextError);
    });

    it('checks the context a nested agent inherits against its own schema', async () => {
      let innerError: unknown;

      @Injectable()
      class AskService {
        constructor(@InjectAgent('INNER') private readonly inner: Agent) {}

        @Tool({ description: 'Asks the inner agent.' })
        async ask(@ToolParam({ name: 'q' }) q: string): Promise<string> {
          await this.inner
            .run(q)
            .catch((error: unknown) => (innerError = error));
          return 'asked';
        }
      }

      const inner = fakeModel();

      @Module({
        imports: [
          LangChainModule.register({
            name: 'INNER',
            model: inner,
            contextSchema: z.object({ accountId: z.string() }),
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
              .respondWithTools([{ name: 'ask', args: { q: '?' } }])
              .respond(new AIMessage('done')),
            tools: [AskModule],
          }),
        ],
      })
        .setLogger(silentLogger)
        .compile();
      await app.init();

      await app
        .get<Agent>(getAgentToken('OUTER'))
        .run('go', { context: { userId: 'alice' } });

      expect(innerError).toBeInstanceOf(AgentContextError);
      expect((innerError as Error).message).toContain('→ at accountId');
      expect(inner.callCount).toBe(0);
    });
  });
});
