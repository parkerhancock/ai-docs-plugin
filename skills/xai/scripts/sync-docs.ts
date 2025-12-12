/**
 * xAI (Grok) Documentation Sync Script
 *
 * Fetches documentation from docs.x.ai/llms.txt and parses into individual files.
 * Uses browser automation to bypass Cloudflare protection.
 *
 * Usage:
 *   cd skills/xai
 *   bun run scripts/sync-docs.ts
 *   bun run scripts/sync-docs.ts --dry-run
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const LLMS_TXT_URL = "https://docs.x.ai/llms.txt";
const RESOURCES_DIR = join(import.meta.dir, "..", "resources");
const DEV_BROWSER_DIR = join(
  process.env.HOME || "",
  ".agents/skills/dev-browser"
);

interface SyncResult {
  path: string;
  title: string;
  status: "created" | "updated" | "unchanged" | "skipped";
}

interface Manifest {
  source: string;
  syncedAt: string;
  fileCount: number;
  files: string[];
}

async function fetchLlmsTxt(): Promise<string> {
  // Check if dev-browser is available
  if (!existsSync(DEV_BROWSER_DIR)) {
    throw new Error(
      "dev-browser skill not found. Please install it first.\n" +
        "The xAI docs require browser automation to bypass Cloudflare."
    );
  }

  const fetchScript = join(import.meta.dir, "fetch-llms.ts");

  // Call the fetch helper script
  const proc = Bun.spawn(["bun", "x", "tsx", fetchScript], {
    cwd: DEV_BROWSER_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to fetch llms.txt: ${stderr}`);
  }

  return output;
}

function parseLlmsTxt(content: string): Map<string, string> {
  const docs = new Map<string, string>();
  const sections = content.split(/(?====\/)/);

  for (const section of sections) {
    const match = section.match(/^===\/([^=]+)===/);
    if (match) {
      const path = match[1];
      const body = section.replace(/^===[^=]+===\n?/, "").trim();
      if (body) {
        docs.set(path, body);
      }
    }
  }

  return docs;
}

function pathToFilename(docPath: string): string {
  // Convert /docs/guides/chat to guides-chat.md
  return (
    docPath
      .replace(/^docs\//, "")
      .replace(/\//g, "-")
      .replace(/-+/g, "-") + ".md"
  );
}

async function syncDocs(dryRun: boolean): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  console.log("Fetching llms.txt from docs.x.ai...");
  const content = await fetchLlmsTxt();

  console.log("Parsing documentation sections...");
  const docs = parseLlmsTxt(content);
  console.log(`Found ${docs.size} documentation sections`);

  if (!dryRun) {
    if (!existsSync(RESOURCES_DIR)) {
      mkdirSync(RESOURCES_DIR, { recursive: true });
    }
  }

  for (const [path, body] of docs) {
    const filename = pathToFilename(path);
    const outputPath = join(RESOURCES_DIR, filename);

    // Extract title from first heading or path
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : path.split("/").pop() || path;

    if (dryRun) {
      console.log(`[DRY RUN] Would write: ${filename} (${title})`);
      results.push({ path: filename, title, status: "skipped" });
    } else {
      // Add frontmatter with source
      const contentWithMeta = `---
source: https://docs.x.ai/${path}
---

${body}`;
      writeFileSync(outputPath, contentWithMeta);
      console.log(`Wrote: ${filename}`);
      results.push({ path: filename, title, status: "created" });
    }
  }

  return results;
}

async function writeManifest(results: SyncResult[]): Promise<void> {
  const manifest: Manifest = {
    source: LLMS_TXT_URL,
    syncedAt: new Date().toISOString(),
    fileCount: results.filter((r) => r.status !== "skipped").length,
    files: results.map((r) => r.path).sort(),
  };

  writeFileSync(
    join(RESOURCES_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(50));
  console.log("xAI Documentation Sync");
  console.log("=".repeat(50));

  if (dryRun) {
    console.log("DRY RUN MODE - No files will be written\n");
  }

  try {
    const results = await syncDocs(dryRun);

    if (!dryRun) {
      await writeManifest(results);
    }

    console.log("\n" + "=".repeat(50));
    console.log("Sync complete!");
    console.log(`Total documents: ${results.length}`);

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    if (created > 0) console.log(`  Created: ${created}`);
    if (skipped > 0) console.log(`  Skipped (dry run): ${skipped}`);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

main();
