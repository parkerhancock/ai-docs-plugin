#!/usr/bin/env bun
/**
 * Template: Sync documentation by directly fetching markdown files.
 *
 * Usage:
 *   bun run sync          # Sync all docs
 *   bun run sync:dry      # Preview without writing
 *
 * Best for sites that expose raw .md files (like code.claude.com).
 *
 * Customize:
 *   1. Set BASE_URL to the documentation site
 *   2. Set DOC_PATHS with the markdown file paths
 */

import { parseArgs } from "util";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";

// ============ CUSTOMIZE THESE ============
const BASE_URL = "https://docs.example.com";

const DOC_PATHS = [
  "getting-started.md",
  "configuration.md",
  "api/overview.md",
  "api/reference.md",
  // Add more paths here...
];
// =========================================

const RESOURCES_DIR = join(import.meta.dir, "..", "resources");

interface SyncResult {
  path: string;
  hash: string;
  size: number;
}

async function fetchDoc(path: string): Promise<string> {
  const url = `${BASE_URL}/${path}`;
  console.log(`Fetching: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  });

  const dryRun = values["dry-run"];

  console.log(`\nSyncing docs from ${BASE_URL}${dryRun ? " (dry run)" : ""}...\n`);

  const results: SyncResult[] = [];
  let synced = 0;
  let failed = 0;

  for (const path of DOC_PATHS) {
    try {
      const content = await fetchDoc(path);
      const outputPath = join(RESOURCES_DIR, path);
      const hash = hashContent(content);

      if (dryRun) {
        console.log(`Would write: ${path} (${content.length} bytes, ${hash})`);
      } else {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, content, "utf-8");
        console.log(`Wrote: ${path}`);
      }

      results.push({ path, hash, size: content.length });
      synced++;
    } catch (error) {
      console.error(`Failed to sync ${path}:`, error);
      failed++;
    }
  }

  // Write manifest
  if (!dryRun && results.length > 0) {
    const manifest = {
      source: BASE_URL,
      syncedAt: new Date().toISOString(),
      fileCount: results.length,
      files: results.map((r) => ({
        path: r.path,
        hash: r.hash,
      })),
    };

    const manifestPath = join(RESOURCES_DIR, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    console.log(`\nWrote manifest: ${manifestPath}`);
  }

  console.log(`\nDone. Synced: ${synced}, Failed: ${failed}`);
}

main().catch(console.error);
