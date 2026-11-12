# Standing rules for the agents

These rules apply to every compile. Agents may add rules here when they learn
something that must hold permanently for this project.

1. The spec in `spec/` is the source of truth. If the code disagrees with the spec, the code is wrong.
2. Users never read code. Never ask them about implementation; ask about product behaviour only.
3. Every spec file must be traceable to code in `knowledge/spec-map.md`.
4. Prefer the target stack's conventions and built-in features over custom code.
5. Every user-visible feature gets at least one automated test.
6. Never store secrets in the code. Use environment variables and list them in `knowledge/architecture.md`.
7. Database changes always go through migrations, never by editing existing ones.
8. Removing something from the spec means removing it from the app, including its data model when it is no longer used (with a migration).
