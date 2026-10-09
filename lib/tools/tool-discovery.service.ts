import { Injectable, Scope, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import {
  DiscoveryService,
  MetadataScanner,
  ModulesContainer,
} from '@nestjs/core';
import { ToolConfigurationError } from '../errors/index.js';
import {
  toolModuleWithoutTools,
  toolOnNonSingleton,
} from '../errors/messages.js';
import { ToolModule } from '../interfaces/langchain-module-options.interface.js';
import { RunReporter } from '../logging/index.js';
import { buildTool } from './tool.factory.js';
import { readToolMethod, ToolMethod } from './tool-method.util.js';
import { findDuplicateToolNames } from './tool-name.util.js';
import { resolveToolModules } from './tool-modules.util.js';

/**
 * Maps each item, skipping `undefined`. An item that throws adds its message
 * to `problems` rather than stopping the others, so one bad tool does not hide
 * the next.
 */
const collect = <T, R>(
  items: T[],
  map: (item: T) => R | undefined,
  problems: string[],
): R[] =>
  items.flatMap((item) => {
    try {
      const result = map(item);
      return result === undefined ? [] : [result];
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  });

type ProviderWrapper = ReturnType<DiscoveryService['getProviders']>[number];

/**
 * Why a provider is not a singleton, or `undefined` when it is. An agent is
 * one, and a provider built per request or per consumer leaves only an
 * unconstructed placeholder in `instance`. See #127.
 */
const nonSingletonScope = (
  wrapper: ProviderWrapper,
): 'request' | 'transient' | 'request-dependency' | undefined => {
  // `TRANSIENT` reports a static dependency tree.
  if (wrapper.isTransient) {
    return 'transient';
  }

  if (wrapper.isDependencyTreeStatic()) {
    return undefined;
  }

  return wrapper.scope === Scope.REQUEST ? 'request' : 'request-dependency';
};

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

  /**
   * Every `@Tool()` method of the providers that `modules` host. Adds to
   * `declaring` each module declaring one, accepted or not.
   */
  private toolMethods(
    modules: Set<Type>,
    declaring: Set<Type>,
    problems: string[],
  ): ToolMethod[] {
    return this.discoveryService.getProviders().flatMap((wrapper) => {
      const { instance, host } = wrapper;

      // A `useValue` primitive carries no decorator, nor metadata to read.
      if (
        typeof instance !== 'object' ||
        !instance ||
        !host ||
        !modules.has(host.metatype)
      ) {
        return [];
      }

      const reported = problems.length;
      const methods = collect(
        this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance)),
        (method) => readToolMethod(instance, method),
        problems,
      );

      // A method already reported as a problem is one this module declares.
      if (methods.length > 0 || problems.length > reported) {
        declaring.add(host.metatype);
      }

      const scope = nonSingletonScope(wrapper);

      if (scope && methods.length > 0) {
        problems.push(
          toolOnNonSingleton(
            instance.constructor.name,
            scope,
            methods.map(({ method }) => method),
          ),
        );
        return [];
      }

      return methods;
    });
  }

  /** One tool per method, each reporting its calls to `reporter`. */
  private buildTools(
    methods: ToolMethod[],
    reporter: RunReporter,
    problems: string[],
  ): { tool: DynamicStructuredTool; where: string }[] {
    return collect(
      methods,
      (method) => ({ tool: buildTool(method, reporter), where: method.where }),
      problems,
    );
  }

  /**
   * The tools of the modules listed in an agent's `tools` option, each one
   * reporting its calls to `reporter`. Throws a `ToolConfigurationError`
   * listing every problem found: a module that is not imported or declares no
   * tool, a name or a schema that is invalid, two tools sharing a name.
   *
   * Async because an entry may be a `Promise<DynamicModule>`, which Nest's
   * own `imports` accepts.
   */
  async getToolsFromModules(
    entries: ToolModule[],
    reporter: RunReporter,
  ): Promise<DynamicStructuredTool[]> {
    // By constructor, not `host.name`: two modules may share a class name.
    // See #58.
    const { modules, problems } = await resolveToolModules(
      entries,
      this.modulesInContext(),
    );

    const declaring = new Set<Type>();
    const methods = this.toolMethods(modules, declaring, problems);

    modules.forEach((module) => {
      if (!declaring.has(module)) {
        problems.push(toolModuleWithoutTools(module.name));
      }
    });

    const built = this.buildTools(methods, reporter, problems);
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
