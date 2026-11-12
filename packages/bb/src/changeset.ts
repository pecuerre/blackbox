import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "./project.js";
import type { SpecHistory } from "./snapshots.js";

export interface Changeset {
  firstCompile: boolean;
  files: Array<{ status: string; path: string }>;
  patch: string;
  /** Path of the markdown file agents read. */
  file: string;
}

const STATUS_LABEL: Record<string, string> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "type changed",
};

export function describeStatus(status: string): string {
  return STATUS_LABEL[status[0]!] ?? status;
}

/**
 * Layer 3. Materialise the difference between the last compiled spec and the
 * current one into `.blackbox/diff/pending/`, where the agents read it.
 */
export async function buildChangeset(project: Project, history: SpecHistory): Promise<Changeset> {
  const firstCompile = !(await history.hasBaseline());
  const files = await history.changedFiles();
  const patch = await history.patch();

  const pendingDir = join(project.diffDir, "pending");
  rmSync(pendingDir, { recursive: true, force: true });
  mkdirSync(pendingDir, { recursive: true });

  const file = join(pendingDir, "changeset.md");
  const lines = [
    "# Pending changeset",
    "",
    firstCompile
      ? "This is the **first compile**: every spec file is new. Build the application from scratch."
      : "Spec changes since the last successful compile. Implement exactly these changes.",
    "",
    "## Files",
    "",
    ...files.map((f) => `- **${describeStatus(f.status)}**: \`${project.config.paths.spec}/${f.path}\``),
    "",
    "## Patch",
    "",
    "Binary files (images, .psd, ...) only appear as \"Binary files differ\": open them directly.",
    "",
    "````diff",
    patch.trimEnd(),
    "````",
    "",
  ];
  writeFileSync(file, lines.join("\n"));
  writeFileSync(join(pendingDir, "changeset.patch"), patch);

  return { firstCompile, files, patch, file };
}

/** Move the pending changeset to the archive once it has been compiled. */
export function archiveChangeset(project: Project, snapshotId: string): string {
  const pendingDir = join(project.diffDir, "pending");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(project.diffDir, "archive", `${stamp}_${snapshotId}`);
  if (existsSync(pendingDir)) {
    mkdirSync(target, { recursive: true });
    cpSync(pendingDir, target, { recursive: true });
    rmSync(pendingDir, { recursive: true, force: true });
  }
  return target;
}
