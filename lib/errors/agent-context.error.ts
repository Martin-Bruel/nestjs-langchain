import { AgentRunError } from './agent-run.error.js';

/**
 * The run's context does not match the agent's `contextSchema`, or the run has
 * none and the schema rejects that: a bug in the code calling `run()`. Zod's
 * error is in `cause`.
 *
 * @example
 * ```ts
 * await expect(agent.run(question)).rejects.toThrow(AgentContextError);
 * ```
 */
export class AgentContextError extends AgentRunError {
  constructor(message: string, agent: string, options?: { cause?: unknown }) {
    super(message, agent, options);
    this.name = 'AgentContextError';
  }
}
