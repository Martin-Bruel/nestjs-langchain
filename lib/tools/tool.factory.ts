// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import { observeToolCall, RunReporter } from '../logging/index.js';
import { buildToolSchema } from './tool-schema.factory.js';
import { resolveToolName } from './tool-name.util.js';
import { ToolMethod } from './tool-method.util.js';

// What the agent's tool node adds to the config. Structural, see #52.
interface ToolCallConfig {
  toolCall?: { id?: string };
}

// Placed by index: an omitted optional leaves a hole rather than shifting the
// arguments after it.
const toPositional = (
  params: ToolParamMetadata[],
  values: Record<string, unknown>,
): unknown[] => {
  const args: unknown[] = [];

  params.forEach((param) => {
    args[param.index] = values[param.name];
  });

  return args;
};

/**
 * Builds the LangChain tool that calls a `@Tool()` method and reports each
 * call to `reporter`. Throws when the name or a parameter schema is invalid.
 */
export const buildTool = (
  { where, method, options, params, paramTypes, call }: ToolMethod,
  reporter: RunReporter,
): DynamicStructuredTool => {
  const name = resolveToolName(options.name, method, where);

  return new DynamicStructuredTool({
    name,
    description: options.description,
    schema: buildToolSchema(params, paramTypes, where),
    func: (values: Record<string, unknown>, _runManager, config) =>
      observeToolCall(
        reporter,
        {
          tool: name,
          // Empty only for a tool invoked outside an agent.
          callId: (config as ToolCallConfig | undefined)?.toolCall?.id ?? '',
          args: values,
        },
        () => call(toPositional(params, values)),
      ),
  });
};
