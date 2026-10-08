# Sample: chat

An agent without tools, registered with `LangChainModule.register`. `POST /` asks it for a poem on a
topic, written in classical alexandrines as its system prompt requires (`src/app.module.ts`).

## Run it

The sample uses the library's built output, so build it first, at the root of a fresh clone:

```bash
npm install
npm run build
```

Then start the sample:

```bash
cd samples/chat
export OPENAI_API_KEY=<your key>
npm run start
```

## Environment

- `OPENAI_API_KEY`: read by the OpenAI provider, since the model is `openai:gpt-5.5`
- `PORT`: optional, `3000` by default

## Try it

```bash
curl -X POST http://localhost:3000 \
  -H 'Content-Type: application/json' \
  -d '{ "topic": "the sea" }'
```
