---
name: check-release
description: Check that main of nestjs-langchain is ready to be released - review every change since the last pushed tag with /code-review, check the CI, preview the next version and its changelog, then give the release commands to run (release branch, release-it, pull request, publication). Use when the user asks to prepare, check or cut a release, to publish or ship a new version, or whether main is ready to be released.
argument-hint: "[/code-review effort level, default high]"
---

# Check a release

Read-only (see `CLAUDE.md`): this skill switches no branch, commits, pushes and posts nothing. It
ends on a verdict and the commands the user runs. The release process it prepares is the
"Releasing" section of `CONTRIBUTING.md`; its configuration is `.release-it.json`.

## 1. Where things stand

```bash
git fetch origin --tags
git branch --show-current
git status --short
git rev-list --left-right --count origin/main...HEAD
git describe --tags --abbrev=0 origin/main
```

- The development branch is `main`: there is no `develop`. The review compares `HEAD` with the
  tag, so `HEAD` has to be `origin/main`, with a clean tree. On another branch, behind or ahead of
  `origin/main`, or with uncommitted changes, stop and ask the user to switch themselves
  (`git switch main && git pull --ff-only`): the tree may hold work you cannot see the intent of.
- The last pushed tag is the most recent one reachable from `origin/main`, since `release.yml`
  tags the merged release commit. Call it `<tag>`.
- The version and the changelog count from the last **stable** tag instead (`.release-it.json`
  excludes `*.*.*-*`). When `<tag>` is a release candidate, the review covers less than the
  changelog: say so.

Then:

```bash
git log --format='%h %s' <tag>..origin/main
gh run list --workflow CI --branch main --limit 1 --json headSha,status,conclusion,url
gh pr list --state open --base main --json number,title,headRefName
```

- Nothing since `<tag>`: nothing to release, stop there.
- The CI of `origin/main`'s head commit must have passed: `release.yml` only publishes after it,
  and it runs the checks of `CLAUDE.md`, the peer floors, `verify:exports` and `verify:package`.
  Not run yet, running, or failed: the release waits for it.
- Open pull requests on `main`: name the ones that look meant for this release (a fix, a runtime
  dependency) rather than merging them.

## 2. Review the changes

Invoke the `code-review` skill with the effort level (the argument, `high` by default) and the
range `<tag>...HEAD` (`/code-review high v2.0.0...HEAD`): everything the release ships. Pass the
range, not the tag or its commit alone, which is reviewed as that one commit. No `--fix`,
`--comment` or `--post`: the review only reports. `ultra` runs in the cloud and is billed: it is
the user's to launch, so suggest it for a large or risky release instead.

If the review runs in the background, wait for its findings before going on: the verdict depends
on them.

When the review says it ran no verification pass (`high` does not), check each finding before
sorting it (a
`tsc` on a scratch file in `.claude/tmp/`, the installed code in `node_modules`, a run of the
code). A finding an issue already settled is no finding: cite the decision instead.

Sort each finding with its evidence:
- **blocks the release**: a bug in shipped code (`lib/`, what `dist/` and the `exports` hold), a
  change to the public API (`lib/index.ts`, module options, decorator behaviour, a thrown error
  type) without `!` and a `BREAKING CHANGE:` footer, a security issue
- **does not**: tests, samples, tooling, cleanups. Offer a follow-up issue (`/write-issue`)

The review reads code, not prose: when `README.md` or `docs/` changed since `<tag>`, suggest
`/check-docs`, since the published README is the package's page on npm.

## 3. Preview the version and the changelog

`@release-it/conventional-changelog` reads the subjects since the last stable tag, with the
`conventionalcommits` preset:

- **version**: major when a subject carries `!` or a body a `BREAKING CHANGE:` footer, minor when
  one is a `feat`, patch otherwise
- **changelog**: `feat`, `fix`, `perf` and `revert` show; `docs`, `chore`, `refactor`, `test`,
  `build`, `ci` and `style` stay out

```bash
git describe --tags --abbrev=0 --exclude '*-*' origin/main   # <stable-tag>
git log --format='%h %s%n%b' <stable-tag>..origin/main
```

Read every entry that will show, and its pull request or issue when in doubt:
- one that a later commit of the range undoes or supersedes (a revert, a fix whose issue says so)
  leaves the section, by hand, once release-it has written it. So does a fix of something no
  release ever shipped: for users, the feature is new
- a breaking one carries its migration in its footer; the section is what users read to upgrade

## 4. Report

In this order, compact:

1. **Verdict**, in one line: ready / ready once the listed fixes land / not ready (and why)
2. **Since `<tag>`**: the number of commits, the CI of `origin/main`, the pull requests waiting
3. **Review**: the blocking findings first, each with `file:line` and the reason; then the
   others, each with a proposed follow-up
4. **Changelog**: the next version and why, the entries that will show, the ones to remove or
   reword by hand, citing the issue
5. **Commands**, ready to copy, with `<version>` filled in. When something blocks, list what must
   land first, then the same commands.

```bash
git switch main && git pull --ff-only
git switch -c release/v<version>

# The version and the changelog release-it computes, without changing anything
npm run release -- --dry-run

# Bumps the version, writes CHANGELOG.md, sets the samples' range, commits
# `chore(release): v<version>` and pushes the branch; tags and publishes nothing
npm run release
```

`npm run release` asks before each step: answer in the terminal. For a release candidate,
`npm run release:rc`, which leaves the changelog alone.

Read the new section of `CHANGELOG.md`: its heading carries the date (the 2.0.0 one said
`(unreleased)` and was dated by hand), and step 3's entries are gone. After editing it:

```bash
git add CHANGELOG.md
git commit --amend --no-edit
git push --force-with-lease origin release/v<version>
```

Then the pull request, its title the release commit's subject, its body the version's section:

```bash
gh pr create --base main --title "chore(release): v<version>" \
  --body-file <(node scripts/release-notes.mjs <version>)
```

Once its checks pass, squash-merge it. After the CI on the merged commit, `release.yml` publishes
to npm (`latest`, or `next` for a release candidate), then tags the commit and creates the GitHub
Release from the changelog. To follow it, then check:

```bash
gh run list --workflow Release --limit 1
npm view nestjs-langchain@<version> version
```

A failed `release.yml` is re-run as it is: it skips what is already done.
