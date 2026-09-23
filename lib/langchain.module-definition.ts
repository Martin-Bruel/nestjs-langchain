import { ConfigurableModuleBuilder } from '@nestjs/common';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface.js';

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

/** The agent's own name. */
export const AGENT_NAME_TOKEN = 'LANGCHAIN_AGENT_NAME';

export const getAgentToken = (name: string) =>
  `LANGCHAIN_AGENT_${name.toUpperCase()}`;
