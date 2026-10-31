import { AgentRunError } from './agent-run.error.js';

/**
 * The run's `signal` was aborted. Its `reason` is in `cause`.
 *
 * @example
 * ```ts
 * try {
 *   await agent.run(question, { signal: AbortSignal.timeout(30_000) });
 * } catch (error) {
 *   if (error instanceof AgentAbortedError) {
 *     console.warn('gave up:', error.cause);
 *   }
 * }
 * ```
 */
export class AgentAbortedError extends AgentRunError {
  constructor(message: string, agent: string, options?: { cause?: unknown }) {
    super(message, agent, options);
    this.name = 'AgentAbortedError';
  }
}
