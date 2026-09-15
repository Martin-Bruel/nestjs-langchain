# Contributing to nestjs-langchain

First off, thank you for considering contributing to nestjs-langchain! It's people like you who make the open-source community such a great place to learn, inspire, and create.

To maintain the quality of the project and make the process as smooth as possible, please take a moment to review these guidelines.

# Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Running the Samples](#running-the-samples)
- [Pull Request Process](#pull-request-process)
- [Linting and Formatting](#linting-and-formatting)
- [Peer Dependencies](#peer-dependencies)
- [Coding Standards](#coding-standards)

## How Can I Contribute?

### Reporting Bugs

- Check the [Issues](https://github.com/Martin-Bruel/nestjs-langchain/issues) to see if the bug has already been reported.
- If not, open a new issue. Include a clear title, a description of the problem, steps to reproduce, and the expected vs. actual behavior.

### Suggesting Enhancements

- Open an issue with the tag enhancement.
- Explain why this feature would be useful and how it should work.

### Pull Requests

- Open an issue first to discuss the implementation approach.
- Follow the development setup.

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:

```
git clone https://github.com/your-username/nestjs-langchain.git
```

3. Create a new git branch:

```
git checkout -b <type>/my-branch main
```

4. Install dependencies:

```
npm install
```

5. Implement your change.
6. Run the checks:

```bash
npm test           # vitest, the whole suite
npm run lint       # oxlint, applies what it can fix
npm run format     # prettier, rewrites in place
npm run build      # tsc, catches what the linter does not
```

If you touch `package.json`, `tsconfig.build.json` or anything about how the package is
published, also run:

```bash
npm run verify:exports        # publint, then attw
npm run verify:package        # against NestJS 11, the default
npm run verify:package -- 12  # against NestJS 12
```

`verify:exports` checks the manifest and resolves the published types through node10, node16
from CommonJS, node16 from ESM and bundler. It ignores one attw rule, `cjs-resolves-to-esm`,
which is the deliberate consequence of publishing ESM only: a `require` lands on an ESM file,
which Node handles from 22.12 and the `engines` floor guarantees. The rule is ignored rather
than the whole CommonJS profile, so that resolution stays checked for everything else.

`verify:package` covers what those two cannot. It packs the library, installs the tarball into
a throwaway CommonJS consumer and a throwaway ESM one, and boots each through `run()`. That
proves the peer range resolves without `--force`, and that the published build runs at all:
the suite imports the sources, so nothing else ever executes what npm ships.

CI runs both across each NestJS major.

Use `npm run test:watch` while you work.

Tests live in `tests/` and run against the TypeScript sources in `lib/`, so there is no build
step to run first. Specs colocated in `lib/` are picked up too, so a unit test can sit next to
the code it covers.

The `pre-commit` hook runs the suite, then oxlint and Prettier on the staged files. A failing
test or a lint error that cannot be auto-fixed blocks the commit.

## Running the Samples

The samples are npm workspaces, and so is the repository root. A single `npm install` anywhere
in the repository installs everything and symlinks `node_modules/nestjs-langchain` to the root,
so a sample runs against your working tree:

```bash
npm install
npm run build              # samples consume dist/, not lib/
cd samples/chat
npm run start
```

Rebuild after changing `lib/`, since the samples resolve the built output.

The same samples install the published package when they are copied out of the repository,
because they declare a registry range rather than a `file:` path. npm only links the local
package when its version satisfies that range, so bumping the library past what the samples
declare silently sends them back to the registry. Keep the two in step at release time.

`samples/agent` needs a MongoDB and a provider key: copy `.env.example` to `.env`.

CI installs with `--workspaces=false --include-workspace-root`, so the sample toolchains stay
out of the jobs that verify the library.

## Pull Request Process

1. Ensure your code follows the existing style and all tests pass.
2. Update the documentation (README.md) if you are changing the API or adding features.
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (e.g., feat: add support for local LLMs).
4. Push to your fork and submit a Pull Request to the main branch.
5. A maintainer will review your PR and may suggest changes before merging.

## Linting and Formatting

| Command | Does |
|---|---|
| `npm run lint` | oxlint, type-aware, applies fixes |
| `npm run lint:check` | the same without fixing, what CI runs |
| `npm run format` | Prettier, rewrites in place |
| `npm run format:check` | the same without writing, what CI runs |

All four cover `lib/`, `tests/`, `scripts/` and `vitest.config.ts`. The `pre-commit` hook runs the two
fixing commands on staged files, so a clean commit means a green pipeline.

Rules live in `.oxlintrc.json`: oxlint's `correctness` category, then the rules that category
does not carry, then the ones deliberately switched off. Only `typescript/no-explicit-any` is
off, because the `any` still in `lib/` are tracked by their own issues.

When you add a rule, **check that it actually fires**: oxlint ignores an unknown rule name
silently, with no warning and exit 0, so a typo disables the rule instead of failing.

`samples/` is not covered here. Each sample is a standalone project with its own config and
its own dependencies.

## Peer Dependencies

Change `peerDependencies` for one of two reasons only: to clear a published advisory, or to
add support for a new major of a peer. Never to follow the latest release. The floor is the
oldest version a consumer is allowed to run, not the version we happen to test against.

When you move a floor:

- raise it to the lowest version that clears the problem, not the newest available
- set the matching `devDependencies` to the same value, so CI runs what the contract claims
- say so in the PR description, since it is breaking for anyone pinned below and belongs in
  the release notes

## Coding Standards

- TypeScript: use strict typing. Avoid `any` unless there is no alternative.
- NestJS: follow the standard module/provider pattern.
- Testing: new features come with tests. The runner is Vitest.
- The package is ESM: relative imports carry a `.js` extension, and directories are imported
  through their explicit `index.js`.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
