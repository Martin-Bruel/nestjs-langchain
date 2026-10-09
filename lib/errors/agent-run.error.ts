/**
 * A run of an agent failed. The base class of every run failure: everything
 * `run()` throws is one, with the original error, if any, in `cause`.
 *
 * @example
 * ```ts
 * try {
 *   await agent.run(question);
 * } catch (error) {
 *   if (error instanceof AgentRunError) {
 *     console.error(error.agent, error.cause);
 *   }
 * }
 * ```
 */
export class AgentRunError extends Error {
  /** The error that made the run fail, when it came from elsewhere. */
  declare readonly cause?: unknown;

  constructor(
    message: string,
    /** `'default'` when the agent was registered without a name. */
    readonly agent: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AgentRunError';
  }
}
