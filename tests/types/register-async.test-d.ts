/**
 * Type-only, never executed: vitest collects `*.spec.ts`. `@ts-expect-error`
 * fails the build if the error it marks ever stops happening, which is what
 * makes this a test of a check the compiler performs.
 */
import { FakeListChatModel } from '@langchain/core/utils/testing';
import {
  LangChainModule,
  LangChainModuleOptions,
  LangChainOptionsFactory,
} from '../../lib/index.js';

const model = new FakeListChatModel({ responses: ['42'] });

// A key the module does not declare, returned as a fresh literal.
void LangChainModule.registerAsync({
  name: 'TYPO',
  // @ts-expect-error `systemPromt` is not an option
  useFactory: () => ({ model, systemPromt: 'x' }),
});

// The same through a variable, which plain excess property checking misses.
const prebuilt = { model, systemPromt: 'x' };

void LangChainModule.registerAsync({
  name: 'VARIABLE',
  // @ts-expect-error `systemPromt` is not an option
  useFactory: () => prebuilt,
});

// @ts-expect-error `systemPromt` is not an option
void LangChainModule.register({ model, systemPromt: 'x' });

// Everything below has to keep compiling.
void LangChainModule.register({ model, systemPrompt: 'p' });
void LangChainModule.registerAsync({
  name: 'OK',
  useFactory: () => ({ model }),
});
void LangChainModule.registerAsync({
  name: 'ASYNC',
  useFactory: () => Promise.resolve({ model, systemPrompt: 'p' }),
});

// An options class, for `useClass` and `useExisting`.
class AgentOptions implements LangChainOptionsFactory {
  createLangChainOptions(): LangChainModuleOptions {
    return { model, systemPrompt: 'p' };
  }
}

void LangChainModule.registerAsync({ name: 'CLASS', useClass: AgentOptions });
void LangChainModule.registerAsync({
  name: 'EXISTING',
  useExisting: AgentOptions,
});

// With its return type declared, the method rejects a key the module does
// not declare.
export class TypoOptions implements LangChainOptionsFactory {
  createLangChainOptions(): LangChainModuleOptions {
    // @ts-expect-error `systemPromt` is not an option
    return { model, systemPromt: 'x' };
  }
}

class CreateOnly {
  create(): LangChainModuleOptions {
    return { model };
  }
}

// @ts-expect-error the method is `createLangChainOptions`, not `create`
void LangChainModule.registerAsync({ name: 'CREATE', useClass: CreateOnly });
