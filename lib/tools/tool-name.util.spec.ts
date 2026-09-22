import { resolveToolName } from './tool-name.util.js';

describe('resolveToolName', () => {
  it('prefers the declared name over the method name', () => {
    expect(resolveToolName('add_numbers', 'addTwoNumbers', 'S.m')).toBe(
      'add_numbers',
    );
  });

  it('falls back to the method name', () => {
    expect(resolveToolName(undefined, 'subtract', 'S.m')).toBe('subtract');
  });

  it('accepts a name at the length limit', () => {
    const name = 'a'.repeat(64);

    expect(resolveToolName(name, 'm', 'S.m')).toBe(name);
  });

  it('rejects a declared name providers would not accept', () => {
    expect(() => resolveToolName('add numbers', 'add', 'S.add')).toThrow(
      /S\.add: "add numbers" is not a valid tool name/,
    );
  });

  it('rejects a declared name past the length limit', () => {
    expect(() => resolveToolName('a'.repeat(65), 'm', 'S.m')).toThrow(
      /is not a valid tool name/,
    );
  });

  it('points at the option when the method name is at fault', () => {
    expect(() => resolveToolName(undefined, '$find', 'S.$find')).toThrow(
      /Pass a `name` to @Tool\(\)/,
    );
  });

  it('does not point at the option when the declared name is at fault', () => {
    expect(() => resolveToolName('a b', 'find', 'S.find')).toThrow(
      /is not a valid tool name, providers match [^.]+\.$/,
    );
  });
});
