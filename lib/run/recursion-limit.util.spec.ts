import { isRecursionLimit } from './recursion-limit.util.js';

describe('isRecursionLimit', () => {
  it.each([undefined, 1, 25])('accepts %s', (limit) => {
    expect(isRecursionLimit(limit)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Infinity, '10', null])(
    'rejects %s',
    (limit) => {
      expect(isRecursionLimit(limit)).toBe(false);
    },
  );
});
