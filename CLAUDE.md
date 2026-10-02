# nestjs-langchain

NestJS library to build LangChain agents. Sources in `lib/`, tests in `tests/` and `lib/**/*.spec.ts`,
samples in `samples/`. `CONTRIBUTING.md` is the reference for setup, commands and standards.

## Language

- GitHub (issues, comments, PRs), commits, code, comments and docs: English.
- Conversation: the user's language.

## Code

- ESM: relative imports end in `.js`, directories through their explicit `index.js`.
- Strict TypeScript, no `any`. An unavoidable one takes an `oxlint-disable-next-line` with the
  reason on the line above.
- The public surface is `lib/index.ts`: adding an export is a decision, removing one is breaking.
- Tests with Vitest; never a real model provider: `fakeModel()` from `@langchain/core/testing`
  (or `FakeListChatModel` for a single answer).
- Before writing a mechanism, library or test, look for the one LangChain ships
  (`/implement-issue`, §4).

## Comments and docs

- A comment explains **what** tricky code does. Code that reads by itself gets none.
- Never justify a choice or retell its history in code or docs ("previously", "we chose X
  because"): the reasoning lives in the issue. Link it (`see #N`) if a reader needs it.
- Comments, JSDoc and README stay short and relevant: how it works, how to use it.

## GitHub and git

- Anything public (issue, comment, label, close, PR) is shown to the user and posted only after
  their approval.
- Never switch, create, rebase or stash branches for the user: ask them.
- Commits follow `.commitlintrc.json` (subject starts lower-case, identifiers keep their case).
  Breaking: `!` and a `BREAKING CHANGE:` footer.
- Labels: one type (`bug`, `feature`, `technical`, `test`, `documentation`, `CI/CD`, `rfc`), one
  priority (`P0` blocks everything, `P1` core maturity, `P2` advanced features, `P3` promotion),
  `breaking` on public API changes. Details in `/write-issue`.

## Checks

```bash
npm test && npm run lint:check && npm run format:check && npm run build
```

Packaging changes (`package.json`, exports, peers): also `npm run verify:exports` and
`npm run verify:package` (then `-- 12`).

## Scratch work

Throwaway code goes in git-ignored places, never elsewhere in the repository:
- `samples/<sample>/src/scratch/`: a real consumer run against `dist/` (see `/implement-issue`)
- `.claude/tmp/`: generated doc snippets (see `/check-docs`)
