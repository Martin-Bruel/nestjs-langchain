import {
  DynamicModule,
  Inject,
  Injectable,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { Test, TestingModuleOptions } from '@nestjs/testing';
import { fakeModel } from '@langchain/core/testing';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, Agent, Tool } from '../../lib/index.js';
import { silentLogger } from '../fixtures/logging.js';

// Closes what compiled when the bootstrap fails, so no context is left open.
const boot = async (
  imports: ModuleMetadata['imports'],
  options?: TestingModuleOptions,
) => {
  const app = await Test.createTestingModule({ imports }, options)
    .setLogger(silentLogger)
    .compile();

  try {
    await app.init();
  } catch (error) {
    await app.close();
    throw error;
  }

  return app;
};

const UNIT = 'WEATHER_UNIT';

@Injectable()
class WeatherService {
  constructor(@Inject(UNIT) private readonly unit: string) {}

  @Tool({ description: 'Reads the current temperature.' })
  temperature(): string {
    return `20${this.unit}`;
  }
}

// A tool provider that needs configuration, which is the case #51 exists for.
@Module({})
class WeatherModule {
  static forRoot(unit: string): DynamicModule {
    return {
      module: WeatherModule,
      providers: [WeatherService, { provide: UNIT, useValue: unit }],
    };
  }
}

describe('a tool module registered through forRoot', () => {
  it('is discovered and keeps the configuration it was given', async () => {
    const weather = WeatherModule.forRoot('C');

    const app = await Test.createTestingModule({
      imports: [
        weather,
        LangChainModule.register({
          model: new FakeListChatModel({ responses: ['42'] }),
          tools: [weather],
        }),
      ],
    }).compile();

    await app.init();

    // The agent booted, so the entry resolved to its class and matched. The
    // injected unit proves the configured instance is the one behind the tool.
    expect(app.get(Agent)).toBeInstanceOf(Agent);
    expect(app.get(WeatherService).temperature()).toBe('20C');

    await app.close();
  });

  it('refuses to boot when the dynamic module was never imported', async () => {
    await expect(
      boot([
        LangChainModule.register({
          model: new FakeListChatModel({ responses: ['42'] }),
          tools: [WeatherModule.forRoot('C')],
        }),
      ]),
    ).rejects.toThrow(
      /WeatherModule is listed in `tools` but is not imported into the Nest context/,
    );
  });
});

const STORE = 'STORE_NAME';

@Injectable()
class Reader {
  constructor(@Inject(STORE) private readonly store: string) {}

  @Tool({ description: 'Reads.' })
  read(): string {
    return `read from ${this.store}`;
  }
}

@Injectable()
class Writer {
  @Tool({ description: 'Deletes everything.' })
  dropDatabase(): string {
    return 'dropped';
  }
}

// Each instance holds its own tools, reading its own store.
@Module({})
class StoreModule {
  static forRoot(store: string, tools: Type[] = [Reader]): DynamicModule {
    return {
      module: StoreModule,
      providers: [...tools, { provide: STORE, useValue: store }],
    };
  }
}

const calling = (tool: string) =>
  fakeModel()
    .respondWithTools([{ name: tool, args: {}, id: 'c1' }])
    .respond(new AIMessage('done'));

// What the agent answered the model's one tool call.
const answerTo = async (
  agent: Agent,
  model: ReturnType<typeof fakeModel>,
): Promise<string> => {
  await agent.run('Go.');
  const messages: BaseMessage[] = model.calls[1].messages;
  return messages[messages.length - 1].text;
};

const severalInstances =
  'StoreModule is listed in `tools`, but the Nest context holds 2 instances ' +
  'of it, so their tools cannot be told apart. Import it once, or give each ' +
  'configuration its own module class.';

describe('a tool module Nest holds several instances of', () => {
  it('refuses an agent listing one instance, rather than give it the tools of both', async () => {
    const readOnly = StoreModule.forRoot('main');
    const readWrite = StoreModule.forRoot('main', [Writer]);

    await expect(
      boot([
        readOnly,
        readWrite,
        LangChainModule.register({
          model: calling('dropDatabase'),
          tools: [readOnly],
        }),
      ]),
    ).rejects.toThrow(severalInstances);
  });

  it('refuses the class itself', async () => {
    await expect(
      boot([
        StoreModule.forRoot('north'),
        StoreModule.forRoot('south'),
        LangChainModule.register({
          model: calling('read'),
          tools: [StoreModule],
        }),
      ]),
    ).rejects.toThrow(severalInstances);
  });

  it('counts a plain import as an instance', async () => {
    await expect(
      boot([
        StoreModule,
        StoreModule.forRoot('north'),
        LangChainModule.register({
          model: calling('read'),
          tools: [StoreModule],
        }),
      ]),
    ).rejects.toThrow(severalInstances);
  });

  it('counts once the instances deep-hash merges', async () => {
    const model = calling('read');

    const app = await boot(
      [
        StoreModule.forRoot('north'),
        StoreModule.forRoot('north'),
        LangChainModule.register({ model, tools: [StoreModule] }),
      ],
      { moduleIdGeneratorAlgorithm: 'deep-hash' },
    );

    expect(await answerTo(app.get(Agent), model)).toBe('read from north');

    await app.close();
  });
});

describe('a tool module Nest holds a single instance of', () => {
  it('is designated by its class', async () => {
    const model = calling('read');

    const app = await boot([
      StoreModule.forRoot('north'),
      LangChainModule.register({ model, tools: [StoreModule] }),
    ]);

    expect(await answerTo(app.get(Agent), model)).toBe('read from north');

    await app.close();
  });

  it('is designated by another forRoot() call', async () => {
    const model = calling('read');

    const app = await boot([
      StoreModule.forRoot('north'),
      LangChainModule.register({
        model,
        tools: [StoreModule.forRoot('north')],
      }),
    ]);

    expect(await answerTo(app.get(Agent), model)).toBe('read from north');

    await app.close();
  });
});
