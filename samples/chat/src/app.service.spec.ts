import { Test } from '@nestjs/testing';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { LangChainModule } from 'nestjs-langchain';
import { AppService } from './app.service.js';

describe('AppService', () => {
  it('asks the agent for a poem on the topic', async () => {
    // Replays one answer: no provider key, no network.
    const model = fakeModel().respond(
      new AIMessage('Upon the restless sea | the silver waves are born'),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [LangChainModule.register({ model })],
      providers: [AppService],
    }).compile();
    // The agent is built on init, which `compile()` does not run.
    await moduleRef.init();

    await expect(
      moduleRef.get(AppService).writeAPoemOn('the sea'),
    ).resolves.toBe('Upon the restless sea | the silver waves are born');
    expect(model.calls[0].messages.at(-1)?.text).toBe(
      'Write a poem about the sea',
    );

    await moduleRef.close();
  });
});
