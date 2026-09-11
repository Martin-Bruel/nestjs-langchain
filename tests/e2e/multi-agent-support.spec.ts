import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { InjectAgent, LangChainModule, LangChainService } from '../../lib';
import { MathModule } from '../fixtures/math/math.module';
import { MongoModule } from '../fixtures/mongo/mongo.module';

describe('multi-agent support', () => {
  @Injectable()
  class Consumer {
    constructor(
      @InjectAgent('MATH_AGENT') public readonly math: LangChainService,
      @InjectAgent('MONGO_AGENT') public readonly mongo: LangChainService,
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

    expect(consumer.math).toBeInstanceOf(LangChainService);
    expect(consumer.mongo).toBeInstanceOf(LangChainService);
    expect(consumer.math).not.toBe(consumer.mongo);

    await app.close();
  });

  it('boots two agents without a provider package or network', async () => {
    const app = await buildApp();

    await expect(app.init()).resolves.toBeDefined();

    await app.close();
  });
});
