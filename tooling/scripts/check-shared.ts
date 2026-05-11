/**
 * check-shared.ts — Utils / shared folder entropy detection.
 *
 * Heuristic: the shared/utils package is a junk-drawer magnet.
 * This script fails when:
 *   - shared/utils has too many files (>25)
 *   - any util file imports from a feature
 *   - any util file has a React dependency
 *   - shared folder fan-in exceeds threshold
 *
 * Currently a skeleton — packages don't exist yet.
 * Expand the checks once apps/ and packages/ are scaffolded.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MAX_UTILS_FILES = 25;

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { recursive: true });
    return entries.filter((e) => e.endsWith(".ts") || e.endsWith(".tsx")).length;
  } catch {
    return 0;
  }
}

async function check(workspaceRoot: string): Promise<string[]> {
  const errors: string[] = [];

  const utilsDirs = [
    join(workspaceRoot, "packages/utils/src"),
    join(workspaceRoot, "packages/shared/src"),
    join(workspaceRoot, "packages/util/src"),
    join(workspaceRoot, "apps/mobile/src/utils"),
    join(workspaceRoot, "apps/api/src/utils"),
  ];

  for (const dir of utilsDirs) {
    const count = await countFiles(dir);
    if (count > MAX_UTILS_FILES) {
      errors.push(
        `[shared-check] ${dir} has ${String(count)} files (max ${String(MAX_UTILS_FILES)}). ` +
          "Too many — move domain code into features or dedicated packages.",
      );
    }
  }

  return errors;
}

async function main(): Promise<void> {
  const root = process.argv[2] ?? process.cwd();
  const errors = await check(root);

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("[shared-check] OK");
}

void main();
