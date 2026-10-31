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
