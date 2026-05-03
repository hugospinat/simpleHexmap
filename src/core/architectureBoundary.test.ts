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

function readImports(file: string): string[] {
  const matches = readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g);
  return Array.from(matches, (match) => match[1]);
}

function topLevelSlice(file: string): string | null {
  const relativePath = relative(repoRoot, file).replace(/\\/g, "/");

  if (!relativePath.startsWith("src/")) {
    return null;
  }

  return relativePath.split("/")[1] ?? null;
}

function fileLineCount(file: string): number {
  return readFileSync(file, "utf8").split("\n").length;
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

  it("forces cross-slice imports to use explicit slice entrypoints", () => {
    const nonCoreSlices = new Set(["app", "editor", "render", "ui", "assets"]);
    const offenders = listSourceFiles(join(repoRoot, "src"))
      .flatMap((file) => {
        const importerSlice = topLevelSlice(file);

        if (!importerSlice || !nonCoreSlices.has(importerSlice)) {
          return [];
        }

        return readImports(file)
          .filter((value) => value.startsWith("@/"))
          .filter((value) => {
            const match = value.match(/^@\/([^/]+)\/(.+)$/);

            if (!match) {
              return false;
            }

            const importedSlice = match[1];
            const remainder = match[2];

            if (!nonCoreSlices.has(importedSlice) || importedSlice === importerSlice) {
              return false;
            }

            return remainder.split("/").length > 1;
          })
          .map((value) => `${relative(repoRoot, file)} -> ${value}`);
      });

    expect(offenders).toEqual([]);
  });

  it("rejects accidental name-clash artifact files", () => {
    const offenders = listSourceFiles(join(repoRoot, "src"))
      .map((file) => relative(repoRoot, file))
      .filter((file) => file.includes("(# Name clash"));

    expect(offenders).toEqual([]);
  });

  it("keeps orchestration hotspots below the refactor thresholds", () => {
    expect(fileLineCount(join(repoRoot, "src", "app", "App.tsx"))).toBeLessThanOrEqual(120);
    expect(
      fileLineCount(
        join(repoRoot, "src", "editor", "hooks", "useEditorController.ts"),
      ),
    ).toBeLessThanOrEqual(320);
    expect(fileLineCount(join(repoRoot, "server", "src", "httpRoutes.ts"))).toBeLessThanOrEqual(80);
    expect(fileLineCount(join(repoRoot, "server", "src", "wsRoutes.ts"))).toBeLessThanOrEqual(140);
    expect(
      fileLineCount(join(repoRoot, "server", "src", "operationService.ts")),
    ).toBeLessThanOrEqual(120);
  });
});
