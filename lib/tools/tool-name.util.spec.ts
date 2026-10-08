import { findDuplicateToolNames, resolveToolName } from './tool-name.util.js';

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

  // #213: the agent routes these calls to structured output, never to the tool.
  it('rejects the prefix LangChain reserves for structured output', () => {
    expect(() =>
      resolveToolName('extract-total', 'total', 'InvoiceService.total'),
    ).toThrow(
      'InvoiceService.total: "extract-total" starts with "extract-", a ' +
        'prefix LangChain reserves for structured output, so the agent would ' +
        'never run it. Give it another `name` in @Tool().',
    );
  });

  it.each(['extractTotal', 'extract_total', 'Extract-total'])(
    'accepts %s, which the agent runs as a tool',
    (name) => {
      expect(resolveToolName(name, 'm', 'S.m')).toBe(name);
    },
  );
});

describe('findDuplicateToolNames', () => {
  it('names both methods behind a shared name', () => {
    expect(
      findDuplicateToolNames([
        { name: 'add', where: 'A.add' },
        { name: 'sub', where: 'A.sub' },
        { name: 'add', where: 'B.add' },
      ]),
    ).toEqual([
      'Two tools are named "add": A.add and B.add. ' +
        'Give one of them a `name` in @Tool().',
    ]);
  });

  it('finds nothing among distinct names', () => {
    expect(
      findDuplicateToolNames([
        { name: 'add', where: 'A.add' },
        { name: 'sub', where: 'A.sub' },
      ]),
    ).toEqual([]);
  });
});
