import type { RunSummary } from '../run/index.js';

/**
 * A run that went to completion. `status` may gain values in a minor release:
 * keep a `default` branch when switching on it.
 */
export interface CompletedRun<TOutput = string> extends RunSummary {
  status: 'completed';
  /** The model's text answer. */
  output: TOutput;
  durationMs: number;
}
