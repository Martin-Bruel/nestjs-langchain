import { CallerRun } from './caller-run.js';

/**
 * What can stop a run: its own signal and the one of the run it is nested in,
 * which LangGraph watches whether the run has its own or not. The caller's no
 * longer aborts once the tool's step is over, for a run the tool did not wait
 * for. See #316.
 *
 * @internal
 * @param own The run's `signal` option.
 * @returns A signal aborting with either, `undefined` when there is none.
 */
export const stoppingSignal = (
  own: AbortSignal | undefined,
): AbortSignal | undefined => {
  const { signal } = CallerRun.current();

  return own && signal ? AbortSignal.any([own, signal]) : (own ?? signal);
};
