import { ModuleMetadata } from '@nestjs/common';
import type {
  BaseCallbackHandler,
  CallbackHandlerMethods,
} from '@langchain/core/callbacks/base';
import type { AgentObserver } from './agent-observer.interface.js';

/**
 * Model configuration, resolved at bootstrap through `initChatModel`. Its
 * fields go as they are to the provider class, and a provider that names one
 * differently ignores it (`ChatOllama` reads `numPredict`, not `maxTokens`):
 * pass a model instance then.
 */
export type ModelConfig = {
  /** Provider-qualified name, e.g. `openai:gpt-5-mini`. */
  model: string;
  /** Omit it to let the provider read its own env var, or to use IAM/ADC. */
  apiKey?: string;
  /** The sampling temperature. */
  temperature?: number;
  /** The longest answer, in tokens. */
  maxTokens?: number;
  /** How long one model call may take, in milliseconds. */
  timeout?: number;
  /** How many times a failed model call is retried. */
  maxRetries?: number;
};

/**
 * A LangChain chat model instance, by the members `createAgent` checks for.
 * Structural rather than `BaseChatModel`: a CommonJS application types its
 * model from `@langchain/core`'s other declaration files. See #169.
 */
interface ChatModelLike {
  /** Calls the model. */
  invoke(...args: never[]): Promise<unknown>;
  /** Optional, as on `BaseChatModel`; required at bootstrap. */
  bindTools?(...args: never[]): unknown;
  /** Streams the model's answer. */
  _streamResponseChunks(...args: never[]): unknown;
}

/**
 * A configuration to resolve, or a model that is already built. The instance
 * form takes anything {@link ModelConfig} cannot express.
 */
export type ModelOption = ModelConfig | ChatModelLike;

/**
 * What Nest's own `imports` accepts: a module class, a dynamic module, a
 * promise of one, or a forward reference.
 */
export type ToolModule = NonNullable<ModuleMetadata['imports']>[number];

/**
 * Anything LangChain accepts as a run callback. Every method is optional, so a
 * plain object of the `handle*` you care about is enough.
 */
export type AgentCallback = BaseCallbackHandler | CallbackHandlerMethods;

/** The options of one agent, for `register` or `registerAsync`. */
export interface LangChainModuleOptions {
  /** The chat model: a `provider:model` configuration, or an instance. */
  model: ModelOption;
  /** The instructions the model receives before every run. */
  systemPrompt?: string;
  /**
   * The modules declaring this agent's `@Tool()` providers. Each must also be
   * imported into the Nest context, as a single instance.
   */
  tools?: ToolModule[];
  /** Called as a run goes, so you decide what is worth recording. */
  observer?: AgentObserver;
  /** LangChain-native run callbacks, for handlers written against its API. */
  callbacks?: AgentCallback[];
}

/**
 * A class building an agent's options, for `registerAsync({ useClass })` or
 * `useExisting`. Declare the method's return type, so that a key the options
 * do not declare is rejected.
 */
export interface LangChainOptionsFactory {
  /**
   * Builds the agent's options.
   *
   * @returns The options, or a promise of them.
   */
  createLangChainOptions():
    LangChainModuleOptions | Promise<LangChainModuleOptions>;
}
