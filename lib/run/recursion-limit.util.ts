import { CallerRun } from './caller-run.js';

/**
 * Whether a `recursionLimit` is one LangGraph applies: it rejects a limit
 * below 1, but runs on with `NaN`. See #194.
 *
 * @internal
 * @param limit The option as given, from untyped JavaScript too.
 * @returns `true` for an integer of at least 1, or no limit.
 */
export const isRecursionLimit = (limit: unknown): boolean =>
  limit === undefined ||
  (typeof limit === 'number' && Number.isInteger(limit) && limit >= 1);

/**
 * The limit of the run this one is nested in, which LangChain hands down to
 * a subagent. See #324.
 *
 * @internal
 * @returns It, or `undefined` for a run on its own.
 */
export const callerRecursionLimit = (): number | undefined =>
  CallerRun.current().recursionLimit;
