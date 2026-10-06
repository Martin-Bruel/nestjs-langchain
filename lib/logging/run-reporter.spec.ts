import { Recorder, reporter, settle } from '../../tests/fixtures/logging.js';

describe('RunReporter', () => {
  it('prefixes the error lines of a named agent', () => {
    const logger = new Recorder();

    reporter(logger, undefined, 'MATH ').logError('add failed: boom');

    expect(logger.last()).toBe('MATH add failed: boom');
  });

  it('writes a multi-line message on one line', () => {
    const logger = new Recorder();

    reporter(logger).logError(
      'add failed: did not match\n\n✖ expected number\n  → at a',
    );

    expect(logger.last()).toBe(
      'add failed: did not match ✖ expected number → at a',
    );
  });

  // #188: quadratic on a run of whitespace that holds no newline.
  it('writes a long run of whitespace in linear time', () => {
    const logger = new Recorder();
    const startedAt = performance.now();

    reporter(logger).logError(`add failed: ${' '.repeat(200_000)}`);

    expect(performance.now() - startedAt).toBeLessThan(1000);
    expect(logger.last()).toBe('add failed:');
  });

  it('does nothing without an observer', () => {
    const logger = new Recorder();

    expect(() =>
      reporter(logger).notify(() => {
        throw new Error('never called');
      }),
    ).not.toThrow();
    expect(logger.lines).toEqual([]);
  });

  it('reports an observer that throws, and does not reach the caller', () => {
    const logger = new Recorder();

    expect(() =>
      reporter(logger, {}).notify(() => {
        throw new Error('metrics down');
      }),
    ).not.toThrow();
    expect(logger.last()).toBe('the observer failed: metrics down');
  });

  it('reports an observer that rejects rather than throws', async () => {
    const logger = new Recorder();

    reporter(logger, {}).notify(() => Promise.reject(new Error('db down')));
    await settle();

    expect(logger.last()).toBe('the observer failed: db down');
  });

  it('does not wait for a slow observer', () => {
    let finished = false;

    reporter(new Recorder(), {}).notify(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            finished = true;
            resolve();
          }, 50),
        ),
    );

    expect(finished).toBe(false);
  });
});
