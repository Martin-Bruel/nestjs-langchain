import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  Agent,
  getAgentToken,
  InjectAgent,
  LangChainModule,
} from '../../lib/index.js';

const math = () =>
  LangChainModule.register({
    name: 'MATH',
    model: new FakeListChatModel({ responses: ['from the model'] }),
  });

describe('getAgentToken', () => {
  it('overrides a named agent in a test', async () => {
    @Injectable()
    class Consumer {
      constructor(@InjectAgent('MATH') readonly math: Agent) {}
    }

    const mock = {
      run: () =>
        Promise.resolve({
          status: 'completed',
          output: 'from the mock',
          tools: [],
          durationMs: 0,
        }),
    };

    const app = await Test.createTestingModule({
      imports: [math()],
      providers: [Consumer],
    })
      .overrideProvider(getAgentToken('MATH'))
      .useValue(mock)
      .compile();
    await app.init();

    expect(app.get(Consumer).math).toBe(mock);
    await expect(app.get(Consumer).math.run('?')).resolves.toMatchObject({
      output: 'from the mock',
    });

    await app.close();
  });

  it('injects a named agent into a factory provider', async () => {
    class Router {
      constructor(readonly agent: Agent) {}
    }

    const app = await Test.createTestingModule({
      imports: [math()],
      providers: [
        {
          provide: Router,
          inject: [getAgentToken('MATH')],
          useFactory: (agent: Agent) => new Router(agent),
        },
      ],
    }).compile();
    await app.init();

    expect(app.get(Router).agent).toBeInstanceOf(Agent);
    await expect(app.get(Router).agent.run('?')).resolves.toMatchObject({
      output: 'from the model',
    });

    await app.close();
  });
});

// #170: injection already resolved `Agent` to the unnamed agent (#128), but
// `overrideProvider` and a non-strict `get` search every module.
describe('the Agent class token outside injection', () => {
  const unnamed = () =>
    LangChainModule.register({
      model: new FakeListChatModel({ responses: ['unnamed'] }),
    });

  @Injectable()
  class Consumer {
    constructor(
      readonly unnamed: Agent,
      @InjectAgent('MATH') readonly math: Agent,
    ) {}
  }

  const mock = {
    run: () =>
      Promise.resolve({
        status: 'completed',
        output: 'from the mock',
        tools: [],
        durationMs: 0,
      }),
  };

  const orders = [
    ['unnamed first', () => [unnamed(), math()]],
    ['unnamed last', () => [math(), unnamed()]],
  ] as const;

  it.each(orders)(
    'overrideProvider(Agent) replaces the unnamed agent only, %s',
    async (_order, imports) => {
      const app = await Test.createTestingModule({
        imports: [...imports()],
        providers: [Consumer],
      })
        .overrideProvider(Agent)
        .useValue(mock)
        .compile();
      await app.init();

      const { unnamed, math: named } = app.get(Consumer);

      await expect(unnamed.run('?')).resolves.toMatchObject({
        output: 'from the mock',
      });
      await expect(named.run('?')).resolves.toMatchObject({
        output: 'from the model',
      });

      await app.close();
    },
  );

  it.each(orders)(
    'overrideProvider(getAgentToken) replaces that agent only, %s',
    async (_order, imports) => {
      const app = await Test.createTestingModule({
        imports: [...imports()],
        providers: [Consumer],
      })
        .overrideProvider(getAgentToken('MATH'))
        .useValue(mock)
        .compile();
      await app.init();

      const { unnamed, math: named } = app.get(Consumer);

      await expect(unnamed.run('?')).resolves.toMatchObject({
        output: 'unnamed',
      });
      await expect(named.run('?')).resolves.toMatchObject({
        output: 'from the mock',
      });

      await app.close();
    },
  );

  it.each(orders)(
    'app.get(Agent) returns the unnamed agent, %s',
    async (_order, imports) => {
      const app = await Test.createTestingModule({
        imports: [...imports()],
      }).compile();
      await app.init();

      await expect(app.get(Agent).run('?')).resolves.toMatchObject({
        output: 'unnamed',
      });

      await app.close();
    },
  );

  it('app.get(Agent) fails when only named agents are registered', async () => {
    const app = await Test.createTestingModule({
      imports: [math()],
    }).compile();
    await app.init();

    expect(() => app.get(Agent)).toThrow();

    await app.close();
  });
});
