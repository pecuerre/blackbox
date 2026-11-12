import { query, type CanUseTool, type PermissionResult, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { isAbsolute, relative, resolve } from "node:path";
import type { Project } from "./project.js";
import { c, choose, confirm } from "./ui.js";

export interface AgentRunOptions {
  project: Project;
  systemPrompt: string;
  task: string;
  /** Skip confirmation for shell commands. */
  yes?: boolean;
}

export interface AgentRunResult {
  ok: boolean;
  summary: string;
  costUsd?: number;
  /** Spec files the agent edited (clarifications written back). */
  specEdits: Set<string>;
}

/** Tools approved without asking; everything else goes through `canUseTool`. */
const READ_ONLY_TOOLS = ["Read", "Glob", "Grep", "TodoWrite", "WebSearch", "WebFetch", "Agent"];

// We deliberately auto-approve read-only tools via allowedTools; the SDK warns
// that canUseTool won't see them. That is the intent, so drop just that warning.
const defaultWarningListeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (warning: Error & { code?: string }) => {
  if (warning.code === "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED") return;
  for (const listener of defaultWarningListeners) listener(warning);
});

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { project } = opts;
  const specEdits = new Set<string>();
  const autoApproveBash = Boolean(opts.yes) || project.config.agent.bash === "allow";

  const isInside = (path: string, dir: string) => {
    const rel = relative(dir, path);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  };

  const canUseTool: CanUseTool = async (toolName, input): Promise<PermissionResult> => {
    // 1. Questions from the agent are answered by the human, in the terminal.
    if (toolName === "AskUserQuestion") {
      const questions = (input.questions ?? []) as Array<{
        question: string;
        options: Array<{ label: string; description?: string }>;
        multiSelect?: boolean;
      }>;
      const answers: Record<string, string> = {};
      for (const q of questions) {
        answers[q.question] = await choose(q.question, q.options, Boolean(q.multiSelect));
      }
      return { behavior: "allow", updatedInput: { ...input, answers } };
    }

    // 2. File writes: only inside the layers the agent owns.
    if (toolName === "Write" || toolName === "Edit" || toolName === "NotebookEdit") {
      const raw = String(input.file_path ?? input.notebook_path ?? "");
      const target = resolve(project.root, raw);
      if (isInside(target, project.historyDir) || target === resolve(project.root, "blackbox.yaml")) {
        return { behavior: "deny", message: "That file is managed by bb; do not modify it." };
      }
      if (isInside(target, project.codeDir) || isInside(target, project.agentsDir)) {
        return { behavior: "allow", updatedInput: input };
      }
      if (isInside(target, project.specDir)) {
        specEdits.add(relative(project.root, target));
        console.log(c.yellow(`  ✎ updating the spec: ${relative(project.root, target)}`));
        return { behavior: "allow", updatedInput: input };
      }
      return {
        behavior: "deny",
        message: `Writes are only allowed inside ${project.config.paths.code}/, .blackbox/agents/ and ${project.config.paths.spec}/.`,
      };
    }

    // 3. Shell commands (installing packages, running migrations and tests...).
    if (toolName === "Bash") {
      if (autoApproveBash) return { behavior: "allow", updatedInput: input };
      const cmd = String(input.command ?? "");
      console.log(`\n${c.yellow("$")} ${cmd}${input.description ? c.dim(`   # ${String(input.description)}`) : ""}`);
      return (await confirm("  Allow this command?", true))
        ? { behavior: "allow", updatedInput: input }
        : { behavior: "deny", message: "The user declined this command. Find another way or explain what is needed." };
    }

    // 4. Anything else: ask.
    return (await confirm(`  Allow the agent to use ${toolName}?`, false))
      ? { behavior: "allow", updatedInput: input }
      : { behavior: "deny", message: `The user declined ${toolName}.` };
  };

  const session = query({
    prompt: opts.task,
    options: {
      cwd: project.root,
      model: project.config.agent.model,
      effort: project.config.agent.effort,
      maxTurns: project.config.agent.maxTurns,
      systemPrompt: { type: "preset", preset: "claude_code", append: opts.systemPrompt },
      // Isolate compiles from the user's personal Claude Code settings.
      settingSources: [],
      permissionMode: "default",
      allowedTools: READ_ONLY_TOOLS,
      canUseTool,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "blackbox-bb/0.1.0" },
    },
  });

  let result: AgentRunResult = { ok: false, summary: "", specEdits };
  for await (const message of session) {
    render(message, project, autoApproveBash);
    if (message.type === "result") {
      result =
        message.subtype === "success"
          ? { ok: !message.is_error, summary: message.result, costUsd: message.total_cost_usd, specEdits }
          : { ok: false, summary: `Agent stopped: ${message.subtype}`, costUsd: message.total_cost_usd, specEdits };
    }
  }
  return result;
}

/** Print a compact, non-technical trace of what the agent is doing. */
function render(message: SDKMessage, project: Project, autoApproveBash: boolean): void {
  if (message.type !== "assistant" || message.parent_tool_use_id) return;
  for (const block of message.message.content) {
    if (block.type === "text" && block.text.trim()) {
      console.log(`\n${block.text.trim()}`);
    } else if (block.type === "tool_use") {
      const input = block.input as Record<string, unknown>;
      const path = typeof input.file_path === "string" ? relative(project.root, resolve(project.root, input.file_path)) : "";
      switch (block.name) {
        case "Write":
          console.log(c.dim(`  + ${path}`));
          break;
        case "Edit":
          console.log(c.dim(`  ~ ${path}`));
          break;
        case "Read":
          console.log(c.dim(`  · reading ${path}`));
          break;
        case "Bash":
          // When commands need confirmation, canUseTool already shows them.
          if (autoApproveBash) {
            console.log(c.dim(`  $ ${String(input.description ?? input.command ?? "")}`));
          }
          break;
        case "AskUserQuestion":
          break; // shown interactively by canUseTool
        default:
          console.log(c.dim(`  · ${block.name}`));
      }
    }
  }
}
