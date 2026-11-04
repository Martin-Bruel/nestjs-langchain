// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import { ToolCallContext } from '../context/index.js';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import { observeToolCall, RunReporter } from '../logging/index.js';
import { buildToolSchema } from './tool-schema.factory.js';
import { resolveToolName } from './tool-name.util.js';
import { ToolMethod } from './tool-method.util.js';

// What a tool call reads in the config LangChain hands it, its runtime.
// Structural, see #52.
interface ToolCallConfig {
  toolCall?: { id?: string };
  context?: unknown;
  signal?: AbortSignal;
}

// Placed by index: an omitted optional leaves a hole rather than shifting the
// arguments after it.
const toPositional = (
  params: ToolParamMetadata[],
  values: Record<string, unknown>,
  contextParams: number[],
  toolCallContext: ToolCallContext,
): unknown[] => {
  const args: unknown[] = [];

  params.forEach((param) => {
    args[param.index] = values[param.name];
  });
  contextParams.forEach((index) => {
    args[index] = toolCallContext;
  });

  return args;
};

/**
 * Builds the LangChain tool that calls a `@Tool()` method and reports each
 * call to `reporter`. Throws when the name or a parameter schema is invalid.
 */
export const buildTool = (
  {
    where,
    method,
    options,
    params,
    contextParams,
    paramTypes,
    call,
  }: ToolMethod,
  reporter: RunReporter,
): DynamicStructuredTool => {
  const name = resolveToolName(options.name, method, where);

  return new DynamicStructuredTool({
    name,
    description: options.description,
    schema: buildToolSchema(params, paramTypes, where),
    func: (values: Record<string, unknown>, _runManager, config) => {
      const called = config as ToolCallConfig | undefined;

      return observeToolCall(
        reporter,
        {
          tool: name,
          // Empty only for a tool invoked outside an agent.
          callId: called?.toolCall?.id ?? '',
          args: values,
        },
        () =>
          call(
            toPositional(
              params,
              values,
              contextParams,
              // Our fields only, out of LangChain's runtime. Outside an agent,
              // a signal that never aborts. See #322.
              new ToolCallContext(
                called?.context,
                called?.signal ?? new AbortController().signal,
              ),
            ),
          ),
      );
    },
  });
};
