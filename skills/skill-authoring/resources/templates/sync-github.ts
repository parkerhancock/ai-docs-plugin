#!/usr/bin/env bun
/**
 * Template: Sync documentation from a GitHub repository.
 *
 * Usage:
 *   bun run sync          # Sync all docs
 *   bun run sync:dry      # Preview without writing
 *
 * Customize:
 *   1. Set REPO_URL to the target repository
 *   2. Set SOURCE_PATH to the docs folder within the repo
 *   3. Adjust file extensions if needed (.md, .mdx, .rst, etc.)
 */

import { parseArgs } from "util";
import { mkdir, writeFile, readFile, rm, readdir } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { existsSync } from "fs";

// ============ CUSTOMIZE THESE ============
const REPO_URL = "https://github.com/org/repo.git";
const SOURCE_PATH = "docs";  // Path to docs within the repo
// =========================================

const RESOURCES_DIR = join(import.meta.dir, "..", "resources");
const TEMP_DIR = "/tmp/docs-sync-" + Date.now();

interface SyncResult {
  path: string;
  size: number;
}

async function cloneRepo(): Promise<void> {
  console.log(`Cloning ${REPO_URL}...`);

  if (existsSync(TEMP_DIR)) {
    await rm(TEMP_DIR, { recursive: true });
  }

  execSync(`git clone --depth 1 ${REPO_URL} ${TEMP_DIR}`, {
    stdio: "pipe",
  });
}

async function getCommitHash(): Promise<string> {
  const hash = execSync("git rev-parse HEAD", {
    cwd: TEMP_DIR,
    encoding: "utf-8",
  }).trim();
  return hash;
}

async function copyDocs(dryRun: boolean): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const sourceDir = join(TEMP_DIR, SOURCE_PATH);

  if (!existsSync(sourceDir)) {
    throw new Error(`Source path not found: ${SOURCE_PATH}`);
  }

  async function processDir(dir: string, relPath: string = ""): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(dir, entry.name);
      const targetRelPath = join(relPath, entry.name);

      if (entry.isDirectory()) {
        await processDir(sourcePath, targetRelPath);
      } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
        // Convert .mdx to .md for consistency
        const outputName = entry.name.replace(/\.mdx$/, ".md");
        const outputRelPath = join(relPath, outputName);
        const outputPath = join(RESOURCES_DIR, outputRelPath);

        const content = await readFile(sourcePath, "utf-8");

        if (dryRun) {
          console.log(`Would write: ${outputRelPath} (${content.length} bytes)`);
        } else {
          await mkdir(join(RESOURCES_DIR, relPath), { recursive: true });
          await writeFile(outputPath, content, "utf-8");
          console.log(`Wrote: ${outputRelPath}`);
        }

        results.push({ path: outputRelPath, size: content.length });
      }
    }
  }

  await processDir(sourceDir);
  return results;
}

async function writeManifest(
  results: SyncResult[],
  commitHash: string,
  dryRun: boolean
): Promise<void> {
  const manifest = {
    source: REPO_URL.replace(".git", ""),
    sourcePath: SOURCE_PATH,
    commit: commitHash,
    syncedAt: new Date().toISOString(),
    fileCount: results.length,
    files: results.map((r) => r.path).sort(),
  };

  const manifestPath = join(RESOURCES_DIR, "manifest.json");

  if (dryRun) {
    console.log(`\nWould write manifest with ${results.length} files`);
  } else {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    console.log(`\nWrote manifest: ${manifestPath}`);
  }
}

async function cleanup(): Promise<void> {
  if (existsSync(TEMP_DIR)) {
    await rm(TEMP_DIR, { recursive: true });
  }
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  });

  const dryRun = values["dry-run"];

  console.log(`\nSyncing docs${dryRun ? " (dry run)" : ""}...\n`);

  try {
    await cloneRepo();
    const commitHash = await getCommitHash();
    console.log(`Source commit: ${commitHash}\n`);

    if (!dryRun) {
      await mkdir(RESOURCES_DIR, { recursive: true });
    }

    const results = await copyDocs(dryRun);
    await writeManifest(results, commitHash, dryRun);

    console.log(`\nDone. Synced ${results.length} files.`);
  } finally {
    await cleanup();
  }
}

main().catch(console.error);
