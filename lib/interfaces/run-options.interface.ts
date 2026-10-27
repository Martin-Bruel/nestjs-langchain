import type { ZodType } from 'zod';

/**
 * The options of one run. Passed inline, they type `output` from the schema;
 * typed `RunOptions`, `output` is `unknown`.
 *
 * @example
 * ```ts
 * const { output } = await agent.run(email, { output: Ticket }); // a Ticket
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
}
