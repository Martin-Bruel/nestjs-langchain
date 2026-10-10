# Models

`model` takes a configuration, which LangChain's `initChatModel` resolves at bootstrap, or a chat
model you built. This page details [Register an agent](../README.md#1-register-an-agent).

## A configuration

```ts
LangChainModule.register({
  model: {
    model: 'openai:gpt-5-mini',
    temperature: 0,
    maxTokens: 1024,
    timeout: 30_000,
    maxRetries: 2,
  },
});
```

| Field | |
|---|---|
| `model` | `provider:name`, such as `openai:gpt-5-mini` |
| `apiKey` | Optional: without it, the provider reads its own environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …), and Bedrock, Vertex AI and Ollama use none |
| `temperature` | The sampling temperature |
| `maxTokens` | The longest answer, in tokens |
| `timeout` | How long one model call may take, in milliseconds |
| `maxRetries` | How many times a failed model call is retried |

The provider's package must be installed: `@langchain/openai` here.
[LangChain's chat integrations](https://docs.langchain.com/oss/javascript/integrations/chat/index)
list the providers and their packages.

These fields go as they are to the provider's class, which ignores one it names differently:
`ChatOllama` reads `numPredict` and `ChatGoogleGenerativeAI` reads `maxOutputTokens`, so
`maxTokens` sets no limit with them. Build the model yourself to set those.

A provider LangChain does not know, a missing provider package, or a `model` that is neither a
configuration nor a chat model fails the bootstrap.

## A model you built

`model` also accepts a chat model instance, used as is, for what the configuration cannot express:
a proxy, an Azure deployment, a provider's own fields.

```ts
import { ChatOpenAI } from '@langchain/openai';

LangChainModule.register({
  model: new ChatOpenAI({
    model: 'gpt-5-mini',
    configuration: { baseURL: 'https://my-proxy.internal/v1' },
  }),
});
```

In tests, a fake model boots the module with no key and no network: see
[Testing](../README.md#testing).
