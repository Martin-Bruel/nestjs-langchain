import { UsageMetadata } from '@langchain/core/messages';
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
      summariseRun([
        // Typed complete, but a provider may leave fields out.
        { usage_metadata: { total_tokens: 15 } as UsageMetadata },
      ]).tokens,
    ).toEqual({ input: 0, output: 0, total: 15 });
  });

  it('lists the tools in call order, repeats included', () => {
    expect(
      summariseRun([
        {
          tool_calls: [
            { name: 'add', id: 'c1' },
            { name: 'multiply', id: 'c2' },
          ],
        },
        { tool_call_id: 'c1' },
        { tool_call_id: 'c2' },
        { tool_calls: [{ name: 'add', id: 'c3' }] },
        { tool_call_id: 'c3' },
      ]).tools,
    ).toEqual(['add', 'multiply', 'add']);
  });

  it('leaves out the tool returning a structured output', () => {
    expect(
      summariseRun(
        [
          { tool_calls: [{ name: 'add', id: 'c1' }] },
          { tool_call_id: 'c1' },
          { tool_calls: [{ name: 'extract-output', id: 'c2' }] },
          { tool_call_id: 'c2' },
        ],
        'extract-output',
      ).tools,
    ).toEqual(['add']);
  });

  // #290: one that came with the output, which ended the turn.
  it('leaves out a call with no answer, which never ran', () => {
    expect(
      summariseRun([
        {
          tool_calls: [
            { name: 'add', id: 'c1' },
            { name: 'multiply', id: 'c2' },
          ],
        },
        { tool_call_id: 'c2' },
      ]).tools,
    ).toEqual(['multiply']);
  });

  it('accepts a run with no messages at all', () => {
    expect(summariseRun([])).toEqual({ tools: [] });
  });
});
