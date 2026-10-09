---
name: review-project
description: Run a complete review of nestjs-langchain - code, library design, public API and semver, runtime behaviour, performance, observability, security and supply chain, packaging, tests, tooling, CI/CD, repository hygiene, documentation, roadmap coherence, the NestJS ecosystem and the limits of LangChain itself - then report every finding with its evidence and propose the issues to open. Use when the user asks for a full, complete or global review or audit of the project, or a health check before a release.
argument-hint: "[optional focus: a domain, or a release to review for]"
---

# Review the project

nestjs-langchain is a NestJS library to build LangChain agents, designed around modules and
decorators. Project rules (language, comments, approvals) are in `CLAUDE.md`.

## Method

- **Read-only** until the user has validated the report: no issue, comment, label or pull request
  (`CLAUDE.md`).
- **Measure, do not assume**: reproduce a finding with a test, a run in a sample
  (`.claude/skills/implement-issue/references/try-in-sample.md`), a command and its output, or
  the installed code in `node_modules` (file, line, version). A finding without evidence is a
  question.
- **Check the reasoning before calling a choice wrong**: search the issues, their RFCs and their
  "Implementation decisions" comments (`gh issue list --state all --search "<keywords>"`). When a
  question stays open, compare with NestJS itself and its official modules (`@nestjs/config`,
  `@nestjs/cache-manager`, `@nestjs/event-emitter`…), then with other NestJS or LangChain
  libraries.
- **Use the other skills**: `/what-next` for the issues, `/check-docs` for the docs,
  `/code-review` for the code, `/write-issue` for every issue to propose.

## Collect

```bash
git log --oneline $(git describe --tags --abbrev=0)..origin/main   # since the last release
npm test && npm run lint:check && npm run format:check && npm run build
npm run test:cov
npm run verify:exports && npm run verify:package && npm run verify:package -- 12
npm pack --dry-run
npm audit
gh api "repos/:owner/:repo/dependabot/alerts?state=open&per_page=100"
gh api "repos/:owner/:repo/code-scanning/alerts?state=open&per_page=100"
gh run list --limit 20
gh pr list --state open
```

## Domains

1. **Code**: readability, strict typing and every `any`, dead code, duplication, error handling,
   comments as `CLAUDE.md` wants them.
2. **Library design**: a thin layer over LangChain. List what the library writes itself that
   `langchain` or `@langchain/core` already ships, and how it grows without breaking (unions that
   may gain members, options).
3. **Public API and semver**: the surface of `lib/index.ts`, consistent names, complete JSDoc
   (`@param`, `@returns`, `@example`), error classes and messages
   (`lib/errors/messages.ts`), the breaking changes since the last release and their migration
   notes.
4. **Runtime behaviour**: Nest lifecycle, several agents, scopes, concurrent runs, cancellation,
   timeouts, retries, error propagation; a misconfiguration fails at bootstrap rather than on the
   first call.
5. **Performance**: bootstrap cost (tool discovery), per-run overhead, work done for nothing.
6. **Observability**: log noise and levels, observer events, callbacks, LangSmith, personal data
   in logs and observer payloads.
7. **Security and supply chain**: the prompt-injection surface of tools, validation by schemas,
   secrets, `npm audit` split between what a user installs and what only the repository does
   (install the packed tarball with its peers in a fresh consumer and audit it there), CodeQL and
   Dependabot alerts, workflow permissions, actions pinned by commit, npm provenance.
8. **Packaging and compatibility**: the `exports` map, ESM and CommonJS consumers, peer ranges
   and their floors, `engines`, the package's content and size, source and declaration maps,
   type resolution.
9. **Tests**: coverage and thresholds, behaviour over implementation, `fakeModel()` rather than a
   provider, e2e and type tests, tests against `dist/`, flaky tests.
10. **Tooling**: npm scripts, the lint rules actually firing, formatting, hooks, the npm major,
    TypeScript configuration.
11. **CI/CD**: duration, the Node and NestJS matrix, required checks, pull request titles, the
    release path (tag, changelog, publish), Dependabot's configuration.
12. **Repository**: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, LICENSE, issue and pull
    request templates, labels, milestones, the `main` ruleset, the commit convention.
13. **Documentation**: `/check-docs` on the README and `docs/`, every example compiles and runs,
    the samples start from a fresh clone, the changelog.
14. **Features and roadmap**: features against their issues and RFCs, duplicates, priorities,
    what blocks the next release (`/what-next`).
15. **Ecosystem**: NestJS conventions (`register`/`registerAsync`, `isGlobal`, injection tokens),
    and how equivalent libraries solve the same problems.
16. **Upstream limits**: what LangChain or NestJS lacks that the library works around, measured on
    their latest release. For each, say whether a ticket upstream is worth opening, and whether
    LangChain's Python side behaves the same (parity is what upstream accepts). Never cite an
    upstream issue, PR or commit (`owner/repo#N` or its URL) in this repository's issues or
    comments: GitHub adds a link back to this project on their side, and no edit removes it.
17. **Licences**: the licences of the dependencies against MIT.
18. **Contributor experience**: time to a first green `npm test`, `good first issue` items, the
    clarity of the setup.

## Report

In the user's language, by domain, blockers of the next release first. For each finding:

- **severity**: blocks the release / important / minor
- **evidence**: file and line, or the command and its output
- **fix**: the change proposed
- **issue**: the existing one (`#N`), or a new one to open

End with the issues to create, grouped when they touch the same files, ordered by priority.

## Apply what the user validates

Each new issue goes through `/write-issue` and is shown before it is created. Comments, labels and
closings follow `/what-next` §6.
