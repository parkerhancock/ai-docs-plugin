#!/usr/bin/env bun
/**
 * Template: Sync documentation by scraping HTML and converting to markdown.
 *
 * Usage:
 *   bun run sync          # Sync all docs
 *   bun run sync:dry      # Preview without writing
 *
 * Customize:
 *   1. Set DOC_PAGES with URLs and output paths
 *   2. Adjust content selectors for the target site
 *   3. Adjust removeSelectors to clean up unwanted elements
 *
 * Dependencies:
 *   bun add turndown linkedom
 */

import { parseArgs } from "util";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import TurndownService from "turndown";
import { parseHTML } from "linkedom";

// ============ CUSTOMIZE THESE ============
interface DocPage {
  url: string;
  outputPath: string;
  title: string;
}

const DOC_PAGES: DocPage[] = [
  {
    url: "https://docs.example.com/getting-started",
    outputPath: "getting-started.md",
    title: "Getting Started",
  },
  {
    url: "https://docs.example.com/configuration",
    outputPath: "configuration.md",
    title: "Configuration",
  },
  // Add more pages here...
];

// CSS selectors to find main content (tried in order)
const CONTENT_SELECTORS = [
  "article",
  '[role="main"]',
  "main",
  ".content",
  ".documentation",
];

// CSS selectors for elements to remove
const REMOVE_SELECTORS = [
  "nav",
  "header",
  "footer",
  "script",
  "style",
  ".sidebar",
  ".navigation",
  '[role="navigation"]',
];
// =========================================

const RESOURCES_DIR = join(import.meta.dir, "..", "resources");

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Custom rule for code blocks
turndown.addRule("codeBlocks", {
  filter: (node) => {
    return (
      node.nodeName === "PRE" ||
      (node.nodeName === "CODE" && node.parentNode?.nodeName !== "PRE")
    );
  },
  replacement: (content, node) => {
    if (node.nodeName === "PRE") {
      const code = node.querySelector("code");
      const lang =
        code?.className?.match(/language-(\w+)/)?.[1] ||
        code?.getAttribute("data-lang") ||
        "";
      const text = code?.textContent || node.textContent || "";
      return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;
    }
    return `\`${content}\``;
  },
});

async function fetchAndConvert(page: DocPage): Promise<string> {
  console.log(`Fetching: ${page.url}`);

  const response = await fetch(page.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${page.url}: ${response.status}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  // Find the main content area
  let article = null;
  for (const selector of CONTENT_SELECTORS) {
    article = document.querySelector(selector);
    if (article) break;
  }

  if (!article) {
    article = document.body;
  }

  // Remove unwanted elements
  for (const selector of REMOVE_SELECTORS) {
    for (const el of article.querySelectorAll(selector)) {
      el.remove();
    }
  }

  // Convert to markdown
  const markdown = turndown.turndown(article.innerHTML);

  // Add frontmatter
  const output = `---
title: "${page.title}"
source: "${page.url}"
synced: "${new Date().toISOString()}"
---

${markdown}
`;

  return output;
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

  let synced = 0;
  let failed = 0;

  for (const page of DOC_PAGES) {
    try {
      const markdown = await fetchAndConvert(page);
      const outputPath = join(RESOURCES_DIR, page.outputPath);

      if (dryRun) {
        console.log(`Would write: ${page.outputPath} (${markdown.length} bytes)`);
      } else {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, markdown, "utf-8");
        console.log(`Wrote: ${page.outputPath}`);
      }
      synced++;
    } catch (error) {
      console.error(`Failed to sync ${page.url}:`, error);
      failed++;
    }
  }

  console.log(`\nDone. Synced: ${synced}, Failed: ${failed}`);
}

main().catch(console.error);
