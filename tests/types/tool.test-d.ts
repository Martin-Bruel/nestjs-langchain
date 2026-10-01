/**
 * Type-only, never executed: vitest collects `*.spec.ts`. `@ts-expect-error`
 * fails the build if the error it marks ever stops happening.
 */
import { Tool } from '../../lib/index.js';

// #135: discovery only reads `@Tool` on methods.
// @ts-expect-error `@Tool` decorates a method, not a class
@Tool({ description: 'Never discovered.' })
export class ToolOnAClass {}

export class ToolOnAMethod {
  @Tool({ description: 'Discovered.' })
  run(): string {
    return 'ok';
  }
}
