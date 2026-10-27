import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { Test, TestingModule } from '@nestjs/testing';
import { StructuredOutputParsingError } from 'langchain';
import { z } from 'zod';
import {
  Agent,
  AgentRunError,
  getAgentToken,
  LangChainModule,
  LangChainModuleOptions,
  ModelOption,
  RunErrorEvent,
  StructuredOutputError,
} from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';
import { silentLogger } from '../fixtures/logging.js';
import { outputModel } from '../fixtures/structured-output.js';

const boot = async (
  model: ModelOption,
  extra: Partial<LangChainModuleOptions> & { name?: string } = {},
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [
      MathModule,
      LangChainModule.register({ model, tools: [MathModule], ...extra }),
    ],
  })
    .setLogger(silentLogger)
    .compile();
  await app.init();
  return app;
};

const Classification = z.object({
  category: z.enum(['billing', 'bug', 'other']),
  priority: z.number().int().min(1).max(3),
});

describe('structured output', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns the object the schema parses, on the agent that answers in text', async () => {
    const { model, callOutput } = outputModel();
    model
      .respond(new AIMessage('Hello!'))
      .respond(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'c1', name: 'add', args: { a: 1, b: 2 } }],
        }),
      )
      .respond(callOutput({ category: 'bug', priority: 2 }));
    app = await boot(model);
    const agent = app.get(Agent);

    await expect(agent.run('hi')).resolves.toMatchObject({ output: 'Hello!' });
    await expect(
      agent.run('The export crashes.', { output: Classification }),
    ).resolves.toEqual({
      status: 'completed',
      output: { category: 'bug', priority: 2 },
      // Not the structured output's own tool.
      tools: ['add'],
      durationMs: expect.any(Number),
    });
  });

  // #274: whatever the model's profile.
  it('answers through a tool, even on a model that declares native support', async () => {
    const { model, outputTool, callOutput } = outputModel({ native: true });
    model.respond(callOutput({ category: 'billing', priority: 3 }));
    app = await boot(model);

    const run = await app
      .get(Agent)
      .run('I was charged twice.', { output: Classification });

    expect(run.output).toEqual({ category: 'billing', priority: 3 });
    expect(outputTool()).toBe('extract-output');
  });

  // #281: the provider's prompt cache sees the same tools on every run.
  it('binds the same output tool on every run', async () => {
    const { model, outputTool, callOutput } = outputModel();
    model
      .respond(callOutput({ category: 'bug', priority: 2 }))
      .respond(callOutput({ category: 'other', priority: 1 }));
    app = await boot(model);
    const agent = app.get(Agent);

    await agent.run('first', { output: Classification });
    const first = outputTool();
    await agent.run('second', { output: Classification });

    expect(outputTool()).toBe(first);
  });

  // #281: LangChain would name the tool after the title.
  it.each([
    ['with spaces', 'Ticket Classification'],
    ["naming one of the agent's tools", 'add'],
  ])('names the output tool itself, for a title %s', async (_label, title) => {
    const { model, outputTool, callOutput } = outputModel();
    model
      .respond(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'c1', name: 'add', args: { a: 1, b: 2 } }],
        }),
      )
      .respond(callOutput({ category: 'bug', priority: 2 }));
    app = await boot(model);

    const run = await app
      .get(Agent)
      .run('ticket', { output: Classification.meta({ title }) });

    expect(outputTool()).toBe('extract-output');
    expect(run).toMatchObject({
      output: { category: 'bug', priority: 2 },
      tools: ['add'],
    });
  });

  // #274: LangChain's own, which may let the model skip the agent's tools.
  it('leaves LangChain to force a tool call', async () => {
    const { model, callOutput, toolChoice } = outputModel();
    model.respond(callOutput({ category: 'bug', priority: 2 }));
    app = await boot(model);

    await app.get(Agent).run('ticket', { output: Classification });

    expect(toolChoice()).toBe('any');
  });

  it('applies what the schema transforms', async () => {
    const Invoice = z.object({
      dueDate: z.iso.date().transform((date) => new Date(date)),
      amount: z.number().transform((euros) => Math.round(euros * 100)),
    });
    const { model, callOutput } = outputModel();
    model.respond(callOutput({ dueDate: '2026-11-30', amount: 1249.9 }));
    app = await boot(model);

    const { output } = await app.get(Agent).run('email', { output: Invoice });

    expect(output).toEqual({
      dueDate: new Date('2026-11-30'),
      amount: 124990,
    });
  });

  it('sends an invalid output back to the model, and returns the corrected one', async () => {
    const { model, callOutput } = outputModel();
    model
      .respond(callOutput({ category: 'urgent', priority: 2 }, 'o1'))
      .respond(callOutput({ category: 'bug', priority: 2 }, 'o2'));
    app = await boot(model);

    const { output } = await app
      .get(Agent)
      .run('ticket', { output: Classification });

    expect(output).toEqual({ category: 'bug', priority: 2 });
    expect(model.calls[1]?.messages.at(-1)).toBeInstanceOf(ToolMessage);
  });

  it('raises a StructuredOutputError once two retries failed', async () => {
    const { model, callOutput } = outputModel();
    ['o1', 'o2', 'o3'].forEach((id) =>
      model.respond(callOutput({ category: 'urgent', priority: 2 }, id)),
    );
    app = await boot(model, { name: 'SUPPORT' });

    const run = app
      .get<Agent>(getAgentToken('SUPPORT'))
      .run('ticket', { output: Classification });

    await expect(run).rejects.toBeInstanceOf(StructuredOutputError);
    await expect(run).rejects.toMatchObject({
      agent: 'SUPPORT',
      message: expect.stringMatching(
        /^The SUPPORT agent's model replied with an output that does not match the schema: Property "category" does not match schema\./,
      ),
      cause: expect.any(StructuredOutputParsingError),
    });
    expect(model.calls).toHaveLength(3);
  });

  it('raises a StructuredOutputError when the model answers in text', async () => {
    const { model } = outputModel();
    model.respond(new AIMessage('It is a bug.'));
    app = await boot(model);

    const run = app.get(Agent).run('ticket', { output: Classification });

    await expect(run).rejects.toBeInstanceOf(StructuredOutputError);
    await expect(run).rejects.toMatchObject({
      message:
        "The agent's model replied without the requested structured output.",
    });
  });

  it('raises a StructuredOutputError when a refinement fails', async () => {
    const Booking = z
      .object({ checkIn: z.iso.date(), checkOut: z.iso.date() })
      .refine((booking) => booking.checkOut > booking.checkIn, {
        message: 'checkOut must be after checkIn',
      });
    const { model, callOutput } = outputModel();
    model.respond(
      callOutput({ checkIn: '2026-12-20', checkOut: '2026-12-18' }),
    );
    app = await boot(model);

    const run = app.get(Agent).run('email', { output: Booking });

    await expect(run).rejects.toBeInstanceOf(StructuredOutputError);
    await expect(run).rejects.toMatchObject({
      message: expect.stringContaining('checkOut must be after checkIn'),
      cause: expect.any(z.ZodError),
    });
  });

  it('rejects a schema with no JSON Schema form before calling the model', async () => {
    const { model } = outputModel();
    app = await boot(model);

    const run = app
      .get(Agent)
      .run('email', { output: z.object({ dueDate: z.coerce.date() }) });

    await expect(run).rejects.toBeInstanceOf(AgentRunError);
    await expect(run).rejects.not.toBeInstanceOf(StructuredOutputError);
    await expect(run).rejects.toMatchObject({
      message:
        "The agent's `output` schema has no JSON Schema form (Date cannot be " +
        'represented in JSON Schema). Declare a schema JSON Schema can ' +
        'express and convert it with .transform(), such as z.iso.date() or ' +
        'z.iso.datetime() for a date.',
    });
    expect(model.calls).toHaveLength(0);
  });

  // #282: the model fills the output in as a tool's parameters, an object
  // with named fields.
  it.each([
    ['an array', z.array(z.string())],
    ['a string', z.string()],
    ['a union', z.union([Classification, z.object({ note: z.string() })])],
    ['a nullable object', Classification.nullable()],
    ['a record', z.record(z.string(), z.number())],
  ])(
    'rejects %s as output before calling the model',
    async (_label, output) => {
      const { model } = outputModel();
      app = await boot(model);

      const run = app.get(Agent).run('ticket', { output });

      await expect(run).rejects.toBeInstanceOf(AgentRunError);
      await expect(run).rejects.toMatchObject({
        message:
          "The agent's `output` schema is not an object with named fields: the " +
          "model fills it in as a tool's parameters. Wrap it, such as " +
          '`z.object({ items: z.array(...) })`.',
      });
      expect(model.calls).toHaveLength(0);
    },
  );

  it('accepts an object schema transformed at its root', async () => {
    const { model, callOutput } = outputModel();
    model.respond(callOutput({ category: 'bug', priority: 2 }));
    app = await boot(model);

    const run = await app.get(Agent).run('ticket', {
      output: Classification.transform(({ category }) => category),
    });

    expect(run.output).toBe('bug');
  });

  it('hands the observer the very StructuredOutputError the caller receives', async () => {
    const errors: RunErrorEvent[] = [];
    const { model } = outputModel();
    model.respond(new AIMessage('It is a bug.'));
    app = await boot(model, {
      observer: { onRunError: (event) => void errors.push(event) },
    });

    const failure = await app
      .get(Agent)
      .run('ticket', { output: Classification })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StructuredOutputError);
    expect(errors).toEqual([
      expect.objectContaining({ error: failure, agent: 'default' }),
    ]);
  });

  it('keeps a provider error as the cause', async () => {
    const rateLimited = new Error('rate limited');
    app = await boot(fakeModel().respond(rateLimited));

    const run = app.get(Agent).run('ticket', { output: Classification });

    await expect(run).rejects.toMatchObject({
      message: "The agent's run failed: rate limited",
      cause: rateLimited,
    });
  });

  it('keeps concurrent text and structured runs apart', async () => {
    const { model, callOutput } = outputModel();
    const answer = (messages: { text: string }[]) =>
      messages.at(-1)?.text === 'ticket'
        ? callOutput({ category: 'other', priority: 1 })()
        : new AIMessage('Hello!');
    model.respond(answer).respond(answer);
    app = await boot(model);
    const agent = app.get(Agent);

    const [structured, text] = await Promise.all([
      agent.run('ticket', { output: Classification }),
      agent.run('hi'),
    ]);

    expect(structured.output).toEqual({ category: 'other', priority: 1 });
    expect(text.output).toBe('Hello!');
  });

  // #151: the schema travels in `configurable`, which LangGraph does not copy
  // into the metadata tracers receive.
  // #290: LangChain takes the output, and leaves the reply's other calls out.
  describe('with other calls in the reply giving the output', () => {
    const reply = (...calls: [string, Record<string, unknown>][]) =>
      new AIMessage({
        content: '',
        tool_calls: calls.map(([name, args], index) => ({
          id: `${name}-${index}`,
          name,
          args,
        })),
      });
    const add = ['add', { a: 1, b: 2 }] as [string, Record<string, unknown>];
    const output = (category: string) =>
      ['extract-output', { category, priority: 2 }] as [
        string,
        Record<string, unknown>,
      ];

    // The calls no ToolMessage answers, which providers reject.
    const unanswered = (messages: BaseMessage[]) => {
      const answered = new Set(
        messages
          .filter((m): m is ToolMessage => ToolMessage.isInstance(m))
          .map((m) => m.tool_call_id),
      );

      return messages
        .flatMap((m) => (AIMessage.isInstance(m) ? (m.tool_calls ?? []) : []))
        .map((call) => call.id)
        .filter((id) => !answered.has(id ?? ''));
    };

    it('leaves out of `tools` a call it ended the run without', async () => {
      const model = fakeModel().respond(reply(add, output('bug')));
      const started: string[] = [];
      app = await boot(model, {
        observer: { onToolStart: (event) => void started.push(event.tool) },
      });

      const run = await app
        .get(Agent)
        .run('ticket', { output: Classification });

      expect(run).toMatchObject({
        output: { category: 'bug', priority: 2 },
        tools: [],
      });
      expect(started).toEqual([]);
    });

    it.each([
      ['an invalid output', [add, output('nope')]],
      ['two outputs', [output('bug'), output('other')]],
    ])('answers every call of %s when it asks again', async (_label, calls) => {
      const model = fakeModel()
        .respond(reply(...calls))
        .respond(reply(output('bug')));
      app = await boot(model);

      const run = await app
        .get(Agent)
        .run('ticket', { output: Classification });

      expect(run).toMatchObject({
        output: { category: 'bug', priority: 2 },
        tools: [],
      });
      expect(model.calls).toHaveLength(2);
      expect(unanswered(model.calls[1]?.messages ?? [])).toEqual([]);
    });

    it('tells the model which call was not run', async () => {
      const model = fakeModel()
        .respond(reply(add, output('nope')))
        .respond(reply(output('bug')));
      app = await boot(model);

      await app.get(Agent).run('ticket', { output: Classification });

      expect(
        model.calls[1]?.messages.find(
          (m) => ToolMessage.isInstance(m) && m.tool_call_id === 'add-0',
        ),
      ).toMatchObject({
        status: 'error',
        content:
          "Error: 'add' was not run: it came with the final answer. Call it " +
          'on its own first if it is needed.',
      });
    });
  });

  it('keeps the schema out of the trace metadata', async () => {
    const metadata: unknown[] = [];
    const { model, callOutput } = outputModel();
    model.respond(callOutput({ category: 'bug', priority: 2 }));
    app = await boot(model, {
      callbacks: [
        {
          handleChainStart: (...args: unknown[]) => void metadata.push(args[5]),
          handleChatModelStart: (...args: unknown[]) =>
            void metadata.push(args[6]),
        },
      ],
    });

    await app.get(Agent).run('ticket', { output: Classification });

    expect(JSON.stringify(metadata)).toContain('langgraph_node');
    expect(JSON.stringify(metadata)).not.toMatch(/nestjs-langchain|billing/);
  });
});
