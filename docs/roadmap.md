# Roadmap and open questions

## Known limitations of the prototype

- **Shell commands aren't sandboxed.** Write/Edit are restricted by path, but an
  approved `Bash` command can touch anything the user can. The prompt tells
  agents to change files only with Write/Edit, and `bash: ask` (the default)
  shows each command first. Next step: enable the Agent SDK `sandbox` option,
  or run compiles in a container.
- **One agent does everything.** Fine for small changes. Large projects will
  want specialised agents: a planner, then domain, database, backend,
  frontend, and design implementers, then a reviewer and a tester.
- **No way to run the app.** There is no `bb run` / `bb preview` yet.
- **Questions are terminal-only.** No batching of questions, and no way to
  answer later, asynchronously.

## Next steps

1. `bb run`: start the generated app locally (the agent records how in
   `knowledge/architecture.md`).
2. `bb undo`: roll the spec snapshot and `code/` back one compile.
3. Multi-agent compile: a planner reads the changeset and spec-map and splits
   the work by layer, then specialists implement and a reviewer checks the
   result against the spec.
4. `bb check`: lint the spec for contradictions, ambiguity, and gaps before
   compiling (no code changes).
5. Verification loop: after implementing, run the app and drive it in a browser
   to check each changed spec statement.
6. `bb ask "<question>"`: answer questions about the current product from the
   spec and code ("what happens when a member deletes their account?").
7. Partial compiles: `bb compile spec/frontend/pages/login.md`.
8. Cost controls: per-compile budget (`maxBudgetUsd`) and a cheaper model for
   small changes.

## Open design questions

- **Spec structure.** Keep `domain/ frontend/ backend/ database/ design/
  decisions/` as a recommended convention, or enforce a schema? Should spec
  files have optional front matter (ids, status, owner)?
- **Clarifications.** Write answers straight into the spec (current behaviour),
  or into a separate `spec/clarifications/` area that the user can review and merge?
- **Spec ↔ code drift.** If someone edits `code/` by hand, should `bb` detect it
  and refuse, absorb it into the spec, or overwrite it?
- **Stack changes.** Changing `stack` after the first compile means a full
  rebuild. Support that explicitly (`bb compile --full`)?
- **Team workflows.** Several people editing `spec/` on git branches: does the
  hidden history follow branches, or does each branch compile independently?
- **Where the code lives.** Should `code/` be inside the project at all, or in
  a separate repository that deploys on its own?
- **Agent knowledge visibility.** Should `.blackbox/agents/` be readable by
  users (as a "what the machine thinks" view), or stay fully hidden?
