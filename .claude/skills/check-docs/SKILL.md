---
name: check-docs
description: Audit the nestjs-langchain documentation against the library - compile and run every README example against lib/, find mistakes (syntax, spelling, names or behaviour that no longer match the code) and flag text that justifies instead of explaining usage. Use when the user asks to check, verify, proofread or review the docs/README, or after an API change.
argument-hint: "[file or section, default README.md]"
---

# Check the docs

The docs tell a user **how to use the library**: short, correct, runnable. The reasons behind a
design live in the issues, not in the docs.

Scope, unless the user narrows it: `README.md`, then the JSDoc of every symbol exported from
`lib/index.ts` (it is what users see in their editor). `CONTRIBUTING.md` and `SECURITY.md` only
on request.

## 1. Run the examples

Every ` ```ts ` block of the README must compile and, when it forms an app, boot.

1. Build a project in the scratchpad (never in the repository), with a `tsconfig.json` copied
   from the root one plus `"paths": { "nestjs-langchain": ["<repo>/lib/index.ts"] }` and
   `"noEmit": true`, so the examples resolve to the **sources in `lib/`**. Dependencies come from
   the repository's `node_modules` (`"baseUrl"`/`typeRoots` pointing at it, or a symlink).
2. One file per block, named after its section (`quick-start-1.ts`, ...). A block is often a
   fragment: add only the glue it assumes (imports, a stub provider, an enclosing class) and
   mark the glue with `// glue`. If a block needs glue a reader could not guess (a missing
   import, an undeclared name), that is a finding.
3. Blocks from the same section that build on each other go in the same file, in order.
4. Typecheck: `npx tsc -p <scratchpad>/docs/tsconfig.json`.
5. For blocks that form an app (module registration + usage), boot it with `tsx` or through a
   Vitest spec in the scratchpad: replace the real provider by `FakeListChatModel` from
   `@langchain/core/utils/testing`, call what the example calls, and compare with what the
   text around it claims (returned value, thrown error, logged output).
6. ` ```bash ` blocks: check that every `npm run <script>` exists in `package.json`, and every
   installed package in the right `dependencies`/`peerDependencies`.

## 2. Check alignment with the library

For each section, compare the text with `lib/`:
- names: classes, decorators, options, methods, error classes, tokens (e.g. no leftover
  `LangChainService` after its rename to `Agent`)
- options: every documented option exists with that type and default; every public option of
  `lib/interfaces/` is documented somewhere
- behaviour: what the text says happens (validation at bootstrap, error message, return type)
  is what the code does; quote the file and line that contradicts it
- versions: Node, NestJS and peer ranges match `package.json`
- links and anchors resolve (table of contents, `#section` links, links to files)
- JSDoc: matches the signature, says what the symbol does, nothing about why it was designed so

## 3. Check the writing

- syntax and spelling (English), broken Markdown (unclosed fence, table, list numbering)
- concision: each paragraph tells how to use something. Flag and propose to cut:
  justifications, history ("previously..."), design debates, internal details a user does not
  need. If a justification is worth keeping, it belongs in an issue: say which one.
- consistency: same term for the same thing everywhere, same code style as `lib/` (ESM imports,
  no `any`)

## 4. Report, then fix

Report in the user's language, grouped by severity:

1. **Broken**: an example that does not compile, does not boot, or does not do what it claims
2. **Wrong**: text contradicting the library (with the `lib/` reference)
3. **Writing**: typos, syntax, justification to cut, verbosity

Each finding: location (`README.md:L`), the problem, the proposed fix. Give the count of
blocks compiled / booted / skipped (and why skipped).

Apply the fixes once the user agrees. A fix that means changing the library rather than the
doc is not applied: propose an issue with `/write-issue` instead. Rerun §1 on what changed.
