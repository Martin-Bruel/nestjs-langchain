import {
  duplicateToolName,
  invalidToolName,
  reservedToolName,
} from '../errors/messages.js';

// OpenAI's limit, the strictest published, restated: no provider SDK exports
// it. See #90.
export const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

// The agent routes a call with this prefix to structured output, never to the
// tool. Restated: LangChain does not export it. See #213.
const STRUCTURED_OUTPUT_PREFIX = 'extract-';

export const resolveToolName = (
  declared: string | undefined,
  method: string,
  where: string,
): string => {
  const name = declared ?? method;

  if (!TOOL_NAME.test(name)) {
    throw new Error(
      invalidToolName(where, name, String(TOOL_NAME), declared === undefined),
    );
  }

  if (name.startsWith(STRUCTURED_OUTPUT_PREFIX)) {
    throw new Error(reservedToolName(where, name, STRUCTURED_OUTPUT_PREFIX));
  }

  return name;
};

/**
 * One problem per tool whose name an earlier tool already took, naming both
 * methods. `where` is the method each tool was built from.
 */
export const findDuplicateToolNames = (
  tools: { name: string; where: string }[],
): string[] => {
  const seen = new Map<string, string>();
  const problems: string[] = [];

  tools.forEach(({ name, where }) => {
    const first = seen.get(name);

    if (first) {
      problems.push(duplicateToolName(name, first, where));
      return;
    }

    seen.set(name, where);
  });

  return problems;
};
