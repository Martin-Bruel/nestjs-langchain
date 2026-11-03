import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';

// The tools whose method reads the run's context.
const readers = new WeakSet<object>();

/**
 * The context a run's tools receive: its own, else the one of the run it is
 * nested in, which LangChain hands down as to any subagent. See #148.
 *
 * @internal
 * @param own The run's `context` option.
 * @returns The context, `undefined` when there is none.
 */
export const effectiveContext = (
  own: object | undefined,
): object | undefined => {
  const caller: { context?: object } | undefined =
    AsyncLocalStorageProviderSingleton.getRunnableConfig();

  return own ?? caller?.context;
};

/**
 * Records that a tool's method reads the run's context.
 *
 * @internal
 * @param tool The LangChain tool built for the method.
 */
export const markReadsContext = (tool: object): void => {
  readers.add(tool);
};

/**
 * Whether a tool's method reads the run's context.
 *
 * @internal
 * @param tool One of the agent's tools.
 * @returns `true` when the method has a `@ToolContext()` parameter.
 */
export const readsContext = (tool: object): boolean => readers.has(tool);
