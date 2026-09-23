import { Type } from '@nestjs/common';
import { MODULE_METADATA_KEYS } from '../constants.js';
import { notAToolModule, toolModuleNotImported } from '../errors/messages.js';

// `@Module({})` writes no metadata at all, so an unimported empty module and a
// plain class are indistinguishable. Only used to sharpen the message.
const looksLikeAModule = (entry: Type): boolean =>
  MODULE_METADATA_KEYS.some(
    (key) => Reflect.getMetadata(key, entry) !== undefined,
  );

// Only reached when the entry is no class at all.
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
 * problems to report. `inContext` holds every module Nest instantiated.
 */
export const resolveToolModules = (
  entries: readonly Type[],
  inContext: Set<Type>,
): ToolModules => {
  const modules = new Set<Type>();
  const problems: string[] = [];

  entries.forEach((entry) => {
    if (inContext.has(entry)) {
      modules.add(entry);
      return;
    }

    // A circular import resolves to `undefined` here rather than to a class.
    const candidate = entry as Type | undefined;
    const name = candidate?.name ?? describeEntry(entry);

    problems.push(
      candidate && looksLikeAModule(candidate)
        ? toolModuleNotImported(name)
        : notAToolModule(name),
    );
  });

  return { modules, problems };
};
