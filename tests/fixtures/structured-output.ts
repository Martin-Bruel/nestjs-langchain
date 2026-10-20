import { fakeModel } from '@langchain/core/testing';
import { AIMessage } from '@langchain/core/messages';

const nameOf = (tool: object): string | undefined => {
  if ('function' in tool) {
    return (tool.function as { name?: string }).name;
  }

  return 'name' in tool ? String(tool.name) : undefined;
};

/**
 * A `fakeModel` whose answers can call the structured output tool, which
 * LangChain names `extract-N` from a global counter when it is bound.
 *
 * @param native Whether the model declares native structured output, as its
 * profile does on a provider that supports it.
 */
export const outputModel = ({ native = false } = {}) => {
  const model = fakeModel();
  let outputTool: string | undefined;
  const bindTools = model.bindTools.bind(model);

  model.bindTools = (tools) => {
    outputTool =
      tools.map(nameOf).find((name) => name?.startsWith('extract-')) ??
      outputTool;
    return bindTools(tools);
  };

  if (native) {
    Object.defineProperty(model, 'profile', {
      value: { structuredOutput: true },
    });
  }

  return {
    model,
    /** The tool the agent offered last for a structured output. */
    outputTool: () => outputTool,
    /** An answer calling the structured output tool with `args`. */
    callOutput:
      (args: Record<string, unknown>, id = 'output') =>
      () =>
        new AIMessage({
          content: '',
          tool_calls: [{ id, name: outputTool ?? 'extract-?', args }],
        }),
  };
};
