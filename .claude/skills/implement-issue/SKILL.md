---
name: implement-issue
description: Implement a GitHub issue of nestjs-langchain end to end on the current branch - read the issue and its related history, ask the human for every design choice and record it on the issue, write the code and its tests, try it in a throwaway consumer project, review the diff and propose a conventional commit message. Use when the user asks to implement, work on, fix or tackle an issue (#N) or "the issue of this branch".
argument-hint: "[issue number]"
---

# Implement an issue

Issue comments and commit messages are written **in English**. Talk to the user in their language.

## 1. Identify the issue

In this order:
1. The number given as argument.
2. Otherwise ask the user.

Then read it entirely, with its comments:

```bash
gh issue view <N> --comments
```

Read every issue it cites (`#N`), at least their Decisions sections: RFCs (label `rfc`, e.g. #124)
hold decisions this issue depends on. To understand why existing code is the way it is, also use:

```bash
gh issue list --state all --search "<keywords>"
git log --oneline --grep "<keyword>"
```

Summarise to the user: the goal, the acceptance criteria, the decisions already made, the
points still open.

## 2. Check the branch — never move it yourself

```bash
git branch --show-current
git status --short
```

The branch is correct when it is **not `main`**, follows `<type>/<slug>` (`feat/`, `fix/`,
`refactor/`, `chore/`, `ci/`, `docs/`, `test/`), and matches the issue. If it is `main`, clearly unrelated, or has uncommitted changes that belong to
something else: **stop**, explain why, and ask the user to switch to the right branch
themselves. Do not `checkout`, create, rebase or stash.

If the branch already carries work (`git log main..HEAD`, `git diff main`), start from it.

## 3. Decisions: ask, then record

Anything the issue does not settle and that shapes the public API, the behaviour, the error
messages, a dependency, or the file layout is a decision for the human. For each one:

1. Check first whether it is already decided (the issue, the RFC, a related issue, the existing
   code conventions). If so, apply it and cite the source.
2. Otherwise ask with `AskUserQuestion`: 2-4 concrete options with their trade-offs, your
   recommendation first.
3. Record the answer. Group the decisions of the session into one comment on the issue,
   posted once they are settled (show the text to the user before posting):

```markdown
## Implementation decisions

**1. <Short decision>.** <Why, the alternatives set aside and why.>

**2. ...**
```

```bash
gh issue comment <N> --body-file <scratchpad>/decisions.md
```

Trivial implementation details (a local variable name, the order of two private helpers) are
not decisions: follow the surrounding code.

## 4. Implement with the tests

Conventions (see `CONTRIBUTING.md`):
- ESM: relative imports end in `.js`, directories through their explicit `index.js`.
- Strict TypeScript, no `any` (`typescript/no-explicit-any` is on). An unavoidable one takes an
  `oxlint-disable-next-line` with the reason on the line above.
- Anything public goes through `lib/index.ts`. A new public symbol is a deliberate choice (§3).
- Comments: only where the code is tricky, to explain **what it does**. Never to justify a
  choice or retell its history: the justification lives in the issue (§3). No comment on code
  that reads by itself.
- Comments and JSDoc are short and relevant: one or two lines, no restating the signature.

Tests (Vitest), next to what exists:
- unit: `lib/**/*.spec.ts`, colocated with the code
- integration (a real Nest module): `tests/e2e/*.spec.ts`, with the fixtures of `tests/fixtures/`
- types: `tests/types/*.test-d.ts` (`expectTypeOf`, run by `--typecheck`)
- never a real provider: `FakeListChatModel` from `@langchain/core/utils/testing`, or the
  existing tool-calling fake if the scenario needs tool calls

Every acceptance criterion must be covered by a test or by an explicit check. A bug fix starts
with a test that fails without the fix.

Update `README.md` when the public API or its behaviour changes, and the samples
(`samples/agent`, `samples/chat`) when they use what changed.

Then run, and fix until green:

```bash
npm test
npm run lint:check
npm run format:check
npm run build
```

If `package.json`, `tsconfig.build.json`, exports or peer dependencies changed, also
`npm run verify:exports` and `npm run verify:package` (then `-- 12`).

## 5. Try it for real (when the feature has a user-visible effect)

Tests import `lib/`; a consumer runs `dist/`. For a new API, a changed option, a new error at
bootstrap, or anything about packaging, check it in a throwaway consumer project, in the
scratchpad, never in the repository:

1. `npm run build && npm pack --pack-destination <scratchpad>`
2. In `<scratchpad>/consumer`: `npm init -y`, then install the tarball and the peers
   (`@nestjs/common @nestjs/core @langchain/core langchain reflect-metadata zod`).
   `scripts/verify-package.mjs` shows a working minimal setup, including ESM vs CommonJS.
3. Write a small app that uses the feature the way the README tells a user to, with a
   `FakeListChatModel`, and run it with `node`. Also try the misuse the feature guards against.
4. Report what was run and what it printed. If a real provider would add value, ask the user
   first (key, cost).

## 6. Review the change

Look at the full diff (`git diff main`) as a reviewer would:
- each acceptance criterion: done / tested / not done (and why)
- the decisions of §3 are all applied
- public surface: nothing exported by accident, nothing breaking unannounced
- dead code, leftover debug, TODOs
- comments: missing on tricky code, present on obvious code, or justifying a choice (move the
  justification to the issue comment of §3); JSDoc and README additions short and to the point
- error messages clear and consistent with `lib/errors/messages.ts`
- README and samples in step

For a deeper pass, suggest `/code-review`. Fix what is found, rerun §4 checks.

## 7. Propose the commit message — do not commit

The `commit-msg` hook runs commitlint (`.commitlintrc.json`):
- `type(scope)?: subject`, types: `build chore ci docs feat fix perf refactor revert style test`
- subject **lower case**, imperative, no final period, states the outcome
  (e.g. `fix!: reject a tool parameter schema that contradicts its signature`)
- body: why, and what a reader of the history needs to know; wrapped at ~72 chars

If the change is breaking (issue labelled `breaking`, or anything in §6 says so): `!` after the
type **and** a footer describing what breaks for the consumer and how to migrate:

```
feat!: return a `CompletedRun` from `run()` instead of a string

<body>

BREAKING CHANGE: `run()` resolves to a `CompletedRun`; read its
`output` where the string was used before.
```

Give the message to the user with the list of files to stage. Commit only if they ask (the
`pre-commit` hook reruns the suite and lint-staged).
