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
      `${where}: "${name}" is not a valid tool name, providers match ` +
        `${String(TOOL_NAME)}` +
        (declared ? '.' : '. Pass a `name` to @Tool().'),
    );
  }

  return name;
};
