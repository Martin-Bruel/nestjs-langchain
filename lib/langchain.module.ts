import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  AGENT_NAME_TOKEN,
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  getAgentToken,
  OPTIONS_TYPE,
} from './langchain.module-definition.js';
import { Agent } from './agent.js';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface.js';
import { ToolDiscoveryService } from './tools/index.js';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';

@Module({
  imports: [DiscoveryModule],
  providers: [Agent, ToolDiscoveryService, MetadataScanner],
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
    options: Omit<typeof ASYNC_OPTIONS_TYPE, 'useFactory'> & {
      // Nest's own signature: `unknown[]` would reject a factory declaring
      // its injected parameters, such as `(config: ConfigService) => …`.
      // oxlint-disable-next-line typescript/no-explicit-any
      useFactory?: (...args: any[]) => T | Promise<T>;
    },
  ): DynamicModule {
    const dynamicModule = super.registerAsync(options);
    return this.addDynamicAgentProvider(dynamicModule, options.name);
  }

  private static addDynamicAgentProvider(
    dynamicModule: DynamicModule,
    name: string | undefined,
  ): DynamicModule {
    const nameProvider: Provider = {
      provide: AGENT_NAME_TOKEN,
      useValue: name ?? 'default',
    };

    // The class token belongs to the unnamed agent alone. See #128.
    if (!name) {
      return {
        ...dynamicModule,
        providers: [...(dynamicModule.providers ?? []), nameProvider],
        exports: [...(dynamicModule.exports ?? []), Agent],
      };
    }

    const agentToken = getAgentToken(name);

    const agentProvider: Provider = {
      provide: agentToken,
      useExisting: Agent,
    };

    return {
      ...dynamicModule,
      providers: [
        ...(dynamicModule.providers ?? []),
        nameProvider,
        agentProvider,
      ],
      exports: [...(dynamicModule.exports ?? []), agentToken],
    };
  }
}
