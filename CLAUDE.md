# BlackBox

This repo is the BlackBox framework: the `bb` CLI in `packages/bb` (TypeScript, ESM,
Claude Agent SDK) plus example projects in `examples/`. See docs/architecture.md.

- Build: `cd packages/bb && npm run build`. Typecheck: `npm run typecheck`. Run from source: `npm run dev -- <command>`.
- `packages/bb/templates/project/` is copied by `bb init`; keep `examples/bookclub/` consistent with it.
- The compiler's behaviour lives mostly in the system prompt (`src/prompts.ts`); the permission policy lives in `src/agent.ts`.
- Test compiles in a scratch directory, not in `examples/` (compile state there is gitignored, but generated code is noise).
