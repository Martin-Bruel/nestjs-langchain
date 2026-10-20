import {
  MultipleStructuredOutputsError,
  ProviderStrategy,
  StructuredOutputParsingError,
  ToolStrategy,
} from 'langchain';
import { z } from 'zod';
import { AgentRunError, StructuredOutputError } from '../errors/index.js';
import { RunOutput } from './run-output.js';

const Classification = z.object({ category: z.enum(['billing', 'bug']) });
const native = { profile: { structuredOutput: true } };

describe('RunOutput', () => {
  describe('strategyFor', () => {
    it('answers through a tool when the model declares no native support', () => {
      const output = new RunOutput(Classification, 'default');

      const strategy = output.strategyFor({});

      expect(strategy).toEqual([expect.any(ToolStrategy)]);
      expect(output.toolName).toMatch(/^extract-\d+$/);
    });

    it('asks natively when the model profile says it can', () => {
      const output = new RunOutput(Classification, 'default');

      expect(output.strategyFor(native)).toBeInstanceOf(ProviderStrategy);
      expect(output.toolName).toBeUndefined();
    });

    it('keeps the strategy of the first call for the whole run', () => {
      const output = new RunOutput(Classification, 'default');

      expect(output.strategyFor({})).toBe(output.strategyFor({}));
    });
  });

  describe('failure', () => {
    const output = new RunOutput(Classification, 'SUPPORT');

    it.each([
      [
        'a parsing failure',
        new StructuredOutputParsingError('extract-1', ['no']),
      ],
      ['several outputs', new MultipleStructuredOutputsError(['a', 'b'])],
    ])('turns %s into a StructuredOutputError', (_label, error) => {
      expect(output.failure(error)).toEqual(
        expect.objectContaining({
          name: 'StructuredOutputError',
          agent: 'SUPPORT',
          cause: error,
        }),
      );
    });

    it('leaves any other error as it is', () => {
      const rateLimited = new Error('rate limited');

      expect(output.failure(rateLimited)).toBe(rateLimited);
    });
  });

  describe('read', () => {
    it('returns what the schema parses', () => {
      const output = new RunOutput(
        z.object({ amount: z.number().transform((euros) => euros * 100) }),
        'default',
      );

      expect(output.read({ amount: 12 })).toEqual({ amount: 1200 });
    });

    it('raises a StructuredOutputError when the run left no answer', () => {
      expect(() =>
        new RunOutput(Classification, 'default').read(undefined),
      ).toThrow(StructuredOutputError);
    });

    it('raises a StructuredOutputError with the Zod error as cause', () => {
      const read = () =>
        new RunOutput(Classification, 'default').read({ category: 'other' });

      expect(read).toThrow(StructuredOutputError);
      expect(read).toThrow(
        expect.objectContaining({ cause: expect.any(z.ZodError) }),
      );
    });
  });

  it('rejects a schema with no JSON Schema form, as a plain AgentRunError', () => {
    const create = () =>
      new RunOutput(z.object({ at: z.coerce.date() }), 'default');

    expect(create).toThrow(AgentRunError);
    expect(create).not.toThrow(StructuredOutputError);
  });
});
