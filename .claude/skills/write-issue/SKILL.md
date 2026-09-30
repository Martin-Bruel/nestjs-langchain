---
name: write-issue
description: Draft and open a GitHub issue for nestjs-langchain with the project's format and the right labels (type, priority, breaking, good first issue). Use when the user wants to create, write, open or file an issue, report a bug, or turn an idea/discussion into a tracked task.
argument-hint: "[short description of the problem or idea]"
---

# Write an issue

Goal: an issue that someone (a human or Claude via `/implement-issue`) can implement without
re-asking what was meant. Issues, titles and comments are written **in English**, like the rest
of the repository.

## 1. Understand before writing

1. Restate the need in one sentence. If the scope is ambiguous (what is in, what is out, what
   problem it solves), ask the user with `AskUserQuestion` before drafting.
2. Look for duplicates and related work:
   ```bash
   gh issue list --state all --search "<keywords>" --limit 20
   ```
   If an issue already covers it, stop and propose to comment on it instead.
   Note the related issues (RFCs, parents, blockers) to cite them as `#N`.
3. Read the code concerned (`lib/`, `tests/`, `README.md`) so that the context quotes the real
   names, files and behaviour, not guesses.

## 2. Pick the labels

Always read the current labels, they may have changed:

```bash
gh label list --limit 100
```

At the time of writing, the rules are:

| Axis | Labels | Rule |
|---|---|---|
| Type (exactly one, two when both are true) | `bug`, `feature`, `technical`, `test`, `documentation`, `CI/CD`, `rfc` | `technical` = tooling, build, typing, refactor. `rfc` = a design discussion to settle *before* any implementation |
| Priority (exactly one) | `P0` blocks everything else · `P1` core maturity · `P2` advanced features · `P3` promotion | Propose one, the user confirms |
| `breaking` | when the change alters the public API (anything exported from `lib/index.ts`, module options, decorator behaviour, a thrown error type, a peer dependency floor) | |
| `good first issue` | see below | |
| `help wanted`, `question` | only if the user asks | |

**`good first issue`** only when *all* of these hold:
- the scope is well delimited: the files to touch are known and few
- no open design decision remains (nothing that would need an `rfc` or a question to the maintainer)
- not `breaking`, not `P0` on the critical path
- the acceptance criteria are verifiable by a newcomer (a test to add, a command that must pass)

When in doubt, do not add it.

## 3. Draft with the project's format

Title: a plain sentence, no conventional-commit prefix, code in backticks, stating the problem
or the outcome. Examples from the repo:
- `` `z.int()` on a `number` parameter is rejected as contradicting the signature ``
- `` Add an `isGlobal` option so one agent can serve several feature modules ``

Body (omit the sections that bring nothing):

```markdown
## Context

What exists today (real code excerpts if useful), why it is a problem, links to related issues.

## Decisions

Only if choices were already made (in an RFC, with the user). Numbered, each with its reason.
Cite the source: "Decided in #124 (point 3)".

## Sketch

Optional: the target API or a code shape. Mark what is still open.

## Acceptance criteria

- [ ] Observable, verifiable items (behaviour, test, doc, README, migration note)
- [ ] For `breaking`: "Listed in the next major's breaking changes"
```

For a `bug`: in Context, give the reproduction (minimal code), the expected and actual
behaviour, and the version.

Style: short sentences, concrete, no filler. State the *why* of every decision.

## 4. Validate, then create

1. Show the user the title, labels and body. Adjust until they approve. **Never create the
   issue without explicit approval**: it is public.
2. Create it from a file to keep the Markdown intact:
   ```bash
   gh issue create --title "<title>" --label "feature,P2" --body-file <scratchpad>/issue.md
   ```
3. Give back the issue URL. If it relates to others, offer to add a comment linking it on them.
