---
name: implement-issue
description: Implement a GitHub issue of nestjs-langchain end to end on the current branch - read the issue and its related history, discuss every design choice with the human and record it on the issue, write the code and its tests, try it in a sample app with a mocked model, review the diff and propose a conventional commit message. Use when the user asks to implement, work on, fix or tackle an issue (#N) or "the issue of this branch".
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
points still open, and what §4's "First, what LangChain already provides" found.

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

## 3. Decisions: discuss, then record

Anything the issue does not settle and that shapes the public API, the behaviour, the error
messages, a dependency or the file layout is a decision for the human. For each one:

1. Check whether it is already decided (the issue, the RFC, a related issue, the existing
   conventions). If so, apply it and cite the source.
2. Otherwise raise it in the conversation, not with `AskUserQuestion`: the concrete options,
   their trade-offs, your recommendation. Debate it with the user until it is settled; their
   counter-arguments and questions are part of the decision.
3. Record it as soon as the discussion has concluded: post the decisions settled so far as one
   comment on the issue, without asking again, since the debate was the approval. Decisions
   settled later in the session go in a follow-up comment. This is where the justification
   lives, so the code does not carry it:

```markdown
## Implementation decisions

**1. <Short decision>.** <Why, the alternatives set aside and why.>

**2. ...**
```

```bash
gh issue comment <N> --body-file <scratchpad>/decisions.md
```

Never cite an issue, PR, discussion or commit of another repository there (`owner/repo#N` or its
URL): GitHub shows a link back to this project on their side, and no later edit or deletion
removes it. Point to the installed code instead (`node_modules/<package>/dist/<file>:<line>`, with
the version).

Trivial details (a local name, the order of two private helpers) are not decisions: follow the
surrounding code.

## 4. Implement with the tests

Follow `CLAUDE.md` (ESM imports, no `any`, public surface, comments).

### First, what LangChain already provides

Before writing any code, library or test, search what `langchain`, `@langchain/core` and
`@langchain/langgraph` already ship for it. Do it now, not at review: once code exists, the
search turns into a justification of it. It covers test code too: a fake, a fixture, a matcher.

1. List the plan: each class, helper, fixture or mechanism you are about to write.
2. List what the installed versions export:
   ```bash
   # every public name of `langchain`
   grep -o '[A-Za-z_]*' node_modules/langchain/dist/index.d.ts | sort -u
   # the entry points of @langchain/core and @langchain/langgraph
   node -e "for (const p of ['@langchain/core','@langchain/langgraph']) console.log(p, Object.keys(require('./node_modules/'+p+'/package.json').exports))"
   ```
3. For each planned item, search those names and the `.d.ts` of the relevant entry points by
   keyword: what it does (`fake`, `mock`, `testing`, `middleware`, `error`, `retry`, `usage`,
   `merge`, `parse`…), not only the name you would have given it. Read the JSDoc of every hit.
4. Report the result, item by item: reused (what, where), or nothing fitting (what was searched).
   A reuse that would put LangChain's types in a public signature, or depend on an internal
   format, is a decision for §3 (#124's "our types, not LangChain's").

Tests (Vitest), next to what exists:
- unit: `lib/**/*.spec.ts`, colocated with the code
- integration (a real Nest module): `tests/e2e/*.spec.ts`, with the fixtures of `tests/fixtures/`
- types: `tests/types/*.test-d.ts` (`expectTypeOf`, run by `--typecheck`)
- models: `fakeModel()` from `@langchain/core/testing`: queued answers (`.respond()`), tool calls
  (`.respondWithTools()`), errors, usage (an `AIMessage` with `usage_metadata`), several runs,
  and what the model received (`.calls`). `FakeListChatModel` still fits a single answer

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

Always a complete review, presented to the user, in two passes.

### Step back: what LangChain already does

The second pass of §4's search, on the code as written: what was added since, and what the
first pass may have missed. Put the change in perspective. The library is a thin Nest
layer over LangChain: every piece we write ourselves is code to maintain, test and explain.
For each new class, helper or mechanism of the diff:
- does `langchain` or `@langchain/core` already provide it, or something close (a callback
  helper such as `BaseCallbackHandler.fromMethods`, a middleware, a tool option, a config
  field, a utility)? Check the installed version in `node_modules`, not memory: read its
  `.d.ts` and, when the behaviour matters, its `dist/` code
- if it does, reuse it, unless that would put LangChain's types in our public signatures or
  depend on an internal format (the "our types, not LangChain's" principle of #124); say why
- does the measured LangChain behaviour still match what the issue assumed? An issue written
  against an older version may claim a gap that has since closed
- could the change be smaller: fewer files, fewer layers, one path instead of two?

Report each finding with the evidence (file and line in `node_modules`), and a concrete
simplification. Discuss them like the decisions of §3; apply what is agreed and record any
that changes a decision in the follow-up comment on the issue.

### Line by line

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
- subject starts lower-case (identifiers keep their case: `fakeModel`, `CommonJS`), imperative,
  no final period, states the outcome
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
