import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createAgent, initChatModel } from 'langchain';
import { HumanMessage, Message } from './types/message';
import { MessageFactory } from './factories/message.factory';
import { MODULE_OPTIONS_TOKEN } from './langchain.module-definition';
import {
  LangChainModuleOptions,
  ModelConfig,
  ModelOption,
} from './interfaces/langchain-module-options.interface';
import { ToolDiscoveryService } from './tool-discovery.service';

// Derived, not imported from `@langchain/core`: under CJS the two packages
// resolve to different declarations, giving unrelated identities. See #52.
type AgentModel = Parameters<typeof createAgent>[0]['model'];
type ChatModel = Exclude<AgentModel, string>;

@Injectable()
export class LangChainService implements OnModuleInit {
  private agent: any;
  private readonly logger = new Logger(LangChainService.name);

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: LangChainModuleOptions,
    private readonly toolDiscovery: ToolDiscoveryService,
  ) {}

  /**
   * Discover tools and initialize the agent
   */
  async onModuleInit() {
    const tools = this.toolDiscovery.getToolsFromModules(
      this.options.tools || [],
    );

    this.agent = createAgent({
      model: await this.resolveModel(this.options.model),
      tools,
      systemPrompt: this.options.systemPrompt,
    });

    this.logger.log(`Agent initialized with ${tools.length} tools.`);
  }

  /**
   * Build the model from its configuration, or hand back the instance the
   * caller already built.
   *
   * Duck typing on `invoke` rather than `instanceof BaseChatModel`: a
   * prototype check fails as soon as two copies of `@langchain/core` end up
   * in the tree, on an otherwise perfectly usable model.
   */
  private async resolveModel(option: ModelOption): Promise<AgentModel> {
    if (typeof (option as ChatModel).invoke === 'function') {
      return option as ChatModel;
    }

    const { model, ...fields } = option as ModelConfig;
    return initChatModel(model, fields);
  }

  /**
   * Run the agent with the given input and stream the response
   */
  async run(input: string): Promise<string> {
    const humanMessage = new HumanMessage('no_id', 'user', input);
    humanMessage.content = input;
    Logger.verbose(humanMessage.getLogString());

    for await (const chunk of await this.agent.stream(
      {
        messages: [{ role: 'user', content: input }],
      },
      { streamMode: 'updates' },
    )) {
      const message: Message = MessageFactory.fromLangChain(
        (Object.values(chunk)[0] as any).messages[0],
      );
      Logger.verbose(message.getLogString());
      if (message.isFinished()) {
        return message.content;
      }
    }
    throw new Error('No response from agent.');
  }
}
