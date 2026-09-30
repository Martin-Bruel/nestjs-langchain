---
name: implement-issue
description: Implement a GitHub issue of nestjs-langchain end to end on the current branch - read the issue and its related history, ask the human for every design choice and record it on the issue, write the code and its tests, try it in a sample app with a mocked model, review the diff and propose a conventional commit message. Use when the user asks to implement, work on, fix or tackle an issue (#N) or "the issue of this branch".
argument-hint: "[issue number]"
---

# Implement an issue

Project rules (language, code style, comments, approvals, checks) are in `CLAUDE.md`.

## 1. Identify the issue

1. The number given as argument.
2. Otherwise ask the user.

Read it entirely, with its comments:

```bash
gh issue view <N> --comments
```

Read every issue it cites (`#N`), at least their Decisions sections: RFCs (label `rfc`, e.g. #124)
hold decisions this issue depends on. To understand why existing code is the way it is:

```bash
gh issue list --state all --search "<keywords>"
git log --oneline --grep "<keyword>"
```

Summarise to the user: the goal, the acceptance criteria, the decisions already made, the
points still open.

## 2. Check the branch

```bash
git branch --show-current
git status --short
```

The branch is right when it is not `main`, follows `<type>/<slug>` (`feat/`, `fix/`,
`refactor/`, `chore/`, `ci/`, `docs/`, `test/`) and matches the issue. If it is `main`, clearly
unrelated, or carries uncommitted changes that belong to something else, stop and ask the user
to switch themselves: they may have work in progress you cannot see the intent of.

If the branch already carries work (`git log main..HEAD`, `git diff main`), start from it.

## 3. Decisions: ask, then record

Anything the issue does not settle and that shapes the public API, the behaviour, the error
messages, a dependency or the file layout is a decision for the human. For each one:

1. Check whether it is already decided (the issue, the RFC, a related issue, the existing
   conventions). If so, apply it and cite the source.
2. Otherwise ask with `AskUserQuestion`: 2-4 concrete options with their trade-offs, your
   recommendation first.
3. Record it. Group the decisions of the session into one comment on the issue, once settled
   and approved. This is where the justification lives, so the code does not carry it:

```markdown
## Implementation decisions

**1. <Short decision>.** <Why, the alternatives set aside and why.>

**2. ...**
```

```bash
gh issue comment <N> --body-file <scratchpad>/decisions.md
```

Trivial details (a local name, the order of two private helpers) are not decisions: follow the
surrounding code.

## 4. Implement with the tests

Follow `CLAUDE.md` (ESM imports, no `any`, public surface, comments). Tests (Vitest), next to
what exists:
- unit: `lib/**/*.spec.ts`, colocated with the code
- integration (a real Nest module): `tests/e2e/*.spec.ts`, with the fixtures of `tests/fixtures/`
- types: `tests/types/*.test-d.ts` (`expectTypeOf`, run by `--typecheck`)
- models: `FakeListChatModel`, or the existing tool-calling fake when tools must be called

Every acceptance criterion is covered by a test or an explicit check. A bug fix starts with a
test that fails without the fix.

Update `README.md` when the public API or its behaviour changes (short, usage only), and the
samples when they use what changed. Then run the checks of `CLAUDE.md` until green.

## 5. Try it in a sample

Tests import `lib/`; users run `dist/` from their own app. When the change is visible to a user
(a new API, an option, an error at bootstrap, typing of the options), run it in a sample with a
mocked model: follow [references/try-in-sample.md](references/try-in-sample.md).

For changes to packaging (exports, peers, `package.json`), `npm run verify:package` is the
check: it installs the packed tarball in CommonJS and ESM consumers.

## 6. Review the change

Read the full diff (`git diff main`) as a reviewer would:
- each acceptance criterion: done / tested / not done (and why)
- the decisions of §3 are all applied
- public surface: nothing exported by accident, nothing breaking unannounced
- dead code, leftover debug, TODOs, nothing left in `src/scratch/`
- comments: missing on tricky code, present on obvious code, or justifying a choice (move it to
  the §3 comment); JSDoc and README short and to the point
- error messages clear and consistent with `lib/errors/messages.ts`
- README and samples in step

For a deeper pass, suggest `/code-review`. Fix what is found, rerun the checks.

## 7. Propose the commit message

The `commit-msg` hook runs commitlint (`.commitlintrc.json`):
- `type(scope)?: subject`, types: `build chore ci docs feat fix perf refactor revert style test`
- subject lower case, imperative, no final period, states the outcome
  (e.g. `fix!: reject a tool parameter schema that contradicts its signature`)
- body: what a reader of the history needs to know; wrapped at ~72 chars

If the change is breaking (issue labelled `breaking`, or §6 says so): `!` after the type and a
footer saying what breaks for the consumer and how to migrate:

```
feat!: return a `CompletedRun` from `run()` instead of a string

<body>

BREAKING CHANGE: `run()` resolves to a `CompletedRun`; read its
`output` where the string was used before.
```

Give the message as ready-to-run commands, so the user can copy and execute them from the
repository root. Stage explicit paths, never `git add -A` or `.`: list every changed file,
including new ones and the old path of a rename. Pass the message through a heredoc so
backticks and line breaks survive the shell. Add the co-author trailer when the session's
attribution rules call for one:

```bash
git add <file> <file> ...

git commit -F - <<'EOF'
<type>!: <subject>

<body>

BREAKING CHANGE: <what breaks and how to migrate>

<co-author trailer, if any>
EOF
```

Commit only when the user asks: they review the history themselves, and the `pre-commit` hook
reruns the suite.
