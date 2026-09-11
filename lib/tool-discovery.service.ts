import { Injectable, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import {
  TOOL_METADATA,
  TOOL_PARAMS_METADATA,
  ToolOptions,
  ToolParamOptions,
} from './decorators/tool.decorator';
import z from 'zod';
import { DiscoveryService } from '@nestjs/core/discovery/discovery-service';
import { MetadataScanner } from '@nestjs/core';

@Injectable()
export class ToolDiscoveryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  private generateZodSchema(params: any[]) {
    const schemaObject: any = {};

    params.forEach((param) => {
      switch (param.type) {
        case 'number':
          schemaObject[param.name] = z.number().describe(param.description);
          break;
        case 'boolean':
          schemaObject[param.name] = z.boolean().describe(param.description);
          break;
        default:
          schemaObject[param.name] = z.string().describe(param.description);
      }
    });

    return z.object(schemaObject);
  }

  getToolsFromModules(allowedModules: Type[]): DynamicStructuredTool[] {
    const providers = this.discoveryService.getProviders();

    // Compare constructors, not `host.name`. A class name is not an identity:
    // two modules named `ToolsModule` would be indistinguishable.
    const allowed = new Set<Type>(allowedModules);

    const tools: DynamicStructuredTool[] = [];
    providers.forEach((wrapper) => {
      const { instance, host } = wrapper;

      if (!instance || !host || !allowed.has(host.metatype)) {
        return;
      }
      const methodNames = this.metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      );

      methodNames.forEach((name) => {
        const metadata: ToolOptions = Reflect.getMetadata(
          TOOL_METADATA,
          instance[name],
        );
        const paramsMeta: (ToolParamOptions & { index: number })[] =
          Reflect.getMetadata(TOOL_PARAMS_METADATA, instance, name) || [];
        const zodSchema = this.generateZodSchema(paramsMeta);

        if (metadata) {
          tools.push(
            new DynamicStructuredTool({
              name: name,
              description: metadata.description,
              schema: zodSchema,
              func: (args) => {
                const sortedParams = paramsMeta.sort(
                  (a, b) => a.index - b.index,
                );
                const orderedArgs = sortedParams.map((p) => args[p.name]);

                return instance[name](...orderedArgs);
              },
            }),
          );
        }
      });
    });

    return tools;
  }
}
