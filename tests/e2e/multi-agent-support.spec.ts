import { Test } from '@nestjs/testing';
import { InjectAgent, LangChainModule, LangChainService } from '../../lib';
import { MathModule } from '../src/math/math.module';
import { MongoModule } from '../src/mongo/mongo.module';
import { Injectable } from '@nestjs/common';

describe('Multi-Agent Integration', () => {
  it('should inject the correct agent using @InjectAgent', async () => {
    @Injectable()
    class Consumer {
      constructor(
        @InjectAgent('MATH_AGENT') public readonly math: LangChainService,
        @InjectAgent('MONGO_AGENT') public readonly mongo: LangChainService,
      ) {}
    }

    const app = await Test.createTestingModule({
      imports: [
        MathModule,
        MongoModule,
        LangChainModule.register({
          name: 'MATH_AGENT',
          model: { model: 'openai:gpt-4o', apiKey: 'fake' },
          tools: [MathModule],
        }),
        LangChainModule.register({
          name: 'MONGO_AGENT',
          model: { model: 'openai:gpt-4o', apiKey: 'fake' },
          tools: [MongoModule],
        }),
      ],
      providers: [Consumer],
    }).compile();

    const consumer = app.get(Consumer);
    expect(consumer.math).toBeDefined();
    expect(consumer.mongo).toBeDefined();
    // Check that they are different instances
    expect(consumer.math).not.toBe(consumer.mongo);
  });
});
