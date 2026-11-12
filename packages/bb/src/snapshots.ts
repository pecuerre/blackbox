import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import type { Project } from "./project.js";

const run = promisify(execFile);

/**
 * The spec layer is versioned by a private git repository living in
 * `.blackbox/history`, with `spec/` as its work tree. It never touches the
 * user's own git (if they use one), and the user never has to know it exists.
 *
 * - HEAD           = the spec as it was at the last successful compile
 * - work tree      = the spec as it is now
 * - HEAD..worktree = the changeset the agents must implement
 */
export class SpecHistory {
  constructor(private readonly project: Project) {}

  private async git(args: string[], opts: { allowFail?: boolean } = {}): Promise<string> {
    try {
      const { stdout } = await run(
        "git",
        [`--git-dir=${this.project.historyDir}`, `--work-tree=${this.project.specDir}`, ...args],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      return stdout;
    } catch (err) {
      if (opts.allowFail) return "";
      throw err;
    }
  }

  get initialized(): boolean {
    return existsSync(this.project.historyDir);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.git(["init", "--quiet", "--initial-branch=compiled"]);
    // Neutral identity: snapshots are made by the tool, not by a person.
    await this.git(["config", "user.name", "blackbox"]);
    await this.git(["config", "user.email", "bb@localhost"]);
    await this.git(["config", "core.quotepath", "false"]);
  }

  async hasBaseline(): Promise<boolean> {
    const out = await this.git(["rev-parse", "--verify", "--quiet", "HEAD"], { allowFail: true });
    return out.trim().length > 0;
  }

  /** Stage the whole current spec so it can be diffed against HEAD. */
  private async stageAll(): Promise<void> {
    await this.git(["add", "--all", "."]);
  }

  /** Files changed since the last compile, as `[status, path]` (A/M/D/R...). */
  async changedFiles(): Promise<Array<{ status: string; path: string }>> {
    await this.stageAll();
    const out = await this.git(["diff", "--cached", "--name-status", "--find-renames", await this.base()]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [status, ...paths] = line.split("\t");
        return { status: status!, path: paths.join(" -> ") };
      });
  }

  /** Unified diff of the spec since the last compile (text files only). */
  async patch(): Promise<string> {
    await this.stageAll();
    return this.git(["diff", "--cached", "--find-renames", "--unified=8", await this.base()]);
  }

  /** What to diff against: last compile, or the empty tree on the first compile. */
  private async base(): Promise<string> {
    return (await this.hasBaseline()) ? "HEAD" : EMPTY_TREE;
  }

  /** Record the current spec as "compiled". */
  async commit(message: string): Promise<string> {
    await this.stageAll();
    await this.git(["commit", "--quiet", "--allow-empty", "-m", message]);
    return (await this.git(["rev-parse", "--short", "HEAD"])).trim();
  }

  async log(limit = 20): Promise<string> {
    if (!(await this.hasBaseline())) return "";
    return this.git(["log", `-${limit}`, "--date=format:%Y-%m-%d %H:%M", "--pretty=format:%h  %ad  %s"]);
  }
}

/** The well-known hash of git's empty tree; diffing against it lists every file as added. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** The generated code gets its own ordinary git repo so every compile is reversible. */
export class CodeHistory {
  constructor(private readonly project: Project) {}

  private async git(args: string[]): Promise<string> {
    const { stdout } = await run("git", ["-C", this.project.codeDir, ...args], { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  }

  async init(): Promise<void> {
    if (existsSync(`${this.project.codeDir}/.git`)) return;
    await this.git(["init", "--quiet", "--initial-branch=main"]);
    await this.git(["config", "user.name", "blackbox"]);
    await this.git(["config", "user.email", "bb@localhost"]);
  }

  async commit(message: string): Promise<void> {
    await this.git(["add", "--all", "."]);
    await this.git(["commit", "--quiet", "--allow-empty", "-m", message]);
  }
}
