import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { createAgent, initChatModel } from 'langchain';
import {
  AGENT_NAME_TOKEN,
  MODULE_OPTIONS_TOKEN,
  UNNAMED_AGENT,
} from './langchain.module-definition.js';
import {
  LangChainModuleOptions,
  ModelConfig,
  ModelOption,
} from './interfaces/langchain-module-options.interface.js';
import { ToolDiscoveryService } from './tools/index.js';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import {
  LOG_CONTEXT,
  messageOf,
  RunReporter,
  summariseRun,
} from './logging/index.js';
import { AgentRunError } from './errors/index.js';
import {
  agentNotBootstrapped,
  agentRunFailed,
  duplicateAgentName,
  modelNeverReplied,
  modelReplyEmpty,
} from './errors/messages.js';

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
  private readonly reporter: RunReporter;
  // Model failures, which only LangChain's callbacks see. Tool calls are
  // reported by their wrapper.
  private readonly modelErrors: BaseCallbackHandler;

  /** @internal Built by `LangChainModule`, never by hand. */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: LangChainModuleOptions,
    @Inject(AGENT_NAME_TOKEN)
    private readonly agentName: string,
    private readonly toolDiscovery: ToolDiscoveryService,
    private readonly discovery: DiscoveryService,
  ) {
    this.prefix = agentName === UNNAMED_AGENT ? '' : `${agentName} `;
    this.reporter = new RunReporter({
      logger: this.logger,
      agent: agentName,
      prefix: this.prefix,
      observer: options.observer,
    });
    this.modelErrors = BaseCallbackHandler.fromMethods({
      handleLLMError: (error: unknown) => {
        this.reporter.logError(`the model failed: ${messageOf(error)}`);
        this.reporter.notify((observer) =>
          observer.onModelError?.({ agent: agentName, error }),
        );
      },
    });
  }

  async onModuleInit() {
    this.assertUniqueName();

    const tools = await this.toolDiscovery.getToolsFromModules(
      this.options.tools ?? [],
      this.reporter,
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

  // Every registration provides its own name, so a name found twice in the
  // container is two agents behind one token.
  private assertUniqueName(): void {
    const registered = this.discovery
      .getProviders()
      .filter(
        ({ token, instance }) =>
          token === AGENT_NAME_TOKEN && instance === this.agentName,
      );

    if (registered.length > 1) {
      throw new Error(
        duplicateAgentName(
          this.agentName === UNNAMED_AGENT ? undefined : this.agentName,
        ),
      );
    }
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

  /**
   * Run the agent to completion and return its text answer. Every failure is
   * thrown as an `AgentRunError`, the original error in its `cause`.
   */
  async run(input: string): Promise<string> {
    const startedAt = Date.now();
    const durationMs = () => Date.now() - startedAt;

    try {
      const { answer, messages } = await this.complete(input);

      this.reporter.notify((observer) =>
        observer.onRunFinish?.({
          agent: this.agentName,
          durationMs: durationMs(),
          ...summariseRun(messages),
        }),
      );

      return answer;
    } catch (thrown) {
      const error =
        thrown instanceof AgentRunError
          ? thrown
          : new AgentRunError(
              agentRunFailed(this.prefix, thrown),
              this.agentName,
              { cause: thrown },
            );

      this.reporter.notify((observer) =>
        observer.onRunError?.({
          agent: this.agentName,
          durationMs: durationMs(),
          error,
        }),
      );

      throw error;
    }
  }

  private async complete(
    input: string,
  ): Promise<{ answer: string; messages: AgentState['messages'] }> {
    if (!this.#graph) {
      throw new AgentRunError(
        agentNotBootstrapped(this.prefix),
        this.agentName,
      );
    }

    const { messages }: AgentState = await this.#graph.invoke(
      { messages: [{ role: 'user', content: input }] },
      { callbacks: [this.modelErrors, ...(this.options.callbacks ?? [])] },
    );

    const last = messages[messages.length - 1];

    if (!last || last.getType() !== 'ai') {
      throw new AgentRunError(
        modelNeverReplied(last?.getType()),
        this.agentName,
      );
    }

    // `text`, not `content`: block answers are an array.
    if (!last.text) {
      throw new AgentRunError(modelReplyEmpty(), this.agentName);
    }

    return { answer: last.text, messages };
  }
}
