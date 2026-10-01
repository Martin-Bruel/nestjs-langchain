import { duplicateToolName, invalidToolName } from '../errors/messages.js';

// OpenAI's limit, the strictest published. No provider SDK exports it as a
// value, so it is restated here rather than imported.
export const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

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
