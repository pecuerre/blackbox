# BlackBox

**A web framework where you write natural language, not code.**

You describe your website in plain-language files: page by page, feature by
feature, decision by decision. Then you run `bb compile`. AI agents read what
changed since the last compile and update a real application (models,
migrations, controllers, views, styles, tests) in the stack you choose. The
code exists, but you never have to look at it.

Here's how adding Google login to an existing site could look (sample output):

```
$ echo "Members can also log in with their Google account." >> spec/frontend/pages/login.md
$ bb status
1 change(s) waiting to be compiled:
  modified  spec/frontend/pages/login.md
$ bb compile

? Decision 0001 says email and password only. Should Google login replace it, or be added next to it?
  1. Add next to email/password
  2. Replace email/password
  (a number, or type your own answer) › 1
  ✎ updating the spec: spec/decisions/0001-no-social-login-yet.md
  ~ code/accounts/views.py
  + code/accounts/migrations/0004_social_accounts.py
  ...
✓ Compiled (snapshot 71e9d28, $0.42)
```

## The four layers

| # | Layer  | Where                  | Written by | Purpose |
|---|--------|------------------------|------------|---------|
| 1 | Human  | `spec/`                | people     | What the product is and does. The single source of truth. |
| 2 | Agents | `.blackbox/agents/`    | agents     | Long-term memory: rules, architecture notes, spec→code map, skills. |
| 3 | Diff   | `.blackbox/diff/`      | `bb`       | What changed in the spec since the last compile: the agents' task. |
| 4 | Code   | `code/`                | agents     | The generated application, with its own git history. |

Behind layer 3 is a private git repository (`.blackbox/history/`) that
snapshots `spec/` at every successful compile. It is independent of any git
repository you use yourself.

See [docs/architecture.md](docs/architecture.md) for how it fits together and
[docs/roadmap.md](docs/roadmap.md) for what's next and the open design questions.

## Repository layout

```
packages/bb/           the `bb` CLI (TypeScript, Claude Agent SDK)
  src/                 cli, project config, snapshots, changeset, agent runner, prompts
  templates/project/   what `bb init` creates
examples/bookclub/     a sample project: a site for reading groups (Django)
docs/                  architecture and roadmap
```

## Getting started

Requirements: Node 20+, git, and Claude credentials (a logged-in Claude Code,
or `ANTHROPIC_API_KEY`).

```bash
cd packages/bb
npm install
npm run build
npm link            # puts `bb` on your PATH

bb init ~/sites/my-site --stack rails
cd ~/sites/my-site
# describe the site in spec/ ...
bb status           # what changed since the last compile
bb diff             # the exact changes
bb compile          # generate / update the code
bb log              # compile history
```

`bb compile --dry-run` builds the changeset and prints the prompt without
calling the agent. `bb compile --yes` runs shell commands (installs,
migrations, tests) without asking first.

To try the example: `cd examples/bookclub && bb compile`.

## Commands

| Command | What it does |
|---------|--------------|
| `bb init [dir] --stack <s>` | Create a project with the 4-layer skeleton. |
| `bb status` | List spec files changed since the last compile. |
| `bb diff` | Show those changes line by line. |
| `bb compile` (`bb build`) | Have the agents implement the changes. |
| `bb log` | List previous compiles. |
