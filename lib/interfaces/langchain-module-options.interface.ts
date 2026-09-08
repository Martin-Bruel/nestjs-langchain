import { Type } from '@nestjs/common/interfaces/type.interface';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

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
 * form is the escape hatch for anything {@link ModelConfig} cannot express,
 * and what makes the agent testable without a provider or a network.
 */
export type ModelOption = ModelConfig | BaseChatModel;

export interface LangChainModuleOptions {
  model: ModelOption;
  systemPrompt?: string;
  tools?: Type[];
}
