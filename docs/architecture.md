# Architecture

## A BlackBox project on disk

```
my-site/
├── blackbox.yaml              # name, target stack, agent settings: the only technical file
├── spec/                      # LAYER 1: HUMAN (plain language, images, mockups, .psd...)
│   ├── README.md              #   product overview
│   ├── domain/                #   concepts and business rules
│   ├── frontend/pages/        #   one file per page
│   ├── frontend/components/   #   things shared across pages
│   ├── backend/               #   emails, jobs, payments, integrations
│   ├── database/              #   data requirements (retention, imports...)
│   ├── design/ (+ assets/)    #   look and feel, design files
│   └── decisions/             #   numbered decisions (constraints for the agents)
├── .blackbox/                 # internal; users don't need to open it
│   ├── agents/                # LAYER 2: AGENTS
│   │   ├── rules.md           #   standing rules, read on every compile
│   │   ├── knowledge/
│   │   │   ├── architecture.md  # how the generated app is built and run
│   │   │   ├── spec-map.md      # spec file → code files (traceability)
│   │   │   └── notes/           # decisions the agents made, gotchas
│   │   └── skills/            #   reusable project procedures
│   ├── diff/                  # LAYER 3: DIFF
│   │   ├── pending/           #   changeset for the compile in progress
│   │   │   ├── changeset.md   #     file list + patch, what the agent reads
│   │   │   └── changeset.patch
│   │   └── archive/<time>_<snapshot>/   # every compiled changeset
│   ├── history/               # private git repo; work tree = spec/
│   └── log/                   # one report per compile + index.md
└── code/                      # LAYER 4: CODE (the generated app, its own git repo)
```

The folder layout inside `spec/` is a convention, not a schema: the agents
follow whatever structure they find.

## Versioning: the hidden git repository

`bb` keeps a private git repository at `.blackbox/history/` whose work tree is
`spec/` (`git --git-dir=.blackbox/history --work-tree=spec`). It never touches
a repository the user might keep at the project root.

- **HEAD** (branch `compiled`) is the spec as of the last *successful* compile.
- **The work tree** is the spec as it is now.
- **HEAD → work tree** is the changeset.

On the first compile there is no HEAD, so the diff is taken against git's
empty tree and every file shows up as added. Binary files (images, .psd)
appear in the file list; the agent opens them directly.

The generated `code/` directory is a normal git repo too, with one commit per
compile that references the spec snapshot. That gives a rollback path and lets
agents read `git log` for context.

## The compile pipeline

```
 bb compile
   │
   ├─ 1. snapshot diff    stage spec/ in the hidden repo, diff against HEAD
   │                      → nothing changed? stop.
   ├─ 2. changeset        write .blackbox/diff/pending/changeset.{md,patch}
   ├─ 3. agent run        Claude Agent SDK, cwd = project root
   │       system prompt  Claude Code preset + BlackBox compiler instructions
   │       reads          rules.md → knowledge/ → changeset → full spec files → code
   │       writes         code/, .blackbox/agents/, spec/ (clarifications only)
   │       asks           AskUserQuestion → shown in the terminal → answer
   │                      written back into the spec by the agent
   ├─ 4. on success       commit spec snapshot (including clarifications)
   │                      commit code/, archive the changeset, write the log
   └─   on failure        nothing is committed: the same changes stay pending
```

Because the snapshot only moves forward on success, an interrupted or failed
compile is simply retried by running `bb compile` again.

### Permissions (packages/bb/src/agent.ts)

| Tool | Policy |
|------|--------|
| Read, Glob, Grep, TodoWrite, WebSearch, WebFetch, Agent | allowed |
| Write / Edit | allowed in `code/`, `.blackbox/agents/`, `spec/`; denied in `.blackbox/history/`, `blackbox.yaml`, and outside the project |
| Bash | confirmed in the terminal, unless `agent.bash: allow` or `--yes` |
| AskUserQuestion | rendered as a numbered terminal prompt; free-text answers allowed |
| anything else | confirmed in the terminal |

The agents run with `settingSources: []`, so the user's personal Claude Code
settings, hooks and CLAUDE.md files don't leak into compiles.

## Source map (packages/bb/src)

| File | Role |
|------|------|
| `cli.ts` | Commands: init, status, diff, compile, log |
| `project.ts` | Finds the project root, loads `blackbox.yaml`, resolves layer paths |
| `snapshots.ts` | `SpecHistory` (hidden git repo) and `CodeHistory` |
| `changeset.ts` | Builds and archives layer 3 |
| `prompts.ts` | Compiler system prompt and per-compile task |
| `agent.ts` | Agent SDK session, permission policy, terminal trace |
| `compiler.ts` | Orchestrates one compile end to end |
| `ui.ts` | Terminal colours, prompts, numbered choices |
