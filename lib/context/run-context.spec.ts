import { AsyncLocalStorage } from 'node:async_hooks';
import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';
import { effectiveContext } from './run-context.js';

// What `@langchain/langgraph` installs on load, which an agent always has.
AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
  new AsyncLocalStorage(),
);

describe('effectiveContext', () => {
  const caller = { userId: 'alice' };

  // As LangGraph runs a tool: inside the config of the run that calls it.
  const inCallerRun = <T>(callback: () => T): T =>
    AsyncLocalStorageProviderSingleton.runWithConfig(
      { context: caller },
      callback,
    );

  it("is the run's own context", () => {
    const own = { userId: 'bob' };

    expect(effectiveContext(own)).toBe(own);
    expect(inCallerRun(() => effectiveContext(own))).toBe(own);
  });

  it("is the caller's context for a run without its own", () => {
    expect(inCallerRun(() => effectiveContext(undefined))).toBe(caller);
  });

  it('is none for a run on its own without context', () => {
    expect(effectiveContext(undefined)).toBeUndefined();
  });
});
