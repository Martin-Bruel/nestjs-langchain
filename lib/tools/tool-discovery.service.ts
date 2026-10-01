import { Injectable, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import {
  DiscoveryService,
  MetadataScanner,
  ModulesContainer,
} from '@nestjs/core';
import { ToolConfigurationError } from '../errors/index.js';
import { ToolModule } from '../interfaces/langchain-module-options.interface.js';
import { RunReporter } from '../logging/index.js';
import { buildTool } from './tool.factory.js';
import { readToolMethod, ToolMethod } from './tool-method.util.js';
import { findDuplicateToolNames } from './tool-name.util.js';
import { resolveToolModules } from './tool-modules.util.js';

/** Finds the `@Tool()` methods of an agent's tool modules and builds their tools. */
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

  /** Every `@Tool()` method of the providers that `modules` host. */
  private toolMethods(modules: Set<Type>): ToolMethod[] {
    return this.discoveryService
      .getProviders()
      .flatMap(({ instance, host }) => {
        if (!instance || !host || !modules.has(host.metatype)) {
          return [];
        }

        return this.metadataScanner
          .getAllMethodNames(Object.getPrototypeOf(instance))
          .map((method) => readToolMethod(instance, method))
          .filter((tool): tool is ToolMethod => tool !== undefined);
      });
  }

  /**
   * One tool per method. A method that cannot become one adds a problem
   * rather than throwing, so one bad tool does not hide the next.
   */
  private buildTools(
    methods: ToolMethod[],
    reporter: RunReporter,
    problems: string[],
  ): { tool: DynamicStructuredTool; where: string }[] {
    return methods.flatMap((method) => {
      try {
        return [{ tool: buildTool(method, reporter), where: method.where }];
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
        return [];
      }
    });
  }

  /**
   * The tools of the modules listed in an agent's `tools` option, each one
   * reporting its calls to `reporter`. Throws a `ToolConfigurationError`
   * listing every problem found: a module that is not imported, a name or a
   * schema that is invalid, two tools sharing a name.
   *
   * Async because an entry may be a `Promise<DynamicModule>`, which Nest's
   * own `imports` accepts.
   */
  async getToolsFromModules(
    entries: ToolModule[],
    reporter: RunReporter,
  ): Promise<DynamicStructuredTool[]> {
    // Compare constructors, not `host.name`. A class name is not an identity:
    // two modules named `ToolsModule` would be indistinguishable.
    const { modules, problems } = await resolveToolModules(
      entries,
      this.modulesInContext(),
    );

    const built = this.buildTools(
      this.toolMethods(modules),
      reporter,
      problems,
    );
    // Per agent: the same name in two agents is legitimate.
    problems.push(
      ...findDuplicateToolNames(
        built.map(({ tool, where }) => ({ name: tool.name, where })),
      ),
    );

    if (problems.length > 0) {
      throw new ToolConfigurationError(problems);
    }

    return built.map(({ tool }) => tool);
  }
}
