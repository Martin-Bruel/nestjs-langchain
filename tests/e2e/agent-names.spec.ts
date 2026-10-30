import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { RunCollectorCallbackHandler } from '@langchain/core/tracers/run_collector';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  Agent,
  getAgentToken,
  InjectAgent,
  LangChainModule,
  Tool,
  ToolParam,
} from '../../lib/index.js';
import { MODULE_OPTIONS_TOKEN } from '../../lib/langchain.module-definition.js';

const agent = (name: string | undefined, answer = name ?? 'unnamed') =>
  LangChainModule.register({
    name,
    model: new FakeListChatModel({ responses: [answer] }),
  });

describe('agent names', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // #202: `name` is an extra of the module, not an option of the agent.
  it('keeps the name out of the options the agent receives', async () => {
    app = await Test.createTestingModule({
      imports: [agent('MATH')],
    }).compile();

    expect(app.get(MODULE_OPTIONS_TOKEN, { strict: false })).not.toHaveProperty(
      'name',
    );
  });

  describe('case', () => {
    it('keeps two names differing only by case apart', async () => {
      @Injectable()
      class Consumer {
        constructor(
          @InjectAgent('math') readonly lower: Agent,
          @InjectAgent('MATH') readonly upper: Agent,
        ) {}
      }

      app = await Test.createTestingModule({
        imports: [agent('math'), agent('MATH')],
        providers: [Consumer],
      }).compile();
      await app.init();

      const { lower, upper } = app.get(Consumer);

      await expect(lower.run('?')).resolves.toMatchObject({ output: 'math' });
      await expect(upper.run('?')).resolves.toMatchObject({ output: 'MATH' });
    });

    it('does not resolve a name written with another case', async () => {
      @Injectable()
      class Consumer {
        constructor(@InjectAgent('math') readonly math: Agent) {}
      }

      await expect(
        Test.createTestingModule({
          imports: [agent('MATH')],
          providers: [Consumer],
        }).compile(),
      ).rejects.toThrow(/can't resolve dependencies of the Consumer/);
    });
  });

  describe('duplicates', () => {
    it('fails the bootstrap when two agents share a name', async () => {
      const failing = await Test.createTestingModule({
        imports: [agent('MATH', 'first'), agent('MATH', 'second')],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered as "MATH". ' +
          'Give each LangChainModule registration its own `name`.',
      );
    });

    it('fails the bootstrap when two agents have no name', async () => {
      const failing = await Test.createTestingModule({
        imports: [agent(undefined, 'first'), agent(undefined, 'second')],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered without a name. ' +
          'Give all but one a `name` and inject them with @InjectAgent().',
      );
    });

    it('catches a duplicate between register and registerAsync', async () => {
      const failing = await Test.createTestingModule({
        imports: [
          agent('MATH'),
          LangChainModule.registerAsync({
            name: 'MATH',
            useFactory: () => ({
              model: new FakeListChatModel({ responses: ['async'] }),
            }),
          }),
        ],
      }).compile();

      await expect(failing.init()).rejects.toThrow(
        'Two agents are registered as "MATH".',
      );
    });

    it('boots one unnamed agent next to named ones', async () => {
      app = await Test.createTestingModule({
        imports: [agent('A'), agent(undefined), agent('B')],
      }).compile();

      await expect(app.init()).resolves.toBeDefined();
    });
  });

  describe('reserved names', () => {
    it('rejects "default", which stands for the unnamed agent', () => {
      expect(() => agent('default')).toThrow(
        '"default" cannot be an agent\'s `name`: it stands for the agent ' +
          'registered without one. Pick another name.',
      );
    });

    it('rejects an empty name', () => {
      expect(() => agent('')).toThrow(
        "An agent's `name` cannot be empty. " +
          'Omit it to register the unnamed agent.',
      );
    });

    it('applies the same rule to registerAsync', () => {
      expect(() =>
        LangChainModule.registerAsync({
          name: 'default',
          useFactory: () => ({
            model: new FakeListChatModel({ responses: ['x'] }),
          }),
        }),
      ).toThrow('"default" cannot be an agent\'s `name`');
    });
  });

  describe('traces', () => {
    type TracedRun = RunCollectorCallbackHandler['tracedRuns'][number];

    const withDescendants = (run: TracedRun): TracedRun[] => [
      run,
      ...(run.child_runs ?? []).flatMap(withDescendants),
    ];

    const traced = async (name: string | undefined) => {
      const runs = new RunCollectorCallbackHandler();
      app = await Test.createTestingModule({
        imports: [
          LangChainModule.register({
            name,
            model: new FakeListChatModel({ responses: ['ok'] }),
            callbacks: [runs],
          }),
        ],
      }).compile();
      await app.init();

      await app.get<Agent>(name ? getAgentToken(name) : Agent).run('?');

      return runs.tracedRuns;
    };

    it('names the root run after the agent', async () => {
      const [root] = await traced('MATH');

      expect(root).toMatchObject({
        name: 'MATH',
        extra: { metadata: { agent: 'MATH' } },
      });
    });

    it('carries the agent in the metadata of every run under it', async () => {
      const [root] = await traced('MATH');
      const agents = withDescendants(root).map(
        (run) => run.extra?.metadata?.agent,
      );

      expect(agents.length).toBeGreaterThan(1);
      expect(new Set(agents)).toEqual(new Set(['MATH']));
    });

    it("keeps LangGraph's name for the unnamed agent", async () => {
      const [root] = await traced(undefined);

      expect(root).toMatchObject({
        name: 'LangGraph',
        extra: { metadata: { agent: 'default' } },
      });
    });

    it("names an agent run from another agent's tool after itself", async () => {
      const innerRuns = new RunCollectorCallbackHandler();

      @Injectable()
      class AskService {
        constructor(@InjectAgent('INNER') private readonly inner: Agent) {}

        @Tool({ description: 'Asks the inner agent.' })
        async ask(@ToolParam({ name: 'q' }) q: string): Promise<string> {
          return (await this.inner.run(q)).output;
        }
      }

      @Module({
        imports: [
          LangChainModule.register({
            name: 'INNER',
            model: new FakeListChatModel({ responses: ['inner'] }),
            callbacks: [innerRuns],
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
              .respondWithTools([{ name: 'ask', args: { q: 'hi' } }])
              .respond(new AIMessage('done')),
            tools: [AskModule],
          }),
        ],
      }).compile();
      await app.init();

      await app.get<Agent>(getAgentToken('OUTER')).run('?');

      expect(innerRuns.tracedRuns).toMatchObject([
        { name: 'INNER', extra: { metadata: { agent: 'INNER' } } },
      ]);
    });
  });
});
