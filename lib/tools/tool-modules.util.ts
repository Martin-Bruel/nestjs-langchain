import { DynamicModule, ForwardReference, Type } from '@nestjs/common';
import { MODULE_METADATA_KEYS } from '../constants.js';
import {
  notAToolModule,
  severalToolModuleInstances,
  toolModuleNotImported,
} from '../errors/messages.js';
import { ToolModule } from '../interfaces/langchain-module-options.interface.js';

// `@Module({})` writes no metadata at all, so an unimported empty module and a
// plain class are indistinguishable. Only used to sharpen the message.
const looksLikeAModule = (entry: Type): boolean =>
  MODULE_METADATA_KEYS.some(
    (key) => Reflect.getMetadata(key, entry) !== undefined,
  );

interface Resolved {
  type?: Type;
  // A `{ module: Class }` entry says it is a module whatever its metadata
  // holds, which a `@Module({})` host of a dynamic module never holds.
  declaresItself: boolean;
}

/**
 * Reduce an entry to the class Nest registered it under, the way the scanner
 * resolves `imports`: await it, call a forward reference, take `module` off a
 * dynamic module.
 */
const toModuleClass = async (entry: ToolModule): Promise<Resolved> => {
  const awaited: unknown = await entry;

  if (typeof awaited === 'function') {
    return { type: awaited as Type, declaresItself: false };
  }

  if (typeof awaited !== 'object' || awaited === null) {
    return { declaresItself: false };
  }

  const reference = awaited as Partial<ForwardReference<() => ToolModule>>;

  if (typeof reference.forwardRef === 'function') {
    return toModuleClass(reference.forwardRef());
  }

  const dynamic = awaited as Partial<DynamicModule>;

  if (!dynamic.module) {
    return { declaresItself: false };
  }

  return { ...(await toModuleClass(dynamic.module)), declaresItself: true };
};

// Only reached when the entry resolved to no class at all.
const describeEntry = (entry: unknown): string =>
  entry === null || entry === undefined
    ? String(entry)
    : `an entry of type ${typeof entry}`;

export interface ToolModules {
  modules: Set<Type>;
  problems: string[];
}

/**
 * Split the `tools` entries into the modules discovery can match and the
 * problems to report. `inContext` counts the modules Nest registered per
 * class: one per plain import, one per dynamic module.
 */
export const resolveToolModules = async (
  entries: readonly ToolModule[],
  inContext: ReadonlyMap<Type, number>,
): Promise<ToolModules> => {
  const modules = new Set<Type>();
  const problems: string[] = [];

  for (const entry of entries) {
    // A circular import resolves to `undefined` here rather than to a class.
    const { type, declaresItself } = await toModuleClass(entry);
    const instances = type ? (inContext.get(type) ?? 0) : 0;

    if (type && instances === 1) {
      modules.add(type);
      continue;
    }

    // Tools are matched by class, which would merge the instances' tools.
    // See #234.
    if (type && instances > 1) {
      problems.push(severalToolModuleInstances(type.name, instances));
      continue;
    }

    const name = type?.name ?? describeEntry(entry);
    const isModule = type && (declaresItself || looksLikeAModule(type));

    problems.push(
      isModule ? toolModuleNotImported(name) : notAToolModule(name),
    );
  }

  return { modules, problems };
};
