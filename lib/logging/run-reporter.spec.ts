import { Recorder, reporter, settle } from '../../tests/fixtures/logging.js';

describe('RunReporter', () => {
  it('prefixes the error lines of a named agent', () => {
    const logger = new Recorder();

    reporter(logger, undefined, 'MATH ').logError('add failed: boom');

    expect(logger.last()).toBe('MATH add failed: boom');
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
