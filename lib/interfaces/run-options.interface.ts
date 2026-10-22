import type { ZodType } from 'zod';

/** The options of one run. */
export interface RunOptions {
  /**
   * The schema the answer must match. `output` is then the object it parses,
   * typed from it, instead of the model's text.
   */
  output?: ZodType;
}
