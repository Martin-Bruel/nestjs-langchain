/**
 * Type-only, never executed: vitest collects `*.spec.ts`. `@ts-expect-error`
 * fails the build if the error it marks ever stops happening.
 *
 * This file is ESM, so it sees the same declarations as this package. The
 * CommonJS side, where #169 happened, is checked by `npm run verify:package`.
 */
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { ChatOpenAI } from '@langchain/openai';
import { ModelOption } from '../../lib/index.js';

declare const base: BaseChatModel;

expectTypeOf(new FakeListChatModel({ responses: [] })).toExtend<ModelOption>();
expectTypeOf(new ChatOpenAI({ model: 'gpt-5-mini' })).toExtend<ModelOption>();
// Typed as the base class, whose `bindTools` is optional.
expectTypeOf(base).toExtend<ModelOption>();
expectTypeOf({ model: 'openai:gpt-5-mini' }).toExtend<ModelOption>();

// @ts-expect-error a `Runnable`-like object is not a chat model
export const runnable: ModelOption = { invoke: () => Promise.resolve('x') };

// @ts-expect-error the provider name goes in a configuration object
export const bare: ModelOption = 'openai:gpt-5-mini';
