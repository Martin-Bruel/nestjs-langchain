import { MiddlewareError } from 'langchain';
import { unwrapMiddlewareError } from './unwrap-middleware-error.util.js';

describe('unwrapMiddlewareError', () => {
  const original = new Error('rate limited');

  it('returns the error each middleware wrapped', () => {
    const wrapped = MiddlewareError.wrap(
      MiddlewareError.wrap(original, 'inner'),
      'outer',
    );

    expect(unwrapMiddlewareError(wrapped)).toBe(original);
  });

  it('leaves any other error as it is', () => {
    expect(unwrapMiddlewareError(original)).toBe(original);
    expect(unwrapMiddlewareError('a string')).toBe('a string');
  });

  it('keeps a MiddlewareError that wraps no error', () => {
    const wrapped = MiddlewareError.wrap('not an error', 'structuredOutput');

    expect(unwrapMiddlewareError(wrapped)).toBe(wrapped);
  });
});
