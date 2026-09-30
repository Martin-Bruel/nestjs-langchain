/** A run of an agent failed. The base class of every run failure. */
export class AgentRunError extends Error {
  constructor(
    message: string,
    /** `'default'` when the agent was registered without a name. */
    readonly agent: string,
  ) {
    super(message);
    this.name = 'AgentRunError';
  }
}
