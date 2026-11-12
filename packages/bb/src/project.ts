import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export const CONFIG_FILE = "blackbox.yaml";

/** Shape of blackbox.yaml — the only "technical" file a user ever touches. */
export interface BlackboxConfig {
  name: string;
  /** Target stack, free-form: "django", "rails", "laravel", "nextjs", ... */
  stack: string;
  /** Extra stack constraints in plain language (versions, hosting, DB engine...). */
  stackNotes?: string;
  agent: {
    model: string;
    /** "ask" = confirm each shell command, "allow" = run without asking. */
    bash: "ask" | "allow";
    /** Reasoning effort: low | medium | high | xhigh | max. */
    effort: "low" | "medium" | "high" | "xhigh" | "max";
    maxTurns?: number;
  };
  paths: {
    spec: string; // layer 1: human
    code: string; // layer 4: generated code
  };
}

const DEFAULTS: BlackboxConfig = {
  name: "untitled",
  stack: "django",
  agent: { model: "claude-opus-5-5", bash: "ask", effort: "high" },
  paths: { spec: "spec", code: "code" },
};

/** Resolved absolute paths of every layer in a BlackBox project. */
export interface Project {
  root: string;
  config: BlackboxConfig;
  /** Layer 1 — natural-language spec written by humans. */
  specDir: string;
  /** Internal state, hidden from the user. */
  internalDir: string;
  /** Layer 2 — agent knowledge: rules, notes, spec↔code map. */
  agentsDir: string;
  /** Layer 3 — changesets between the last compiled spec and now. */
  diffDir: string;
  /** Hidden git repository holding snapshots of the spec layer. */
  historyDir: string;
  /** Layer 4 — generated application code. */
  codeDir: string;
  logDir: string;
}

export function findProjectRoot(start = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadProject(start = process.cwd()): Project {
  const root = findProjectRoot(start);
  if (!root) {
    throw new Error(`Not inside a BlackBox project (no ${CONFIG_FILE} found). Run \`bb init\` first.`);
  }
  const raw = (parseYaml(readFileSync(join(root, CONFIG_FILE), "utf8")) ?? {}) as Partial<BlackboxConfig>;
  const config: BlackboxConfig = {
    ...DEFAULTS,
    ...raw,
    agent: { ...DEFAULTS.agent, ...raw.agent },
    paths: { ...DEFAULTS.paths, ...raw.paths },
  };
  const internalDir = join(root, ".blackbox");
  return {
    root,
    config,
    specDir: join(root, config.paths.spec),
    internalDir,
    agentsDir: join(internalDir, "agents"),
    diffDir: join(internalDir, "diff"),
    historyDir: join(internalDir, "history"),
    codeDir: join(root, config.paths.code),
    logDir: join(internalDir, "log"),
  };
}
