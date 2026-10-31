import type { ZodType } from 'zod';

/**
 * The options of one run. Passed inline, they type `output` from the schema;
 * typed `RunOptions`, `output` is `unknown`.
 *
 * @example
 * ```ts
 * const { output } = await agent.run(email, { output: Ticket }); // a Ticket
 * await agent.run(question, { signal: AbortSignal.timeout(30_000) });
 *
 * const ask = (question: string, options?: RunOptions) =>
 *   agent.run(question, options); // `output` is unknown
 * ```
 */
export interface RunOptions {
  /**
   * The schema the answer must match. `output` is then the object it parses,
   * typed from it, instead of the model's text.
   */
  output?: ZodType;
  /**
   * Aborts the run: `run()` throws an `AgentAbortedError`, the signal's
   * `reason` in `cause`. A tool already running ends in the background, its
   * result dropped.
   */
  signal?: AbortSignal;
  /**
   * The most steps the run may take, each model call and each round of tool
   * calls counting as one, instead of the agent's `recursionLimit`. Past it,
   * `run()` throws an `AgentRecursionLimitError`.
   */
  recursionLimit?: number;
}
