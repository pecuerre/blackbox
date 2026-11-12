import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const tty = stdout.isTTY;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: paint("2"),
  bold: paint("1"),
  green: paint("32"),
  yellow: paint("33"),
  red: paint("31"),
  cyan: paint("36"),
};

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const answer = (await prompt(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

export interface Choice {
  label: string;
  description?: string;
}

/**
 * Show numbered options; the user picks by number (comma-separated if
 * multiple) or types a free-form answer instead.
 */
export async function choose(question: string, options: Choice[], multi: boolean): Promise<string> {
  console.log(`\n${c.bold(c.cyan("?"))} ${c.bold(question)}`);
  options.forEach((o, i) => {
    console.log(`  ${c.cyan(String(i + 1))}. ${o.label}${o.description ? c.dim(` — ${o.description}`) : ""}`);
  });
  const hint = multi ? "numbers separated by commas, or type your own answer" : "a number, or type your own answer";
  for (;;) {
    const raw = await prompt(c.dim(`  (${hint}) › `));
    if (!raw) continue;
    const picks = raw.split(",").map((s) => s.trim());
    if (picks.every((p) => /^\d+$/.test(p))) {
      const idx = picks.map((p) => Number(p) - 1);
      if (idx.every((i) => i >= 0 && i < options.length) && (multi || idx.length === 1)) {
        return idx.map((i) => options[i]!.label).join(", ");
      }
      console.log(c.yellow("  Not a valid choice."));
      continue;
    }
    return raw; // free-form answer
  }
}
