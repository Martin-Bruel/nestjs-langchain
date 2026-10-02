import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';
import {
  ConsoleLogger,
  Injectable,
  LoggerService,
  Module,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentObserver,
  ModelErrorEvent,
  ModelOption,
  LangChainModule,
  Agent,
  getAgentToken,
  RunFinishEvent,
  Tool,
  ToolEndEvent,
  ToolParam,
  ToolStartEvent,
} from '../../lib/index.js';

interface Line {
  level: string;
  message: string;
}

class RecordingLogger implements LoggerService {
  readonly lines: Line[] = [];

  // Nest's own boot lines come through here too, so only ours are kept.
  private record(level: string, message: unknown, context: unknown) {
    if (context === 'LangChainAgent') {
      this.lines.push({ level, message: String(message) });
    }
  }

  log(message: unknown, context?: unknown) {
    this.record('log', message, context);
  }
  error(message: unknown, context?: unknown) {
    this.record('error', message, context);
  }
  warn(message: unknown, context?: unknown) {
    this.record('warn', message, context);
  }
  debug(message: unknown, context?: unknown) {
    this.record('debug', message, context);
  }

  at(level: string): string[] {
    return this.lines
      .filter((line) => line.level === level)
      .map((line) => line.message);
  }
}

// One `add` call, then the answer, each turn reporting its usage.
const addThenAnswer = (
  calls: { id: string; name: string; args: Record<string, unknown> }[] = [
    { id: 'c1', name: 'add', args: { a: 1, b: 2 } },
  ],
) =>
  fakeModel()
    .respond(
      new AIMessage({
        content: '',
        tool_calls: calls,
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      }),
    )
    .respond(
      new AIMessage({
        content: 'The result is 3.',
        usage_metadata: {
          input_tokens: 20,
          output_tokens: 4,
          total_tokens: 24,
        },
      }),
    );

@Injectable()
class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    return a + b;
  }
}

@Module({ providers: [MathService] })
class MathModule {}

@Injectable()
class BrokenService {
  @Tool({ description: 'Always fails.' })
  add(
    @ToolParam({ name: 'a' }) a: number,
    @ToolParam({ name: 'b' }) b: number,
  ): number {
    throw new Error(`no addition today for ${a} and ${b}`);
  }
}

@Module({ providers: [BrokenService] })
class BrokenModule {}

const boot = async (
  logger: RecordingLogger,
  extra: {
    broken?: boolean;
    name?: string;
    observer?: AgentObserver;
    model?: ModelOption;
  } = {},
): Promise<TestingModule> => {
  const tools = extra.broken ? BrokenModule : MathModule;

  const app = await Test.createTestingModule({
    imports: [
      tools,
      LangChainModule.register({
        model: extra.model ?? addThenAnswer(),
        tools: [tools],
        observer: extra.observer,
        ...(extra.name ? { name: extra.name } : {}),
      }),
    ],
  })
    // How a consumer plugs Winston or Pino: Nest's own mechanism, no option
    // of ours. A testing module silences the logger otherwise.
    .setLogger(logger)
    .compile();

  await app.init();
  return app;
};

describe('agent run logging', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  describe('what the library writes on its own', () => {
    let logger: RecordingLogger;

    beforeEach(async () => {
      logger = new RecordingLogger();
      app = await boot(logger);
      await app.get(Agent).run('go');
    });

    it('says what the agent is ready with, once, at bootstrap', () => {
      expect(logger.at('log')).toEqual(['ready with 1 tool']);
    });

    // The way an ORM does not log every query.
    it('writes nothing at all for the run itself', () => {
      expect(logger.at('debug')).toEqual([]);
      expect(logger.at('warn')).toEqual([]);
    });

    it('logs no prompt and no tool argument anywhere', () => {
      expect(JSON.stringify(logger.lines)).not.toContain('"a"');
    });
  });

  describe('what it hands to an observer', () => {
    it('reports each tool call, and what the run cost', async () => {
      const calls: string[] = [];
      let finish: RunFinishEvent | undefined;
      const observer: AgentObserver = {
        onToolStart: ({ tool, args }) =>
          void calls.push(`${tool}(${JSON.stringify(args)})`),
        onToolEnd: ({ tool, output }) =>
          void calls.push(`${tool} -> ${JSON.stringify(output)}`),
        onRunFinish: (event) => {
          finish = event;
        },
      };

      app = await boot(new RecordingLogger(), { name: 'MATH', observer });
      await app.get<Agent>(getAgentToken('MATH')).run('go');

      // Parsed arguments and the number the method returned, not the text
      // sent to the model. The payloads the logs refuse to carry.
      expect(calls).toEqual(['add({"a":1,"b":2})', 'add -> 3']);
      expect(finish).toMatchObject({
        agent: 'MATH',
        tools: ['add'],
        tokens: { input: 30, output: 9, total: 39 },
      });
      expect(finish?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns what it hands to onRunFinish for the same run', async () => {
      let finish: RunFinishEvent | undefined;

      app = await boot(new RecordingLogger(), {
        observer: { onRunFinish: (event) => void (finish = event) },
      });
      const { tools, tokens, durationMs } = await app.get(Agent).run('go');

      expect(finish).toEqual({ agent: 'default', tools, tokens, durationMs });
      expect(tools).toEqual(['add']);
      expect(tokens).toEqual({ input: 30, output: 9, total: 39 });
    });

    it('pairs each end with its start across parallel calls', async () => {
      const starts: ToolStartEvent[] = [];
      const ends: ToolEndEvent[] = [];

      app = await boot(new RecordingLogger(), {
        model: addThenAnswer([
          { id: 'call_A', name: 'add', args: { a: 1, b: 2 } },
          { id: 'call_B', name: 'add', args: { a: 5, b: 5 } },
        ]),
        observer: {
          onToolStart: (event) => void starts.push(event),
          onToolEnd: (event) => void ends.push(event),
        },
      });
      await app.get(Agent).run('go');

      const byCall = (events: { callId: string }[]) =>
        [...events].sort((x, y) => x.callId.localeCompare(y.callId));

      expect(byCall(starts)).toEqual([
        {
          agent: 'default',
          tool: 'add',
          callId: 'call_A',
          args: { a: 1, b: 2 },
        },
        {
          agent: 'default',
          tool: 'add',
          callId: 'call_B',
          args: { a: 5, b: 5 },
        },
      ]);
      expect(byCall(ends)).toEqual([
        {
          agent: 'default',
          tool: 'add',
          callId: 'call_A',
          output: 3,
          durationMs: expect.any(Number),
        },
        {
          agent: 'default',
          tool: 'add',
          callId: 'call_B',
          output: 10,
          durationMs: expect.any(Number),
        },
      ]);
    });

    it('reports a failure it also logs, since the agent swallows it', async () => {
      const logger = new RecordingLogger();
      const failures: string[] = [];

      app = await boot(logger, {
        broken: true,
        observer: {
          onToolError: ({ tool, callId }) =>
            void failures.push(`${tool} ${callId}`),
        },
      });
      await app.get(Agent).run('go');

      expect(failures).toEqual(['add c1']);
      expect(logger.at('error')).toEqual([
        'add failed: no addition today for 1 and 2',
      ]);
    });
  });

  it('logs a model failure and hands it to the observer', async () => {
    const logger = new RecordingLogger();
    const failures: ModelErrorEvent[] = [];

    app = await boot(logger, {
      name: 'MATH',
      model: fakeModel().respond(new Error('rate limited')),
      observer: { onModelError: (event) => void failures.push(event) },
    });

    await expect(
      app.get<Agent>(getAgentToken('MATH')).run('go'),
    ).rejects.toThrow('rate limited');
    expect(logger.at('error')).toEqual(['MATH the model failed: rate limited']);
    expect(failures).toEqual([
      {
        agent: 'MATH',
        error: expect.objectContaining({ message: 'rate limited' }),
      },
    ]);
  });

  it('survives an observer that throws, and says so', async () => {
    const logger = new RecordingLogger();

    app = await boot(logger, {
      observer: {
        onRunFinish: () => {
          throw new Error('metrics down');
        },
      },
    });

    await expect(app.get(Agent).run('go')).resolves.toMatchObject({
      output: 'The result is 3.',
    });
    expect(logger.at('error')).toEqual(['the observer failed: metrics down']);
  });

  it('prefixes a named agent, and leaves the default one bare', async () => {
    const named = new RecordingLogger();
    app = await boot(named, { name: 'MATH', broken: true });
    await app.get<Agent>(getAgentToken('MATH')).run('go');
    await app.close();

    const anonymous = new RecordingLogger();
    app = await boot(anonymous, { broken: true });
    await app.get(Agent).run('go');

    expect(named.at('log')[0]).toBe('MATH ready with 1 tool');
    expect(named.at('error')[0]).toMatch(/^MATH add failed:/);
    expect(anonymous.at('log')[0]).toBe('ready with 1 tool');
  });

  it('runs callbacks of your own, declared as a plain object', async () => {
    const seen: string[] = [];

    app = await Test.createTestingModule({
      imports: [
        MathModule,
        LangChainModule.register({
          model: addThenAnswer(),
          tools: [MathModule],
          // No subclassing and no import from `@langchain/core`: every method
          // of the interface is optional.
          callbacks: [
            { handleToolStart: (_tool, input) => void seen.push(input) },
          ],
        }),
      ],
    }).compile();
    await app.init();
    await app.get(Agent).run('go');

    // What the library refuses to record, the caller can still reach.
    expect(seen).toEqual(['{"a":1,"b":2}']);
  });

  // Regression: giving the `Logger` a context and passing one printed the
  // context a second time, as a message of its own.
  it('prints one line through the default logger, not two', async () => {
    const written: string[] = [];
    const stdout = process.stdout.write.bind(process.stdout);

    process.stdout.write = (chunk: string) => {
      written.push(String(chunk));
      return true;
    };

    try {
      app = await Test.createTestingModule({
        imports: [
          MathModule,
          LangChainModule.register({
            model: addThenAnswer(),
            tools: [MathModule],
          }),
        ],
      })
        // A testing module silences Nest's own logger, and this asserts on it.
        .setLogger(new ConsoleLogger({ colors: false }))
        .compile();
      await app.init();
    } finally {
      process.stdout.write = stdout;
    }

    const ours = written.filter((line) => line.includes('[LangChainAgent]'));

    expect(ours).toHaveLength(1);
    expect(ours[0]).toContain('LOG [LangChainAgent] ready with 1 tool');
  });
});
