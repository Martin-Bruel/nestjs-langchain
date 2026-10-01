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
