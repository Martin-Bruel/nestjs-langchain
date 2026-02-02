import { ConfigurableModuleBuilder } from '@nestjs/common';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<LangChainModuleOptions>()
  .setExtras({ name: 'default' }, (definition, extras) => ({
    ...definition,
    tag: extras.name,
  }))
  .build();

export const getAgentToken = (name: string) =>
  `LANGCHAIN_AGENT_${name.toUpperCase()}`;
