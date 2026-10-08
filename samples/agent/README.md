# Sample: agent

Two named agents with tools, configured with `LangChainModule.registerAsync` from `ConfigService`:

- `MATH` computes with the `calculator` tool of `MathService`, and logs its runs through
  `observer`
- `MONGO` reads a MongoDB collection with the `executeMongoCommand` tool of `MongoService`

`AppService` injects each one with `@InjectAgent()`.

## Run it

The sample uses the library's built output, so build it first, at the root of a fresh clone:

```bash
npm install
npm run build
```

Then configure and start the sample:

```bash
cd samples/agent
cp .env.example .env   # then fill it in
npm run start
```

## Environment

Read from `.env`:

- `OPENAI_API_KEY`: required, since both agents use an `openai:` model
- `MONGO_URI` and `MONGO_DB`: a reachable MongoDB, which the application connects to at startup.
  `docker run -d -p 27017:27017 mongo` gives one at the default `mongodb://localhost:27017`
- `PORT`: optional, `3000` by default

## Try it

```bash
curl -X POST http://localhost:3000/calculator \
  -H 'Content-Type: application/json' \
  -d '{ "input": "What is 12 * 7?" }'

curl -X POST http://localhost:3000/dba \
  -H 'Content-Type: application/json' \
  -d '{ "input": "List the first 5 documents of the users collection." }'
```
