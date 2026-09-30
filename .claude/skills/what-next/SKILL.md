---
name: what-next
description: Triage the open issues of nestjs-langchain (what to close, what to revisit), map the dependencies and conflicts between them (must go before, must ship together, contradict each other), recompute the priorities and recommend what to work on now. Use when the user asks what to do next, what to work on, to triage or groom the backlog, or to review priorities.
argument-hint: "[optional focus: milestone, label or theme]"
---

# What next

Read-only until the user approves: closing, relabelling and commenting are public. Talk to the
user in their language; anything posted on GitHub is in English.

## 1. Collect

```bash
gh issue list --state open --limit 200 --json number,title,labels,milestone,body,updatedAt,createdAt,comments
gh api repos/:owner/:repo/milestones --jq '.[]|"\(.number) \(.title) \(.open_issues)"'
gh pr list --state open --json number,title,headRefName,body
gh pr list --state merged --limit 30 --json number,title,mergedAt,body
git branch -a
gh label list --limit 100
```

Also note the current branch and whether it is ahead of `main`: work in progress counts.

For each issue, extract: type, priority (`P0`..`P3`), `breaking`, milestone, the issues it cites
(`#N`), the files or public symbols it touches, the decisions it states, its acceptance criteria.

## 2. Triage first

Check each open issue against the code (`lib/`, `tests/`, `README.md`), the merged PRs and the
other issues. Propose, with a one-line reason each:

**Close**
- done: its acceptance criteria are met by merged work (cite the commit or PR)
- duplicate of another issue (keep the more complete one)
- obsolete: superseded by a later decision (typically an RFC such as #124) or by a refactor
- `wontfix`: contradicts a settled decision

**Revisit**
- missing or wrong labels: no type, no priority, `breaking` missing on an API change,
  `good first issue` on something not well delimited (rules in `/write-issue`)
- no acceptance criteria, or criteria that are no longer verifiable
- stale: context out of date (renamed symbols, moved files), decisions contradicted by a later
  issue, a question left unanswered
- too big: should be split; or too small and scattered: should be grouped
- milestone inconsistent with its priority

## 3. Map the dependencies

Build the graph between open issues (and the current branch):
- **before**: B needs what A introduces (a type, an error class, an API), or A is an RFC whose
  decisions B implements
- **together**: they change the same public API or the same files and would conflict or be
  reworked twice; breaking changes that belong in the same major (the 2.0.0 list, #61) so users
  migrate once
- **conflict**: they state contradictory decisions or expectations; say which one should win
  or ask the user

Make implicit links explicit: an issue that should cite another but does not.

## 4. Recompute the priorities

Order the actionable issues (not blocked, decisions settled) by:
1. `P0` and anything blocking a milestone or a release
2. issues that unblock the most others
3. breaking changes grouped for the next major, before the release that ships them
4. continuity with the current branch and open PRs (finish before starting)
5. quick wins; leave `good first issue` items for contributors unless the user wants them

Propose a new priority, milestone or label only when the evidence says the current one is
wrong.

## 5. Report

In this order, compact:

1. **Triage**: table `# | title | action (close / relabel / edit / split) | reason`
2. **Dependencies**: `A → B` (before), `A + B` (together), `A ⚡ B` (conflict), with a one-line
   reason each. Offer a Mermaid graph if there are more than a handful.
3. **Priorities**: the proposed changes, with the reason
4. **Now**: the 1 to 3 issues to take next, each with why now, what it unblocks, the branch name
   to create (`<type>/<slug>`) and the command `/implement-issue <N>`
5. **Blocked / to decide**: what needs a decision from the user before anyone can start

## 6. Apply what the user approves

Ask which actions to apply (`AskUserQuestion`, multi-select when several). Then, for each:

```bash
gh issue close <N> --reason completed|"not planned" --comment "<why, with the commit/issue>"
gh issue edit <N> --add-label P1 --remove-label P2
gh issue comment <N> --body-file <scratchpad>/comment.md   # link, dependency, conflict
```

A dependency or a grouping goes as a comment on both issues ("Must land before #N: ...").
An issue that needs rewriting: propose the new body and apply it with
`gh issue edit <N> --body-file ...` after approval. A new issue needed (a split, a missing
prerequisite): hand over to `/write-issue`.
