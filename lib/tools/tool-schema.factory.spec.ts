import { toJsonSchema } from '@langchain/core/utils/json_schema';
import z from 'zod';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import { buildToolSchema } from './tool-schema.factory.js';

// The metadata `@ToolParam` writes and the types `emitDecoratorMetadata`
// emits, built directly. No decorators, no container. Converted as LangChain
// converts a tool's schema for the provider.
const jsonSchema = (params: ToolParamMetadata[], paramTypes: unknown[]) =>
  toJsonSchema(buildToolSchema(params, paramTypes, 'Service.method')) as {
    properties: Record<string, unknown>;
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

  // #269: strict mode wants every property required.
  describe('optional parameters', () => {
    const limit = {
      name: 'limit',
      description: 'A limit.',
      optional: true,
      index: 0,
    };

    it('sends an optional parameter required and nullable, null by default', () => {
      const schema = jsonSchema(
        [limit, { name: 'query', index: 1 }],
        [Number, String],
      );

      expect(schema.required).toEqual(['limit', 'query']);
      expect(schema.properties.limit).toEqual({
        type: ['number', 'null'],
        default: null,
        description: 'A limit.',
      });
    });

    it.each([
      ['sent as null', { limit: null }],
      ['left out', {}],
    ])('gives undefined for an optional parameter %s', (_label, args) => {
      expect(
        buildToolSchema([limit], [Number], 'Service.method').parse(args),
      ).toEqual({ limit: undefined });
    });

    it('keeps an optional parameter whose schema accepts null as declared', () => {
      const params = [{ ...limit, schema: z.number().nullable() }];
      const schema = buildToolSchema(params, [Number], 'Service.method');

      expect(jsonSchema(params, [Number]).required).toBeUndefined();
      expect(schema.parse({ limit: null })).toEqual({ limit: null });
      expect(schema.parse({})).toEqual({});
    });

    it('keeps optional a schema whose transform throws on null', () => {
      const params = [
        {
          ...limit,
          schema: z
            .string()
            .nullable()
            // Forgets `null`, which it then receives.
            .transform((value) => (value as string).length),
        },
      ];

      expect(jsonSchema(params, [Number]).required).toBeUndefined();
    });

    it('leaves a nullable parameter without `optional` required', () => {
      const params = [
        { name: 'limit', schema: z.number().nullable(), index: 0 },
      ];

      expect(jsonSchema(params, [Number]).required).toEqual(['limit']);
      expect(
        buildToolSchema(params, [Number], 'Service.method').parse({
          limit: null,
        }),
      ).toEqual({ limit: null });
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
      const schema = buildToolSchema(
        [{ name: 'x', schema: z.union([z.string(), z.number()]), index: 0 }],
        [String],
        'Service.method',
      );

      expect(schema.safeParse({ x: 'a' }).success).toBe(true);
      expect(schema.safeParse({ x: 1 }).success).toBe(true);
    });

    // #137: zod writes a union as `type` or as `anyOf`, depending on its version.
    it('rejects a union that contradicts a primitive signature', () => {
      expect(() =>
        jsonSchema(
          [{ name: 'x', schema: z.union([z.string(), z.boolean()]), index: 0 }],
          [Number],
        ),
      ).toThrow(/"x" describes string \| boolean.*declares number/s);
    });

    it('rejects a schema that contradicts a primitive signature', () => {
      expect(() =>
        jsonSchema([{ name: 'n', schema: z.string(), index: 0 }], [Number]),
      ).toThrow(/Service\.method.*"n" describes string.*declares number/s);
    });

    // #125: JSON Schema's `integer` is a subset of `number`.
    it.each([
      ['z.int()', z.int()],
      ['z.number().int()', z.number().int()],
      ['a constrained integer', z.int().min(1)],
    ])('accepts %s on a number signature', (_label, schema) => {
      expect(
        jsonSchema([{ name: 'size', schema, index: 0 }], [Number]).properties
          .size,
      ).toMatchObject({ type: 'integer' });
    });

    it('accepts a union carrying an integer on a number signature', () => {
      const schema = jsonSchema(
        [{ name: 'id', schema: z.union([z.int(), z.string()]), index: 0 }],
        [Number],
      );

      expect(schema.properties.id).toMatchObject({
        anyOf: [{ type: 'integer' }, { type: 'string' }],
      });
    });

    it('still rejects an integer on a string signature', () => {
      expect(() =>
        jsonSchema([{ name: 'id', schema: z.int(), index: 0 }], [String]),
      ).toThrow(/"id" describes integer.*declares string/s);
    });

    it('leaves a non-primitive signature to the schema alone', () => {
      const schema = jsonSchema(
        [{ name: 'when', schema: z.string(), index: 0 }],
        [Date],
      );

      expect(schema.properties.when).toEqual({ type: 'string' });
    });
  });

  // #190: the bootstrap passed, then no provider could receive the tool.
  describe('JSON Schema form', () => {
    it.each([
      ['z.date()', z.date(), Date, 'Date'],
      ['z.bigint()', z.bigint(), BigInt, 'BigInt'],
      ['a nested z.date()', z.object({ at: z.date() }), Object, 'Date'],
    ])(
      'rejects %s, naming the method and the parameter',
      (_label, schema, paramType, type) => {
        expect(() =>
          jsonSchema([{ name: 'when', schema, index: 0 }], [paramType]),
        ).toThrow(
          `Service.method: "when" has no JSON Schema form (${type} cannot be ` +
            'represented in JSON Schema). Declare a schema JSON Schema can ' +
            'express and convert it with .transform(), such as ' +
            'z.iso.datetime() for a date.',
        );
      },
    );

    it('accepts a transform, whose output the method receives', () => {
      const schema = buildToolSchema(
        [
          {
            name: 'when',
            schema: z.iso.datetime().transform((value) => new Date(value)),
            index: 0,
          },
        ],
        [Date],
        'Service.method',
      );

      expect(schema.parse({ when: '2026-10-07T10:00:00Z' }).when).toEqual(
        new Date('2026-10-07T10:00:00Z'),
      );
    });
  });

  // #126: the second used to overwrite the first, silently.
  describe('parameter names', () => {
    it('rejects two parameters sharing a name, counting from 1', () => {
      expect(() =>
        jsonSchema(
          [
            { name: 'a', index: 0 },
            { name: 'a', index: 1 },
          ],
          [String, Number],
        ),
      ).toThrow(
        'Service.method: parameters 1 and 2 are both named "a". ' +
          'Give each @ToolParam its own name.',
      );
    });

    it('names the clashing positions, not the first ones', () => {
      expect(() =>
        jsonSchema(
          [
            { name: 'a', index: 0 },
            { name: 'b', index: 1 },
            { name: 'b', index: 2 },
          ],
          [String, String, String],
        ),
      ).toThrow('parameters 2 and 3 are both named "b"');
    });
  });
});
