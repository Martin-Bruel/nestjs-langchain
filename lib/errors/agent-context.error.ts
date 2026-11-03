import { AgentRunError } from './agent-run.error.js';

/**
 * The run's context is missing or does not match the agent's
 * `contextSchema`. Zod's error is in `cause`.
 *
 * @example
 * ```ts
 * try {
 *   await agent.run(question, { context: { userId: user.id } });
 * } catch (error) {
 *   if (error instanceof AgentContextError) {
 *     throw new UnauthorizedException();
 *   }
 *   throw error;
 * }
 * ```
 */
export class AgentContextError extends AgentRunError {
  constructor(message: string, agent: string, options?: { cause?: unknown }) {
    super(message, agent, options);
    this.name = 'AgentContextError';
  }
}
