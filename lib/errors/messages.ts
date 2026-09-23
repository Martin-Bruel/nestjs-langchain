// Message construction, kept together so the wording stays consistent.

export const notAToolModule = (entry: string): string =>
  `${entry} is listed in \`tools\` but is not a module in the Nest context. ` +
  'Pass a class decorated with @Module, imported alongside LangChainModule.';

export const toolModuleNotImported = (entry: string): string =>
  `${entry} is listed in \`tools\` but is not imported into the Nest context. ` +
  'Add it to the `imports` of the module registering the agent.';

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
