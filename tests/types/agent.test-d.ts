/**
 * Type-only, never executed. `Agent` stays open to subclasses (#155).
 */
import { Agent } from '../../lib/index.js';

class Subclass extends Agent {}

expectTypeOf<Subclass>().toExtend<Agent>();
expectTypeOf<Subclass['run']>().toEqualTypeOf<Agent['run']>();
