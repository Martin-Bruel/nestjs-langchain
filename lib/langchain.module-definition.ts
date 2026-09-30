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
export const AGENT_NAME_TOKEN = 'nestjs-langchain:agent-name';

/** The name the unnamed agent carries in logs and observer events. */
export const UNNAMED_AGENT = 'default';

/**
 * The injection token of the agent registered under `name`, for the places
 * `@InjectAgent` cannot go: `overrideProvider` in a test, a factory's
 * `inject`. The string it returns is not part of the API.
 */
export const getAgentToken = (name: string): string =>
  `nestjs-langchain:agent:${name}`;
