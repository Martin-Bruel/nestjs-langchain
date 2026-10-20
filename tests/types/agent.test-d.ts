/**
 * Type-only, never executed. `Agent` stays open to subclasses (#155).
 * `@ts-expect-error` fails the build if the error it marks ever stops happening.
 */
import { z } from 'zod';
import { Agent, CompletedRun, RunOptions } from '../../lib/index.js';

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

expectTypeOf<RunOptions['output']>().toEqualTypeOf<undefined>();

// @ts-expect-error `output` takes a Zod schema
void agent.run('ticket', { output: { category: 'string' } });
