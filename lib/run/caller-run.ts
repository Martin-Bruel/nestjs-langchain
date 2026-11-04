import type { Callbacks } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';

// `RunnableConfig` types all but `context`, which is LangGraph's.
type CallerConfig = RunnableConfig & { context?: object };

/**
 * What a run inherits from the run whose tool called it: the config LangChain
 * hands down to a subagent, and the only place the library reads it. See #339.
 *
 * Inside a tool, the config can contain `callbacks`, `configurable` (including
 * LangGraph internals and library-specific keys), `context`, `maxConcurrency`,
 * `metadata`, `recursionLimit`, `signal`, `store`, `tags`, and `timeout`.
 * Outside a run it is `undefined`. The library reads four of these properties:
 *
 * - `context`: a run without one takes its caller's. See #148.
 * - `signal`: a run stops with its caller's too. See #316.
 * - `recursionLimit`: a run without one takes its caller's. See #324.
 * - `callbacks`: a run nests in its caller's trace. See #323.
 *
 * `current()` reads the config when called, not earlier, so each read sees the
 * run the caller is in at that moment.
 *
 * @internal
 */
export class CallerRun {
  private constructor(private readonly config: CallerConfig | undefined) {}

  /** @returns The caller's run, whose getters are `undefined` outside one. */
  static current(): CallerRun {
    return new CallerRun(
      AsyncLocalStorageProviderSingleton.getRunnableConfig(),
    );
  }

  /** The caller's `context` option. See #148. */
  get context(): object | undefined {
    return this.config?.context;
  }

  /** The caller's `signal`. See #316. */
  get signal(): AbortSignal | undefined {
    return this.config?.signal;
  }

  /** The caller's `recursionLimit`. See #324. */
  get recursionLimit(): number | undefined {
    return this.config?.recursionLimit;
  }

  /**
   * The caller's `callbacks`: the manager LangChain hands down, recognised by
   * its methods rather than `instanceof`. See #323 and #52.
   */
  get callbacks(): Callbacks | undefined {
    return this.config?.callbacks;
  }
}
