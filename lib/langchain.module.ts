import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  AGENT_NAME_TOKEN,
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  getAgentToken,
  OPTIONS_TYPE,
} from './langchain.module-definition.js';
import { LangChainService } from './langchain.service.js';
import { ToolDiscoveryService } from './tools/index.js';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';

@Module({
  imports: [DiscoveryModule],
  providers: [LangChainService, ToolDiscoveryService, MetadataScanner],
  exports: [LangChainService],
})
export class LangChainModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const dynamicModule = super.register(options);
    return this.addDynamicAgentProvider(dynamicModule, options.name);
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
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

    if (!name) {
      return {
        ...dynamicModule,
        providers: [...(dynamicModule.providers ?? []), nameProvider],
      };
    }

    const agentToken = getAgentToken(name);

    const agentProvider: Provider = {
      provide: agentToken,
      useExisting: LangChainService,
    };

    return {
      ...dynamicModule,
      providers: [
        ...(dynamicModule.providers ?? []),
        nameProvider,
        agentProvider,
      ],
      exports: [agentToken],
    };
  }
}
