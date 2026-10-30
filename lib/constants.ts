// Namespaced like the other tokens, so another library's marks are not read.
export const TOOL_METADATA = 'nestjs-langchain:tool';
export const TOOL_PARAMS_METADATA = 'nestjs-langchain:tool-params';

// Emitted by `emitDecoratorMetadata` on every decorated method.
export const PARAM_TYPES_METADATA = 'design:paramtypes';

// The agent routes a call with this prefix to structured output, never to the
// tool. Restated: LangChain does not export it. See #213.
export const STRUCTURED_OUTPUT_PREFIX = 'extract-';

// Ours rather than LangChain's counter or the schema's title: the same tool on
// every run, under the prefix no `@Tool` can take. See #281.
/**
 * The name of the tool a run with an `output` schema answers through: a test
 * faking the model queues a call to it.
 *
 * @example
 * ```ts
 * const model = fakeModel().respondWithTools([
 *   { name: OUTPUT_TOOL, args: { category: 'bug' } },
 * ]);
 *
 * const { output } = await agent.run(email, { output: Ticket });
 * ```
 */
export const OUTPUT_TOOL = `${STRUCTURED_OUTPUT_PREFIX}output` as const;

// The keys `@Module()` writes, restated: `@nestjs/common/constants` is
// internal. See #97.
export const MODULE_METADATA_KEYS = [
  'imports',
  'providers',
  'controllers',
  'exports',
];
