import { invalidToolName } from '../errors/messages.js';

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
