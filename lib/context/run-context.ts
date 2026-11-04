import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';

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
