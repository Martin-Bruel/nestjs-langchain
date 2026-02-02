import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createAgent, initChatModel } from 'langchain';
import { HumanMessage, Message } from './types/message';
import { MessageFactory } from './factories/message.factory';
import { MODULE_OPTIONS_TOKEN } from './langchain.module-definition';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface';
import { ToolDiscoveryService } from './tool-discovery.service';

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
      this.options.imports || [],
    );

    const modelName = this.options.model.model;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { model: _, ...modelFields } = this.options.model;
    const model = await initChatModel(modelName, modelFields);
    this.agent = createAgent({
      model,
      tools,
      systemPrompt: this.options.systemPrompt,
    });

    this.logger.log(`Agent initialized with ${tools.length} tools.`);
  }

  /**
   * Run the agent with the given input and stream the response
   */
  async run(input: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const humanMessage = new HumanMessage();
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
          resolve(message.content);
        }
      }
      reject('No response from agent.');
    });
  }
}
