import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();

function listSourceFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

function expectNoImports(files: string[], forbiddenPattern: RegExp) {
  const offenders = files
    .map((file) => ({
      file: relative(repoRoot, file),
      text: readFileSync(file, "utf8")
    }))
    .filter(({ text }) => forbiddenPattern.test(text))
    .map(({ file }) => file);

  expect(offenders).toEqual([]);
}

describe("architecture boundaries", () => {
  it("keeps core independent from app, editor, render, ui, and assets layers", () => {
    expectNoImports(
      listSourceFiles(join(repoRoot, "src", "core")),
      /from\s+["']@\/(?:app|editor|render|ui|assets)\//
    );
  });

  it("keeps server imports on shared core protocol instead of browser app modules", () => {
    expectNoImports(
      listSourceFiles(join(repoRoot, "server", "src")),
      /from\s+["'](?:\.\.\/\.\.\/src\/app|@\/app)\//
    );
  });
});
