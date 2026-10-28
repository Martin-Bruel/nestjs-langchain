import { UsageMetadata } from '@langchain/core/messages';

// Our own key in `configurable`, like the run's output. See #296.
const USAGE_ASIDE_KEY = 'nestjs-langchain:usage-aside';

/**
 * The usage of the model's replies a run leaves out of its messages, which its
 * `tokens` still count: those the `unknownTools` re-ask asks again about. One
 * per run, handed to the middlewares in `configurable`. See #296.
 *
 * @internal
 */
export class UsageAside {
  readonly usage: UsageMetadata[] = [];

  /** The `configurable` entry that hands it to the middlewares. */
  get config(): Record<string, UsageAside> {
    return { [USAGE_ASIDE_KEY]: this };
  }

  /**
   * @param usage A left-out reply's usage, when the provider reported it.
   */
  add(usage: UsageMetadata | undefined): void {
    if (usage) {
      this.usage.push(usage);
    }
  }

  /**
   * @param configurable A middleware's `runtime.configurable`.
   * @returns The run's aside, when it set one.
   */
  static of(
    configurable: Record<string, unknown> | undefined,
  ): UsageAside | undefined {
    const aside = configurable?.[USAGE_ASIDE_KEY];

    return aside instanceof UsageAside ? aside : undefined;
  }
}
