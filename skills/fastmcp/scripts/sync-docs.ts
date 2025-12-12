/**
 * FastMCP Documentation Sync Script
 *
 * Clones the jlowin/fastmcp repository and copies docs to resources.
 *
 * Usage:
 *   cd skills/fastmcp
 *   bun run scripts/sync-docs.ts
 *   bun run scripts/sync-docs.ts --dry-run
 */

import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  readdirSync,
  copyFileSync,
  statSync,
} from "fs";
import { join, basename } from "path";

const REPO_URL = "https://github.com/jlowin/fastmcp.git";
const SOURCE_PATH = "docs";
const RESOURCES_DIR = join(import.meta.dir, "..", "resources");
const TEMP_DIR = "/tmp/fastmcp-docs-sync";

interface SyncResult {
  path: string;
  title: string;
  status: "created" | "updated" | "unchanged" | "skipped";
}

interface Manifest {
  source: string;
  commit: string;
  syncedAt: string;
  fileCount: number;
  files: string[];
}

// Directories to skip
const SKIP_DIRS = new Set([
  ".cursor",
  "assets",
  "css",
  "public",
  "snippets",
  "node_modules",
]);

// Files to skip
const SKIP_FILES = new Set([".ccignore"]);

async function cloneRepo(): Promise<void> {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true });
  }
  console.log(`Cloning ${REPO_URL}...`);
  execSync(`git clone --depth 1 ${REPO_URL} ${TEMP_DIR}`, { stdio: "pipe" });
}

function getCommitHash(): string {
  return execSync("git rev-parse HEAD", { cwd: TEMP_DIR, encoding: "utf-8" }).trim();
}

async function copyDocs(dryRun: boolean): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const sourceDir = join(TEMP_DIR, SOURCE_PATH);

  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  async function processDir(dir: string, relPath: string = ""): Promise<void> {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        await processDir(fullPath, join(relPath, entry.name));
      } else if (entry.isFile()) {
        // Skip certain files
        if (SKIP_FILES.has(entry.name)) {
          continue;
        }

        // Only process .md and .mdx files
        if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) {
          continue;
        }

        // Convert path to flat filename
        const outputName = relPath
          ? `${relPath.replace(/\//g, "-")}-${entry.name}`.replace(/\.mdx$/, ".md")
          : entry.name.replace(/\.mdx$/, ".md");

        const outputPath = join(RESOURCES_DIR, outputName);

        // Extract title from content
        const content = readFileSync(fullPath, "utf-8");
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : entry.name.replace(/\.(md|mdx)$/, "");

        if (dryRun) {
          console.log(`[DRY RUN] Would copy: ${outputName} (${title})`);
          results.push({ path: outputName, title, status: "skipped" });
        } else {
          // Copy file (rename .mdx to .md)
          copyFileSync(fullPath, outputPath);
          console.log(`Copied: ${outputName}`);
          results.push({ path: outputName, title, status: "created" });
        }
      }
    }
  }

  await processDir(sourceDir);
  return results;
}

async function writeManifest(commit: string, results: SyncResult[]): Promise<void> {
  const manifest: Manifest = {
    source: REPO_URL,
    commit,
    syncedAt: new Date().toISOString(),
    fileCount: results.filter((r) => r.status !== "skipped").length,
    files: results.map((r) => r.path).sort(),
  };

  writeFileSync(
    join(RESOURCES_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

async function cleanup(): Promise<void> {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true });
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(50));
  console.log("FastMCP Documentation Sync");
  console.log("=".repeat(50));

  if (dryRun) {
    console.log("DRY RUN MODE - No files will be written\n");
  }

  try {
    await cloneRepo();
    const commit = getCommitHash();
    console.log(`Commit: ${commit}\n`);

    if (!dryRun) {
      if (!existsSync(RESOURCES_DIR)) {
        mkdirSync(RESOURCES_DIR, { recursive: true });
      }
    }

    const results = await copyDocs(dryRun);

    if (!dryRun) {
      await writeManifest(commit, results);
    }

    console.log("\n" + "=".repeat(50));
    console.log("Sync complete!");
    console.log(`Commit: ${commit}`);
    console.log(`Total documents: ${results.length}`);

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    if (created > 0) console.log(`  Created: ${created}`);
    if (skipped > 0) console.log(`  Skipped (dry run): ${skipped}`);
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("Sync failed:", error);
  cleanup();
  process.exit(1);
});
