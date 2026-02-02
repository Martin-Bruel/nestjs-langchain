import { Type } from '@nestjs/common/interfaces/type.interface';

export type Model = {
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
};

export interface LangChainModuleOptions {
  model: Model;
  systemPrompt?: string;
  imports?: Type<any>[];
}
