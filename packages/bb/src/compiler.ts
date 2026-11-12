import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent } from "./agent.js";
import { archiveChangeset, buildChangeset } from "./changeset.js";
import type { Project } from "./project.js";
import { compileTask, compilerSystemPrompt } from "./prompts.js";
import { CodeHistory, SpecHistory } from "./snapshots.js";
import { c } from "./ui.js";

export interface CompileOptions {
  yes?: boolean;
  dryRun?: boolean;
}

/**
 * One compile = one changeset:
 *   spec now  vs  spec at last compile  →  changeset  →  agent  →  code
 * Only when the agent succeeds do we move the "compiled" snapshot forward,
 * so a failed or interrupted compile is simply retried next time.
 */
export async function compile(project: Project, opts: CompileOptions = {}): Promise<boolean> {
  const spec = new SpecHistory(project);
  const code = new CodeHistory(project);
  await spec.init();
  mkdirSync(project.codeDir, { recursive: true });
  await code.init();

  const changeset = await buildChangeset(project, spec);
  if (changeset.files.length === 0) {
    console.log(c.green("✓ Nothing to compile: the spec hasn't changed since the last compile."));
    return true;
  }

  console.log(c.bold(changeset.firstCompile ? "First compile" : `Compiling ${changeset.files.length} spec change(s)`));
  for (const f of changeset.files) console.log(c.dim(`  ${f.status}  ${project.config.paths.spec}/${f.path}`));

  const systemPrompt = compilerSystemPrompt(project);
  const task = compileTask(project, changeset);

  if (opts.dryRun) {
    console.log(`\n${c.bold("— system prompt (appended) —")}\n${systemPrompt}\n\n${c.bold("— task —")}\n${task}`);
    console.log(c.dim(`\nChangeset written to ${changeset.file}`));
    return true;
  }

  const startedAt = new Date();
  const result = await runAgent({ project, systemPrompt, task, yes: opts.yes });

  mkdirSync(project.logDir, { recursive: true });
  const logFile = join(project.logDir, `${startedAt.toISOString().replace(/[:.]/g, "-")}.md`);
  writeFileSync(
    logFile,
    [
      `# Compile ${startedAt.toISOString()}`,
      "",
      `Status: ${result.ok ? "success" : "failed"}`,
      result.costUsd !== undefined ? `Cost: $${result.costUsd.toFixed(2)}` : "",
      "",
      "## Changes",
      ...changeset.files.map((f) => `- ${f.status} ${f.path}`),
      "",
      "## Agent summary",
      result.summary,
      "",
    ].join("\n"),
  );

  if (!result.ok) {
    console.log(`\n${c.red("✗ Compile failed.")} The spec changes are still pending; run \`bb compile\` again.`);
    console.log(c.dim(result.summary));
    return false;
  }

  // The agent may have written clarifications into the spec: they are part of this snapshot.
  const firstLine = changeset.files.map((f) => f.path).slice(0, 3).join(", ");
  const snapshotId = await spec.commit(`compile: ${firstLine}${changeset.files.length > 3 ? ", ..." : ""}`);
  await code.commit(`bb compile ${snapshotId}\n\nSpec changes:\n${changeset.files.map((f) => `${f.status} ${f.path}`).join("\n")}`);
  archiveChangeset(project, snapshotId);
  appendFileSync(join(project.logDir, "index.md"), `- ${startedAt.toISOString()} ${snapshotId} ${firstLine}\n`);

  console.log(`\n${c.green("✓ Compiled")} ${c.dim(`(snapshot ${snapshotId}${result.costUsd !== undefined ? `, $${result.costUsd.toFixed(2)}` : ""})`)}`);
  if (result.specEdits.size > 0) {
    console.log(c.yellow(`  Your answers were added to: ${[...result.specEdits].join(", ")}`));
  }
  return true;
}

