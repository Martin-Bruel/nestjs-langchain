import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { InjectAgent, LangChainModule, Agent } from '../../lib/index.js';
import { MathModule } from '../fixtures/math/math.module.js';
import { MongoModule } from '../fixtures/mongo/mongo.module.js';

describe('multi-agent support', () => {
  @Injectable()
  class Consumer {
    constructor(
      @InjectAgent('MATH_AGENT') public readonly math: Agent,
      @InjectAgent('MONGO_AGENT') public readonly mongo: Agent,
    ) {}
  }

  const buildApp = () =>
    Test.createTestingModule({
      imports: [
        MathModule,
        MongoModule,
        LangChainModule.register({
          name: 'MATH_AGENT',
          model: new FakeListChatModel({ responses: ['4'] }),
          tools: [MathModule],
        }),
        LangChainModule.register({
          name: 'MONGO_AGENT',
          model: new FakeListChatModel({ responses: ['ok'] }),
          tools: [MongoModule],
        }),
      ],
      providers: [Consumer],
    }).compile();

  it('injects a distinct agent per token', async () => {
    const app = await buildApp();
    // init(), not compile() alone: agents are built in onModuleInit, so
    // without it neither the model nor the tools are ever resolved.
    await app.init();

    const consumer = app.get(Consumer);

    expect(consumer.math).toBeInstanceOf(Agent);
    expect(consumer.mongo).toBeInstanceOf(Agent);
    expect(consumer.math).not.toBe(consumer.mongo);

    await app.close();
  });

  it('boots two agents without a provider package or network', async () => {
    const app = await buildApp();

    await expect(app.init()).resolves.toBeDefined();

    await app.close();
  });

  // #128
  describe('the Agent class token', () => {
    @Injectable()
    class Unnamed {
      constructor(public readonly agent: Agent) {}
    }

    it('fails to resolve when only named agents are registered', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            LangChainModule.register({
              name: 'A',
              model: new FakeListChatModel({ responses: ['a'] }),
            }),
            LangChainModule.register({
              name: 'B',
              model: new FakeListChatModel({ responses: ['b'] }),
            }),
          ],
          providers: [Unnamed],
        }).compile(),
      ).rejects.toThrow(/can't resolve dependencies of the Unnamed/);
    });

    it('resolves to the unnamed agent next to named ones', async () => {
      const app = await Test.createTestingModule({
        imports: [
          LangChainModule.register({
            name: 'A',
            model: new FakeListChatModel({ responses: ['a'] }),
          }),
          LangChainModule.register({
            model: new FakeListChatModel({ responses: ['default'] }),
          }),
          LangChainModule.register({
            name: 'B',
            model: new FakeListChatModel({ responses: ['b'] }),
          }),
        ],
        providers: [Unnamed],
      }).compile();
      await app.init();

      await expect(app.get(Unnamed).agent.run('who?')).resolves.toMatchObject({
        output: 'default',
      });

      await app.close();
    });
  });
});
