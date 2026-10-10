import { agentPrefix, toolProblems } from './messages.js';

/**
 * An agent's tools are misconfigured, which fails the bootstrap. Lists every
 * problem found while assembling them, not only the first.
 *
 * @example
 * ```ts
 * const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
 *
 * await expect(app.init()).rejects.toThrow(ToolConfigurationError);
 * ```
 */
export class ToolConfigurationError extends Error {
  constructor(
    /** One message per problem, in the order they were found. */
    readonly problems: string[],
    /** `'default'` when the agent was registered without a name. */
    readonly agent: string,
  ) {
    super(toolProblems(agentPrefix(agent), problems));
    this.name = 'ToolConfigurationError';
  }
}
