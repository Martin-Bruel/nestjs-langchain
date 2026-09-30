import { Test, TestingModule } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import {
  Agent,
  AgentRunError,
  LangChainModule,
  ModelOption,
} from '../../lib/index.js';

/** Answers in content blocks, the way Anthropic and Bedrock do. */
class BlockContentModel extends BaseChatModel {
  _llmType(): string {
    return 'block-content';
  }

  // Required by `createAgent`, even with nothing to bind.
  bindTools(): this {
    return this;
  }

  _generate(): Promise<ChatResult> {
    const message = new AIMessage({
      content: [
        { type: 'text', text: 'forty' },
        { type: 'text', text: '-two' },
      ],
    });
    return Promise.resolve({ generations: [{ text: '', message }] });
  }
}

const boot = async (model: ModelOption): Promise<TestingModule> => {
  const app = await Test.createTestingModule({
    imports: [LangChainModule.register({ model })],
  }).compile();
  await app.init();
  return app;
};

describe('run', () => {
  let app: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
  });

  // #57: empty `response_metadata` used to throw `No response from agent`.
  it('returns the answer from a model that sets no finish_reason', async () => {
    app = await boot(new FakeListChatModel({ responses: ['42'] }));

    await expect(app.get(Agent).run('question')).resolves.toBe('42');
  });

  it('returns the answer when it arrives as content blocks', async () => {
    app = await boot(new BlockContentModel({}));

    await expect(app.get(Agent).run('question')).resolves.toBe('forty-two');
  });

  it('raises when the model replies with nothing, and says so', async () => {
    app = await boot(new FakeListChatModel({ responses: [''] }));

    await expect(app.get(Agent).run('question')).rejects.toThrow(
      'The model replied with no text content.',
    );
  });

  it('raises an AgentRunError when run before the application bootstrapped', async () => {
    app = await Test.createTestingModule({
      imports: [
        LangChainModule.register({
          model: new FakeListChatModel({ responses: ['42'] }),
        }),
      ],
    }).compile();

    // compile() alone: onModuleInit never ran.
    const run = app.get(Agent).run('question');

    await expect(run).rejects.toBeInstanceOf(AgentRunError);
    await expect(run).rejects.toMatchObject({
      agent: 'default',
      message:
        'The agent ran before the application bootstrapped. ' +
        'Call `app.init()` or `app.listen()` first.',
    });
  });
});
