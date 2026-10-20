import { AgentRunError } from './agent-run.error.js';

/**
 * The model's answer to a run with an `output` schema never came, or does not
 * match the schema. LangChain's or Zod's error, if any, is in `cause`.
 *
 * @example
 * ```ts
 * try {
 *   const { output } = await agent.run(ticket, { output: Classification });
 * } catch (error) {
 *   if (error instanceof StructuredOutputError) {
 *     console.error(error.message, error.cause);
 *   }
 * }
 * ```
 */
export class StructuredOutputError extends AgentRunError {
  constructor(message: string, agent: string, options?: { cause?: unknown }) {
    super(message, agent, options);
    this.name = 'StructuredOutputError';
  }
}
