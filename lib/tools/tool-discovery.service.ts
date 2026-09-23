import { Injectable, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import {
  DiscoveryService,
  MetadataScanner,
  ModulesContainer,
} from '@nestjs/core';
import {
  PARAM_TYPES_METADATA,
  TOOL_METADATA,
  TOOL_PARAMS_METADATA,
} from '../constants.js';
import {
  ToolOptions,
  ToolParamMetadata,
} from '../decorators/tool.decorator.js';
import { ToolConfigurationError } from '../errors/index.js';
import { duplicateToolName } from '../errors/messages.js';
import { ToolModule } from '../interfaces/langchain-module-options.interface.js';
import { buildToolSchema } from './tool-schema.factory.js';
import { resolveToolName } from './tool-name.util.js';
import { resolveToolModules } from './tool-modules.util.js';

interface Discovered {
  tool: DynamicStructuredTool;
  where: string;
}

@Injectable()
export class ToolDiscoveryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly modulesContainer: ModulesContainer,
  ) {}

  private modulesInContext(): Set<Type> {
    const modules = new Set<Type>();

    this.modulesContainer.forEach((module) => modules.add(module.metatype));

    return modules;
  }

  private collect(allowed: Set<Type>, problems: string[]): Discovered[] {
    const discovered: Discovered[] = [];

    this.discoveryService.getProviders().forEach((wrapper) => {
      const { instance, host } = wrapper;

      if (!instance || !host || !allowed.has(host.metatype)) {
        return;
      }

      const methodNames = this.metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      );

      methodNames.forEach((method) => {
        // Undefined on every method without `@Tool()`, which is what the
        // guard below filters on.
        const metadata: ToolOptions | undefined = Reflect.getMetadata(
          TOOL_METADATA,
          instance[method],
        );

        if (!metadata) {
          return;
        }

        // Parameter decorators run right to left. Sorted here so the schema
        // lists the parameters in declaration order.
        const paramsMeta: ToolParamMetadata[] = [
          ...(Reflect.getMetadata(TOOL_PARAMS_METADATA, instance, method) ??
            []),
        ].sort((a, b) => a.index - b.index);
        const paramTypes: unknown[] =
          Reflect.getMetadata(PARAM_TYPES_METADATA, instance, method) ?? [];

        const where = `${instance.constructor.name}.${method}`;

        // Collected rather than rethrown, so one bad tool does not hide the
        // next one.
        try {
          discovered.push({
            where,
            tool: new DynamicStructuredTool({
              name: resolveToolName(metadata.name, method, where),
              description: metadata.description,
              schema: buildToolSchema(paramsMeta, paramTypes, where),
              func: (values: Record<string, unknown>) => {
                // Placed by index: an omitted optional leaves a hole rather
                // than shifting the arguments after it.
                const args: unknown[] = [];
                paramsMeta.forEach((param) => {
                  args[param.index] = values[param.name];
                });

                return instance[method](...args);
              },
            }),
          });
        } catch (error) {
          problems.push(error instanceof Error ? error.message : String(error));
        }
      });
    });

    return discovered;
  }

  // Per agent: the same name in two agents is legitimate.
  private duplicates(discovered: Discovered[]): string[] {
    const seen = new Map<string, string>();
    const problems: string[] = [];

    discovered.forEach(({ tool, where }) => {
      const first = seen.get(tool.name);

      if (first) {
        problems.push(duplicateToolName(tool.name, first, where));
        return;
      }

      seen.set(tool.name, where);
    });

    return problems;
  }

  // Async because an entry may be a `Promise<DynamicModule>`, which Nest's
  // own `imports` accepts.
  async getToolsFromModules(
    entries: ToolModule[],
  ): Promise<DynamicStructuredTool[]> {
    // Compare constructors, not `host.name`. A class name is not an identity:
    // two modules named `ToolsModule` would be indistinguishable.
    const { modules, problems } = await resolveToolModules(
      entries,
      this.modulesInContext(),
    );

    const discovered = this.collect(modules, problems);
    problems.push(...this.duplicates(discovered));

    if (problems.length > 0) {
      throw new ToolConfigurationError(problems);
    }

    return discovered.map(({ tool }) => tool);
  }
}
