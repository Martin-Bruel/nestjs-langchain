/**
 * Type-only, never executed. `Agent` stays open to subclasses (#155).
 */
import { Agent, CompletedRun } from '../../lib/index.js';

class Subclass extends Agent {}

expectTypeOf<Subclass>().toExtend<Agent>();
expectTypeOf<Subclass['run']>().toEqualTypeOf<Agent['run']>();

expectTypeOf<Agent['run']>().returns.resolves.toEqualTypeOf<CompletedRun>();
expectTypeOf<CompletedRun['status']>().toEqualTypeOf<'completed'>();
expectTypeOf<CompletedRun['output']>().toEqualTypeOf<string>();
expectTypeOf<CompletedRun<{ total: number }>['output']>().toEqualTypeOf<{
  total: number;
}>();
