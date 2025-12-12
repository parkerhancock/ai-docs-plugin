/**
 * llms.txt Documentation Sync Script Template (with Playwright)
 *
 * Fetches documentation from a site's llms.txt using Playwright to bypass
 * Cloudflare or other bot protection. The llms.txt format uses ===/path===
 * as section delimiters.
 *
 * Usage:
 *   bun install  # Install playwright dependency
 *   bun run scripts/sync-docs.ts
 *   bun run scripts/sync-docs.ts --dry-run
 *
 * Required package.json dependencies:
 *   "playwright": "^1.49.0"
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// === CONFIGURE THESE ===
const LLMS_TXT_URL = "https://docs.example.com/llms.txt";
const BASE_DOC_URL = "https://docs.example.com";
const RESOURCES_DIR = join(import.meta.dir, "..", "resources");

interface ParsedDoc {
  path: string;
  content: string;
}

interface SyncResult {
  path: string;
  title: string;
  status: "created" | "skipped";
}

interface Manifest {
  source: string;
  syncedAt: string;
  fileCount: number;
  files: string[];
}

async function fetchLlmsTxt(): Promise<string> {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Navigating to ${LLMS_TXT_URL}...`);
    await page.goto(LLMS_TXT_URL, { waitUntil: "networkidle" });

    const content = await page.textContent("body");

    if (!content) {
      throw new Error("Failed to extract content from page");
    }

    return content;
  } finally {
    await browser.close();
  }
}

function parseLlmsTxt(content: string): ParsedDoc[] {
  const docs: ParsedDoc[] = [];
  // llms.txt uses ===/path=== as section delimiters
  const sections = content.split(/(?====\/)/);

  for (const section of sections) {
    const match = section.match(/^===\/([^=]+)===/);
    if (match) {
      const path = match[1];
      const body = section.replace(/^===[^=]+===\n?/, "").trim();
      if (body) {
        docs.push({ path, content: body });
      }
    }
  }

  return docs;
}

function pathToFilename(docPath: string): string {
  // Convert docs/guides/chat to guides-chat.md
  // Adjust this based on the site's path structure
  return (
    docPath
      .replace(/^docs\//, "") // Remove common prefix
      .replace(/\//g, "-") // Convert slashes to dashes
      .replace(/-+/g, "-") + ".md"
  );
}

function extractTitle(content: string, path: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : path.split("/").pop() || path;
}

async function syncDocs(dryRun: boolean): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const content = await fetchLlmsTxt();
  console.log("Parsing llms.txt...");

  const docs = parseLlmsTxt(content);
  console.log(`Found ${docs.length} documentation sections\n`);

  if (!dryRun && !existsSync(RESOURCES_DIR)) {
    await mkdir(RESOURCES_DIR, { recursive: true });
  }

  for (const doc of docs) {
    const filename = pathToFilename(doc.path);
    const title = extractTitle(doc.content, doc.path);
    const outputPath = join(RESOURCES_DIR, filename);

    if (dryRun) {
      console.log(`[DRY RUN] Would write: ${filename} (${title})`);
      results.push({ path: filename, title, status: "skipped" });
    } else {
      // Add frontmatter with source URL
      const contentWithMeta = `---
source: ${BASE_DOC_URL}/${doc.path}
---

${doc.content}`;

      await writeFile(outputPath, contentWithMeta);
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

  await writeFile(
    join(RESOURCES_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(50));
  console.log("llms.txt Documentation Sync (Playwright)");
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
    console.error("\nSync failed:", error);
    process.exit(1);
  }
}

main();
