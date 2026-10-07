import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import {
  AGENT_NAME_TOKEN,
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  getAgentToken,
  OPTIONS_TYPE,
  UNNAMED_AGENT,
} from './langchain.module-definition.js';
import { Agent } from './agent.js';
import {
  LangChainModuleOptions,
  LangChainOptionsFactory,
} from './interfaces/langchain-module-options.interface.js';
import { ToolDiscoveryService } from './tools/index.js';
import { reservedAgentName } from './errors/messages.js';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';

@Module({
  imports: [DiscoveryModule],
  providers: [ToolDiscoveryService, MetadataScanner],
})
export class LangChainModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const dynamicModule = super.register(options);
    return this.addDynamicAgentProvider(dynamicModule, options.name);
  }

  // The generic rejects a key the options do not declare. Nest types
  // `useFactory` as returning `T | Promise<T>`, where a returned literal is
  // never checked for excess properties.
  static registerAsync<
    T extends LangChainModuleOptions &
      Record<Exclude<keyof T, keyof LangChainModuleOptions>, never>,
  >(
    options: Omit<
      typeof ASYNC_OPTIONS_TYPE,
      'useFactory' | 'useClass' | 'useExisting'
    > & {
      // Nest's own signature: `unknown[]` would reject a factory declaring
      // its injected parameters, such as `(config: ConfigService) => …`.
      // oxlint-disable-next-line typescript/no-explicit-any
      useFactory?: (...args: any[]) => T | Promise<T>;
      useClass?: Type<LangChainOptionsFactory>;
      useExisting?: Type<LangChainOptionsFactory>;
    },
  ): DynamicModule {
    const dynamicModule = super.registerAsync(options);
    return this.addDynamicAgentProvider(dynamicModule, options.name);
  }

  private static addDynamicAgentProvider(
    dynamicModule: DynamicModule,
    name: string | undefined,
  ): DynamicModule {
    if (name === '' || name === UNNAMED_AGENT) {
      throw new Error(reservedAgentName(name));
    }

    const nameProvider: Provider = {
      provide: AGENT_NAME_TOKEN,
      useValue: name ?? UNNAMED_AGENT,
    };

    // The class token belongs to the unnamed agent alone, in every module, so
    // `overrideProvider(Agent)` and `get(Agent)` never reach a named one.
    // See #128 and #170.
    if (!name) {
      return {
        ...dynamicModule,
        providers: [...(dynamicModule.providers ?? []), nameProvider, Agent],
        exports: [...(dynamicModule.exports ?? []), Agent],
      };
    }

    const agentToken = getAgentToken(name);

    return {
      ...dynamicModule,
      providers: [
        ...(dynamicModule.providers ?? []),
        nameProvider,
        { provide: agentToken, useClass: Agent },
      ],
      exports: [...(dynamicModule.exports ?? []), agentToken],
    };
  }
}
