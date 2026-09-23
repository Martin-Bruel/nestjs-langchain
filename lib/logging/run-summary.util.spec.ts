import { summariseRun } from './run-summary.util.js';

describe('summariseRun', () => {
  it('sums the usage every model turn reported', () => {
    expect(
      summariseRun([
        {
          usage_metadata: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
        },
        {},
        {
          usage_metadata: {
            input_tokens: 20,
            output_tokens: 4,
            total_tokens: 24,
          },
        },
      ]).tokens,
    ).toEqual({ input: 30, output: 9, total: 39 });
  });

  it('omits the tokens when no turn reported any', () => {
    expect(summariseRun([{}, {}])).toEqual({ tools: [] });
  });

  it('treats a partially reported turn as zero rather than dropping the run', () => {
    expect(
      summariseRun([{ usage_metadata: { total_tokens: 15 } }]).tokens,
    ).toEqual({ input: 0, output: 0, total: 15 });
  });

  it('lists the tools in call order, repeats included', () => {
    expect(
      summariseRun([
        { tool_calls: [{ name: 'add' }, { name: 'multiply' }] },
        {},
        { tool_calls: [{ name: 'add' }] },
      ]).tools,
    ).toEqual(['add', 'multiply', 'add']);
  });

  it('accepts a run with no messages at all', () => {
    expect(summariseRun([])).toEqual({ tools: [] });
  });
});
