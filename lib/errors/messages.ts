// Message construction, kept together so the wording stays consistent.

export const notAToolModule = (entry: string): string =>
  `${entry} is listed in \`tools\` but is not a module in the Nest context. ` +
  'Pass a class decorated with @Module, imported alongside LangChainModule.';

export const toolModuleNotImported = (entry: string): string =>
  `${entry} is listed in \`tools\` but is not imported into the Nest context. ` +
  'Add it to the `imports` of the module registering the agent.';

export const toolModuleWithoutTools = (entry: string): string =>
  `${entry} is listed in \`tools\` but declares no @Tool method. ` +
  'Tools are read from the providers a module declares, not from the ' +
  'modules it imports.';

export const toolParamWithoutTool = (where: string): string =>
  `${where} has @ToolParam but no @Tool, so the model never sees it. ` +
  'Add @Tool({ description }) to expose it, or remove the @ToolParam.';

export const toolOnNonSingleton = (
  provider: string,
  scope: 'request' | 'transient' | 'request-dependency',
  methods: string[],
): string =>
  `${provider} ${
    {
      request: 'is request-scoped',
      transient: 'is transient',
      'request-dependency': 'depends on a request-scoped provider',
    }[scope]
  }, so its @Tool methods (${methods.join(', ')}) cannot be called by an ` +
  'agent, which is a singleton. Make it a default-scoped provider.';

export const duplicateToolName = (
  name: string,
  first: string,
  second: string,
): string =>
  `Two tools are named "${name}": ${first} and ${second}. ` +
  'Give one of them a `name` in @Tool().';

export const invalidToolName = (
  where: string,
  name: string,
  pattern: string,
  fromMethodName: boolean,
): string =>
  `${where}: "${name}" is not a valid tool name, providers match ${pattern}` +
  (fromMethodName ? '. Pass a `name` to @Tool().' : '.');

export const cannotInferSchema = (
  where: string,
  param: string,
  declared: string,
): string =>
  `${where}: cannot infer a schema for "${param}" declared as ${declared}. ` +
  'Pass a `schema` to @ToolParam, or use string, number or boolean.';

export const schemaContradictsSignature = (
  where: string,
  param: string,
  declared: string[],
  expected: string,
): string =>
  `${where}: the schema for "${param}" describes ${declared.join(' | ')} ` +
  `but the signature declares ${expected}.`;

export const noJsonSchemaForm = (
  where: string,
  param: string,
  reason: string,
): string =>
  `${where}: "${param}" has no JSON Schema form (${reason}). ` +
  'Declare a schema JSON Schema can express and convert it with .transform(), ' +
  'such as z.iso.datetime() for a date.';

export const duplicateParamName = (
  where: string,
  name: string,
  first: number,
  second: number,
): string =>
  `${where}: parameters ${first + 1} and ${second + 1} are both named "${name}". ` +
  'Give each @ToolParam its own name.';

export const notAChatModel = (): string =>
  "`model` is neither a LangChain chat model nor a `{ model: 'provider:name' }` " +
  'configuration. Pass a chat model instance (e.g. `new ChatOpenAI(...)`) or ' +
  'a configuration.';

export const agentNotBootstrapped = (prefix: string): string =>
  `The ${prefix}agent ran before the application bootstrapped. ` +
  'Call `app.init()` or `app.listen()` first.';

export const duplicateAgentName = (name: string | undefined): string =>
  name === undefined
    ? 'Two agents are registered without a name. ' +
      'Give all but one a `name` and inject them with @InjectAgent().'
    : `Two agents are registered as "${name}". ` +
      'Give each LangChainModule registration its own `name`.';

export const reservedAgentName = (name: string): string =>
  name === ''
    ? "An agent's `name` cannot be empty. " +
      'Omit it to register the unnamed agent.'
    : `"${name}" cannot be an agent's \`name\`: it stands for the agent ` +
      'registered without one. Pick another name.';

export const agentRunFailed = (prefix: string, cause: unknown): string =>
  `The ${prefix}agent's run failed: ` +
  (cause instanceof Error ? cause.message : String(cause));

export const modelNeverReplied = (last: string | undefined): string =>
  'The agent loop ended before the model replied. The last message was ' +
  `${last ? `a ${last} message` : 'never produced'}.`;

export const modelReplyEmpty = (): string =>
  'The model replied with no text content.';

export const unknownTool = (): string => 'not a tool of this agent';
