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
  ModelOption,
} from './interfaces/langchain-module-options.interface.js';
import { CompletedRun } from './interfaces/completed-run.interface.js';
import {
  ToolDiscoveryService,
  toolErrors,
  unknownTools,
} from './tools/index.js';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LOG_CONTEXT, messageOf, RunReporter } from './logging/index.js';
import { summariseRun } from './run/index.js';
import { AgentRunError } from './errors/index.js';
import {
  agentNotBootstrapped,
  agentPrefix,
  agentRunFailed,
  duplicateAgentName,
  modelNeverReplied,
  modelNotBuilt,
  modelReplyEmpty,
  notAChatModel,
} from './errors/messages.js';

// Derived, not imported from `@langchain/core`. See #52.
type AgentModel = Parameters<typeof createAgent>[0]['model'];
type ChatModel = Exclude<AgentModel, string>;
type Graph = ReturnType<typeof createAgent>;
type AgentState = Awaited<ReturnType<Graph['invoke']>>;

/**
 * One agent, registered through `LangChainModule`. Inject it directly for the
 * unnamed agent, or with `@InjectAgent(name)` for a named one.
 *
 * @example
 * ```ts
 * constructor(private readonly agent: Agent) {}
 *
 * async ask(question: string): Promise<string> {
 *   const { output } = await this.agent.run(question);
 *   return output;
 * }
 * ```
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
  // reported by their wrapper and the tool middlewares.
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
    this.prefix = agentPrefix(agentName);
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

  /**
   * Called by Nest: builds the agent, once the tool modules' providers exist.
   *
   * @internal
   */
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
      // The first wraps the next: `toolErrors` sits right around the tool.
      middleware: [unknownTools(this.reporter), toolErrors(this.reporter)],
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
   * caller already built. Recognised by the members `createAgent` checks,
   * never by `instanceof`, which two copies of `@langchain/core` break.
   * See #52.
   *
   * @param option The `model` option.
   * @returns The model `createAgent` receives.
   */
  private async resolveModel(option: ModelOption): Promise<AgentModel> {
    // The types forbid a primitive, an untyped configuration does not. See #236.
    const given: unknown = option;

    if (typeof given !== 'object' || given === null) {
      throw new Error(notAChatModel(this.prefix));
    }

    if (!('invoke' in option)) {
      const { model, ...fields } = option;

      try {
        return await initChatModel(model, fields);
      } catch (error) {
        throw new Error(modelNotBuilt(this.prefix, error), { cause: error });
      }
    }

    if (
      typeof option.invoke !== 'function' ||
      typeof option.bindTools !== 'function' ||
      typeof option._streamResponseChunks !== 'function'
    ) {
      throw new Error(notAChatModel(this.prefix));
    }

    // The same object, typed from the declarations `createAgent` reads.
    return option as unknown as ChatModel;
  }

  /**
   * Runs the agent to completion on one user message. Every failure is thrown
   * as an `AgentRunError`, the original error in its `cause`.
   *
   * @param input The user's message.
   * @returns The model's answer, the tools it called and what the run cost.
   * @example
   * ```ts
   * const { output, tools } = await agent.run('What is 6 times 7?');
   * ```
   */
  async run(input: string): Promise<CompletedRun> {
    const startedAt = Date.now();
    const durationMs = () => Date.now() - startedAt;

    try {
      const { answer, messages } = await this.complete(input);
      const finished = {
        durationMs: durationMs(),
        ...summariseRun(messages),
      };

      this.reporter.notify((observer) =>
        observer.onRunFinish?.({ agent: this.agentName, ...finished }),
      );

      return { status: 'completed', output: answer, ...finished };
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

    if (!last || last.type !== 'ai') {
      throw new AgentRunError(
        modelNeverReplied(this.prefix, last?.type),
        this.agentName,
      );
    }

    // `text`, not `content`: block answers are an array.
    if (!last.text) {
      throw new AgentRunError(modelReplyEmpty(this.prefix), this.agentName);
    }

    return { answer: last.text, messages };
  }
}
