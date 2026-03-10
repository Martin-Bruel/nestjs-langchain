import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  getAgentToken,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from './langchain.module-definition';
import { LangChainService } from './langchain.service';
import { ToolDiscoveryService } from './tool-discovery.service';
import { LangChainModuleOptions } from './interfaces/langchain-module-options.interface';
import { DiscoveryService } from '@nestjs/core/discovery/discovery-service';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { DiscoveryModule } from '@nestjs/core';

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
    if (!name) return dynamicModule;

    const agentToken = getAgentToken(name);

    const agentProvider: Provider = {
      provide: agentToken,
      useFactory: (
        opts: LangChainModuleOptions,
        discovery: DiscoveryService,
        scanner: MetadataScanner,
      ) => {
        const toolDiscovery = new ToolDiscoveryService(discovery, scanner);
        const agent = new LangChainService(opts, toolDiscovery);
        return agent;
      },
      inject: [MODULE_OPTIONS_TOKEN, DiscoveryService, MetadataScanner],
    };

    return {
      ...dynamicModule,
      providers: [...(dynamicModule.providers || []), agentProvider],
      exports: [agentToken],
    };
  }
}
