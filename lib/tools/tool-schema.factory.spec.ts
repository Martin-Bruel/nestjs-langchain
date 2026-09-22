import z from 'zod';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import { buildToolSchema } from './tool-schema.factory.js';

// The metadata `@ToolParam` writes and the types `emitDecoratorMetadata`
// emits, built directly. No decorators, no container.
const jsonSchema = (params: ToolParamMetadata[], paramTypes: unknown[]) =>
  z.toJSONSchema(buildToolSchema(params, paramTypes, 'Service.method')) as {
    properties: Record<string, any>;
    required?: string[];
  };

describe('buildToolSchema', () => {
  describe('type inference', () => {
    it('maps string, number and boolean to their zod primitive', () => {
      const schema = jsonSchema(
        [
          { name: 'text', description: 'A string.', index: 0 },
          { name: 'count', description: 'A number.', index: 1 },
          { name: 'flag', description: 'A boolean.', index: 2 },
        ],
        [String, Number, Boolean],
      );

      expect(schema.properties).toEqual({
        text: { type: 'string', description: 'A string.' },
        count: { type: 'number', description: 'A number.' },
        flag: { type: 'boolean', description: 'A boolean.' },
      });
    });

    it('marks every inferred parameter required', () => {
      const schema = jsonSchema(
        [
          { name: 'a', index: 0 },
          { name: 'b', index: 1 },
        ],
        [Number, Number],
      );

      expect(schema.required).toEqual(['a', 'b']);
    });

    it('rejects a type it cannot infer, naming the location', () => {
      expect(() =>
        jsonSchema([{ name: 'payload', index: 0 }], [Object]),
      ).toThrow(/Service\.method.*"payload".*Object/s);
    });

    it('names the type as unknown when nothing was emitted', () => {
      expect(() => jsonSchema([{ name: 'payload', index: 0 }], [])).toThrow(
        /"payload" declared as unknown/,
      );
    });
  });

  describe('descriptions', () => {
    it('omits the description when none is given', () => {
      const schema = jsonSchema([{ name: 'width', index: 0 }], [Number]);

      expect(schema.properties.width).toEqual({ type: 'number' });
    });
  });

  describe('optional parameters', () => {
    it('keeps an optional parameter out of `required`', () => {
      const schema = jsonSchema(
        [
          { name: 'limit', description: 'A limit.', optional: true, index: 0 },
          { name: 'query', index: 1 },
        ],
        [Number, String],
      );

      expect(schema.required).toEqual(['query']);
      expect(Object.keys(schema.properties)).toEqual(['limit', 'query']);
    });

    it('keeps the description of an optional parameter', () => {
      const schema = jsonSchema(
        [{ name: 'limit', description: 'A limit.', optional: true, index: 0 }],
        [Number],
      );

      expect(schema.properties.limit).toMatchObject({
        description: 'A limit.',
      });
    });
  });

  describe('declared schemas', () => {
    it('uses the declared schema for an object parameter', () => {
      const schema = jsonSchema(
        [
          {
            name: 'filter',
            description: 'The filter.',
            schema: z.object({ field: z.string(), value: z.string() }),
            index: 0,
          },
        ],
        [Object],
      );

      expect(schema.properties.filter).toMatchObject({
        type: 'object',
        description: 'The filter.',
        properties: { field: { type: 'string' }, value: { type: 'string' } },
      });
    });

    it('narrows a string parameter to the declared enum', () => {
      const schema = jsonSchema(
        [{ name: 'op', schema: z.enum(['+', '-']), index: 0 }],
        [String],
      );

      expect(schema.properties.op).toMatchObject({ enum: ['+', '-'] });
    });

    it('accepts a union that carries the signature type', () => {
      const schema = jsonSchema(
        [{ name: 'x', schema: z.union([z.string(), z.number()]), index: 0 }],
        [String],
      );

      expect(schema.properties.x).toMatchObject({
        type: ['string', 'number'],
      });
    });

    it('rejects a schema that contradicts a primitive signature', () => {
      expect(() =>
        jsonSchema([{ name: 'n', schema: z.string(), index: 0 }], [Number]),
      ).toThrow(/Service\.method.*"n" describes string.*declares number/s);
    });

    it('leaves a non-primitive signature to the schema alone', () => {
      const schema = jsonSchema(
        [{ name: 'when', schema: z.string(), index: 0 }],
        [Date],
      );

      expect(schema.properties.when).toEqual({ type: 'string' });
    });
  });
});
