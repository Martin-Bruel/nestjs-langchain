import { ConfigurableModuleBuilder } from '@nestjs/common';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface.js';

/** The base class and tokens Nest generates for `LangChainModule`. */
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<LangChainModuleOptions>()
  .setExtras<{ name?: string }>({ name: undefined })
  .setFactoryMethodName('createLangChainOptions')
  .build();

/** The agent's own name. */
export const AGENT_NAME_TOKEN = 'nestjs-langchain:agent-name';

/** The name the unnamed agent carries in logs and observer events. */
export const UNNAMED_AGENT = 'default';

/**
 * The injection token of the agent registered under `name`, for the places
 * `@InjectAgent` cannot go: `overrideProvider` in a test, a factory's
 * `inject`. The string it returns is not part of the API.
 *
 * @param name The `name` the agent was registered with.
 * @returns The agent's injection token.
 * @example
 * ```ts
 * Test.createTestingModule({ imports: [AppModule] })
 *   .overrideProvider(getAgentToken('MATH_AGENT'))
 *   .useValue({ run: async () => ({ status: 'completed', output: '42' }) });
 * ```
 */
export const getAgentToken = (name: string): string =>
  `nestjs-langchain:agent:${name}`;
