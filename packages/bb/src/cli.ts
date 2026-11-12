#!/usr/bin/env node
import { Command } from "commander";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describeStatus } from "./changeset.js";
import { compile } from "./compiler.js";
import { CONFIG_FILE, loadProject } from "./project.js";
import { SpecHistory } from "./snapshots.js";
import { c } from "./ui.js";

const TEMPLATE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../templates/project");

const program = new Command()
  .name("bb")
  .description("BlackBox: describe your website in plain language, get a working app.")
  .version("0.1.0");

program
  .command("init")
  .description("create a new BlackBox project")
  .argument("[dir]", "project directory", ".")
  .option("-s, --stack <stack>", "target stack (django, rails, laravel, nextjs, ...)", "django")
  .option("-n, --name <name>", "project name")
  .action(async (dir: string, opts: { stack: string; name?: string }) => {
    const root = resolve(dir);
    if (existsSync(join(root, CONFIG_FILE))) throw new Error(`${root} is already a BlackBox project.`);
    if (existsSync(root) && readdirSync(root).length > 0) {
      console.log(c.yellow(`Note: ${root} is not empty; existing files are kept.`));
    }
    cpSync(TEMPLATE_DIR, root, { recursive: true, force: false, errorOnExist: false });
    const configPath = join(root, CONFIG_FILE);
    const config = readFileSync(configPath, "utf8")
      .replace("{{name}}", opts.name ?? basename(root))
      .replace("{{stack}}", opts.stack);
    writeFileSync(configPath, config);
    await new SpecHistory(loadProject(root)).init();
    console.log(c.green(`✓ Created BlackBox project in ${root}`));
    console.log(`  Describe your site in ${c.bold("spec/")}, then run ${c.bold("bb compile")}.`);
  });

program
  .command("status")
  .description("show which spec files changed since the last compile")
  .action(async () => {
    const project = loadProject();
    const history = new SpecHistory(project);
    await history.init();
    const files = await history.changedFiles();
    if (!(await history.hasBaseline())) console.log(c.dim("Never compiled yet."));
    if (files.length === 0) return console.log(c.green("✓ Up to date: nothing to compile."));
    console.log(c.bold(`${files.length} change(s) waiting to be compiled:`));
    for (const f of files) console.log(`  ${describeStatus(f.status).padEnd(9)} ${project.config.paths.spec}/${f.path}`);
  });

program
  .command("diff")
  .description("show the spec changes since the last compile")
  .action(async () => {
    const history = new SpecHistory(loadProject());
    await history.init();
    const patch = await history.patch();
    console.log(patch || c.green("✓ No changes."));
  });

program
  .command("compile")
  .alias("build")
  .description("turn the spec changes into code")
  .option("-y, --yes", "don't ask before running shell commands")
  .option("--dry-run", "prepare the changeset and show the agent prompt, without running the agent")
  .action(async (opts: { yes?: boolean; dryRun?: boolean }) => {
    const ok = await compile(loadProject(), opts);
    process.exitCode = ok ? 0 : 1;
  });

program
  .command("log")
  .description("list previous compiles")
  .action(async () => {
    const out = await new SpecHistory(loadProject()).log();
    console.log(out || c.dim("No compiles yet."));
  });

program.parseAsync().catch((err: unknown) => {
  console.error(c.red(`bb: ${err instanceof Error ? err.message : String(err)}`));
  process.exitCode = 1;
});
