/**
 * Type-only, never executed. `Agent` stays open to subclasses (#155).
 * `@ts-expect-error` fails the build if the error it marks ever stops happening.
 */
import { z, ZodType } from 'zod';
import {
  Agent,
  CompletedRun,
  OUTPUT_TOOL,
  RunOptions,
} from '../../lib/index.js';

class Subclass extends Agent {}

expectTypeOf<Subclass>().toExtend<Agent>();
expectTypeOf<Subclass['run']>().toEqualTypeOf<Agent['run']>();

expectTypeOf<CompletedRun['status']>().toEqualTypeOf<'completed'>();
expectTypeOf<CompletedRun['output']>().toEqualTypeOf<string>();
expectTypeOf<CompletedRun<{ total: number }>['output']>().toEqualTypeOf<{
  total: number;
}>();

declare const agent: Agent;

// A text run.
expectTypeOf(agent.run('question')).resolves.toEqualTypeOf<CompletedRun>();
expectTypeOf(agent.run('question', {})).resolves.toEqualTypeOf<CompletedRun>();

// #151: a structured run is typed from its schema, without annotation.
const Classification = z.object({
  category: z.enum(['billing', 'bug', 'other']),
  priority: z.number(),
});

expectTypeOf(
  agent.run('ticket', { output: Classification }),
).resolves.toEqualTypeOf<
  CompletedRun<{ category: 'billing' | 'bug' | 'other'; priority: number }>
>();

// What the schema parses to, not what the model writes.
const Invoice = z.object({
  dueDate: z.iso.date().transform((date) => new Date(date)),
});

expectTypeOf(agent.run('email', { output: Invoice })).resolves.toEqualTypeOf<
  CompletedRun<{ dueDate: Date }>
>();

// An options object built beforehand.
const options = { output: Classification };

expectTypeOf(agent.run('ticket', options)).resolves.toEqualTypeOf<
  CompletedRun<z.output<typeof Classification>>
>();

// Options checked against `RunOptions` keep the schema's type.
const checked = { output: Classification } satisfies RunOptions;

expectTypeOf(agent.run('ticket', checked)).resolves.toEqualTypeOf<
  CompletedRun<z.output<typeof Classification>>
>();

expectTypeOf<RunOptions['output']>().toEqualTypeOf<ZodType | undefined>();

// #280: options typed `RunOptions`, whose schema is not known statically.
const typed: RunOptions = { output: Classification };

expectTypeOf(agent.run('ticket', typed)).resolves.toEqualTypeOf<
  CompletedRun<unknown>
>();

const ask = (question: string, runOptions?: RunOptions) =>
  agent.run(question, runOptions);

expectTypeOf(ask('ticket')).resolves.toEqualTypeOf<CompletedRun<unknown>>();

// @ts-expect-error `output` takes a Zod schema
void agent.run('ticket', { output: { category: 'string' } });

// #307: the name a test queues; renaming the tool is breaking.
expectTypeOf(OUTPUT_TOOL).toEqualTypeOf<'extract-output'>();

// #194: cancelled and bounded, whatever the output.
expectTypeOf(
  agent.run('question', {
    signal: AbortSignal.timeout(1_000),
    recursionLimit: 10,
  }),
).resolves.toEqualTypeOf<CompletedRun>();
expectTypeOf(
  agent.run('ticket', { output: Classification, recursionLimit: 10 }),
).resolves.toEqualTypeOf<CompletedRun<z.output<typeof Classification>>>();

// @ts-expect-error `recursionLimit` is a number
void agent.run('question', { recursionLimit: '10' });
