import { AgentRunError } from './agent-run.error.js';

/**
 * The run took its `recursionLimit` of steps without an answer: the model kept
 * calling tools. LangGraph's error is in `cause`.
 *
 * @example
 * ```ts
 * try {
 *   await agent.run(question, { recursionLimit: 10 });
 * } catch (error) {
 *   if (error instanceof AgentRecursionLimitError) {
 *     return 'This question needs too many steps.';
 *   }
 *   throw error;
 * }
 * ```
 */
export class AgentRecursionLimitError extends AgentRunError {
  constructor(message: string, agent: string, options?: { cause?: unknown }) {
    super(message, agent, options);
    this.name = 'AgentRecursionLimitError';
  }
}
