import { fakeModel } from '@langchain/core/testing';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { silentLogger } from '../tests/fixtures/logging.js';
import { Agent } from './agent.js';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface.js';
import {
  AGENT_NAME_TOKEN,
  MODULE_OPTIONS_TOKEN,
  UNNAMED_AGENT,
} from './langchain.module-definition.js';
import { ToolDiscoveryService } from './tools/index.js';

// `Agent` and its collaborators, without `LangChainModule`'s registration.
const build = async (
  options: LangChainModuleOptions,
): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [
      Agent,
      ToolDiscoveryService,
      { provide: MODULE_OPTIONS_TOKEN, useValue: options },
      { provide: AGENT_NAME_TOKEN, useValue: UNNAMED_AGENT },
    ],
  })
    .setLogger(silentLogger)
    .compile();
  await app.init();
  return app;
};

describe('Agent', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('gives the model the system prompt before the user message', async () => {
    const model = fakeModel().respond(new AIMessage('42'));
    app = await build({ model, systemPrompt: 'Answer with a number.' });

    await app.get(Agent).run('What is 6 times 7?');

    const messages: BaseMessage[] = model.calls[0].messages;
    expect(messages.map((message) => [message.type, message.text])).toEqual([
      ['system', 'Answer with a number.'],
      ['human', 'What is 6 times 7?'],
    ]);
  });
});
