import { ModuleMetadata } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  BaseCallbackHandler,
  CallbackHandlerMethods,
} from '@langchain/core/callbacks/base';
import type { AgentObserver } from './agent-observer.interface.js';

/** Model configuration, resolved at bootstrap through `initChatModel`. */
export type ModelConfig = {
  /** Provider-qualified name, e.g. `openai:gpt-5-mini`. */
  model: string;
  /** Omit it to let the provider read its own env var, or to use IAM/ADC. */
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
};

/**
 * A configuration to resolve, or a model that is already built. The instance
 * form takes anything {@link ModelConfig} cannot express.
 */
export type ModelOption = ModelConfig | BaseChatModel;

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

export interface LangChainModuleOptions {
  model: ModelOption;
  systemPrompt?: string;
  tools?: ToolModule[];
  /** Called as a run goes, so you decide what is worth recording. */
  observer?: AgentObserver;
  /** LangChain-native run callbacks, for handlers written against its API. */
  callbacks?: AgentCallback[];
}
