import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createAgent, initChatModel } from 'langchain';
import {
  AGENT_NAME_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from './langchain.module-definition.js';
import {
  LangChainModuleOptions,
  ModelConfig,
  ModelOption,
} from './interfaces/langchain-module-options.interface.js';
import { ToolDiscoveryService } from './tools/index.js';
import {
  AgentLoggerHandler,
  LOG_CONTEXT,
  notify,
  summariseRun,
} from './logging/index.js';
import { AgentRunError } from './errors/index.js';
import { agentNotBootstrapped } from './errors/messages.js';

// Derived, not imported from `@langchain/core`. See #52.
type AgentModel = Parameters<typeof createAgent>[0]['model'];
type ChatModel = Exclude<AgentModel, string>;
type Graph = ReturnType<typeof createAgent>;
type AgentState = Awaited<ReturnType<Graph['invoke']>>;

/**
 * One agent, registered through `LangChainModule`. Inject it directly for the
 * unnamed agent, or with `@InjectAgent(name)` for a named one.
 */
@Injectable()
export class Agent implements OnModuleInit {
  // Assembled in `onModuleInit`, once every tool module's providers exist.
  #graph?: Graph;
  // Without a context, since Nest appends the instance's to each call's own.
  private readonly logger = new Logger();
  private readonly prefix: string;
  private readonly handler: AgentLoggerHandler;

  /** @internal Built by `LangChainModule`, never by hand. */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: LangChainModuleOptions,
    @Inject(AGENT_NAME_TOKEN)
    private readonly agentName: string,
    private readonly toolDiscovery: ToolDiscoveryService,
  ) {
    this.prefix = agentName === 'default' ? '' : `${agentName} `;
    this.handler = new AgentLoggerHandler({
      logger: this.logger,
      agent: agentName,
      prefix: this.prefix,
      observer: options.observer,
    });
  }

  async onModuleInit() {
    const tools = await this.toolDiscovery.getToolsFromModules(
      this.options.tools ?? [],
    );

    this.#graph = createAgent({
      model: await this.resolveModel(this.options.model),
      tools,
      systemPrompt: this.options.systemPrompt,
    });

    this.logger.log(
      `${this.prefix}ready with ${tools.length} tool${tools.length === 1 ? '' : 's'}`,
      LOG_CONTEXT,
    );
  }

  /**
   * Build the model from its configuration, or hand back the instance the
   * caller already built. Duck typed on `invoke` rather than `instanceof`,
   * which two copies of `@langchain/core` break. See #52.
   */
  private async resolveModel(option: ModelOption): Promise<AgentModel> {
    if (typeof (option as ChatModel).invoke === 'function') {
      return option as ChatModel;
    }

    const { model, ...fields } = option as ModelConfig;
    return initChatModel(model, fields);
  }

  /** Run the agent to completion and return its text answer. */
  async run(input: string): Promise<string> {
    if (!this.#graph) {
      throw new AgentRunError(
        agentNotBootstrapped(this.prefix),
        this.agentName,
      );
    }

    const startedAt = Date.now();
    const { messages }: AgentState = await this.#graph.invoke(
      { messages: [{ role: 'user', content: input }] },
      { callbacks: [this.handler, ...(this.options.callbacks ?? [])] },
    );

    const { observer } = this.options;

    if (observer) {
      notify(
        () =>
          observer.onRunFinish?.({
            agent: this.agentName,
            durationMs: Date.now() - startedAt,
            ...summariseRun(messages),
          }),
        (error) =>
          this.logger.error(
            `${this.prefix}the observer failed: ${error instanceof Error ? error.message : String(error)}`,
            LOG_CONTEXT,
          ),
      );
    }

    const last = messages[messages.length - 1];

    if (!last || last.getType() !== 'ai') {
      throw new Error(
        'The agent loop ended before the model replied. The last message was ' +
          `${last ? `a ${last.getType()} message` : 'never produced'}.`,
      );
    }

    // `text`, not `content`: block answers are an array.
    if (!last.text) {
      throw new Error('The model replied with no text content.');
    }

    return last.text;
  }
}
