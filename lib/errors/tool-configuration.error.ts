/** Every problem found while assembling one agent's tools, reported at once. */
export class ToolConfigurationError extends Error {
  constructor(readonly problems: string[]) {
    const count =
      problems.length === 1 ? '1 problem' : `${problems.length} problems`;

    super(
      `nestjs-langchain found ${count} with the tools of this agent:\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );

    this.name = 'ToolConfigurationError';
  }
}
