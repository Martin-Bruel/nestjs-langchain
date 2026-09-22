import { Injectable, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import {
  PARAM_TYPES_METADATA,
  TOOL_METADATA,
  TOOL_PARAMS_METADATA,
} from '../constants.js';
import {
  ToolOptions,
  ToolParamMetadata,
} from '../decorators/tool.decorator.js';
import { buildToolSchema } from './tool-schema.factory.js';
import { resolveToolName } from './tool-name.util.js';

@Injectable()
export class ToolDiscoveryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

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
        // Undefined on every method without `@Tool()`, which is what the
        // guard below filters on.
        const metadata: ToolOptions | undefined = Reflect.getMetadata(
          TOOL_METADATA,
          instance[name],
        );

        if (!metadata) {
          return;
        }

        // Parameter decorators run right to left. Sorted here so the schema
        // lists the parameters in declaration order.
        const paramsMeta: ToolParamMetadata[] = [
          ...(Reflect.getMetadata(TOOL_PARAMS_METADATA, instance, name) ?? []),
        ].sort((a, b) => a.index - b.index);
        const paramTypes: unknown[] =
          Reflect.getMetadata(PARAM_TYPES_METADATA, instance, name) ?? [];

        const where = `${instance.constructor.name}.${name}`;

        tools.push(
          new DynamicStructuredTool({
            name: resolveToolName(metadata.name, name, where),
            description: metadata.description,
            schema: buildToolSchema(paramsMeta, paramTypes, where),
            func: (values: Record<string, unknown>) => {
              // Placed by index: an omitted optional leaves a hole rather
              // than shifting the arguments after it.
              const args: unknown[] = [];
              paramsMeta.forEach((param) => {
                args[param.index] = values[param.name];
              });

              return instance[name](...args);
            },
          }),
        );
      });
    });

    return tools;
  }
}
