---
name: check-docs
description: Audit the nestjs-langchain documentation against the library - compile and run every example of the README and the docs/ pages against lib/, find mistakes (syntax, spelling, names or behaviour that no longer match the code) and flag text that justifies at length or retells history instead of explaining usage. Use when the user asks to check, verify, proofread or review the docs/README, or after an API change.
argument-hint: "[file or section, default README.md and docs/]"
---

# Check the docs

The docs tell a user how to use the library: short, correct, runnable (rules in `CLAUDE.md`).

Scope, unless the user narrows it: `README.md` and the pages of `docs/`, then the JSDoc of every
symbol exported from `lib/index.ts`, which is what users see in their editor. `CONTRIBUTING.md`
and `SECURITY.md` only on request.

## 1. Run the examples

1. Extract the blocks:
   ```bash
   node .claude/skills/check-docs/scripts/extract-snippets.mjs .claude/tmp/docs
   ```
   It reads `README.md` and every page of `docs/`, or the `.md` files passed to narrow it. One
   file per ` ```ts ` block (`NN-<file>-<section>.ts`, headed by its file and line), a `tsconfig.json`
   and a `vitest.config.ts` both resolving `nestjs-langchain` to `lib/index.ts`, and
   `manifest.json` listing every block, including the `bash` ones.
2. Most blocks are fragments. Add only the glue they assume (imports, a stub provider, an
   enclosing class, the module of the previous block), marked `// glue`. Blocks of one section
   that build on each other can be merged into one file. Glue a reader could not guess (an
   import never shown, a name never declared) is a finding.
3. Typecheck: `npx tsc -p .claude/tmp/docs`, until the only errors left are real doc errors.
4. Blocks forming an app (registration + usage): run them in a `*.spec.ts` next to the snippets
   (`npx vitest run --config .claude/tmp/docs/vitest.config.ts`), with `FakeListChatModel` in
   place of the provider. Call what the example calls and compare with what the text around it
   claims: returned value, thrown error, logged output.
5. `bash` blocks (from the manifest): every `npm run <script>` exists in `package.json`, every
   installed package is in `dependencies` or `peerDependencies` with a compatible range.

## 2. Check alignment with the library

Compare each section with `lib/`:
- names: classes, decorators, options, methods, error classes, tokens (e.g. a leftover
  `LangChainService` after the rename to `Agent`)
- options: every documented option exists with that type and default; every public option of
  `lib/interfaces/` is documented somewhere
- behaviour: what the text says happens (validation at bootstrap, error message, return type)
  is what the code does; quote the `lib/` line that contradicts it
- versions: Node, NestJS and peer ranges match `package.json`
- links and anchors resolve, including the README's links to `docs/` and the pages' links back
- JSDoc matches the signature and says what the symbol does, with a `@param` per parameter,
  `@returns`, and an `@example` on public functions, decorators, classes and methods

## 3. Check the writing

- spelling and syntax (English), broken Markdown (unclosed fence, table, list numbering)
- concision: each paragraph says how to use something. Flag history ("previously..."), design
  debates and internals a user does not need, and any justification longer than it needs to be:
  shortened to its essence, with its `see #N`.
- consistency: one term per concept, code style of `lib/` in the examples

## 4. Report, then fix

Report in the user's language, by severity:

1. **Broken**: an example that does not compile, does not run, or does not do what it claims
2. **Wrong**: text contradicting the library (with the `lib/` reference)
3. **Writing**: typos, syntax, justification to cut, verbosity

Each finding: location (`README.md:L`, `docs/tools.md:L`), the problem, the fix. Give the count of blocks
typechecked / run / skipped (and why).

Apply the fixes the user agrees to, then rerun §1 on what changed. When the library is wrong
rather than the doc, do not change it here: propose an issue with `/write-issue`.
Delete `.claude/tmp/docs/` at the end.
