/**
 * Type-only, never executed. The fields of the observer's events.
 */
import { ToolErrorEvent } from '../../lib/index.js';

expectTypeOf<ToolErrorEvent['reason']>().toEqualTypeOf<
  'unknown-tool' | 'invalid-arguments' | 'threw'
>();
