#!/usr/bin/env bun
/**
 * Sync Gemini image generation documentation to local markdown files.
 *
 * Usage:
 *   bun run sync          # Sync all docs
 *   bun run sync:dry      # Preview without writing
 *
 * Fetches official Google Gemini API image generation documentation.
 */

import { parseArgs } from "util";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import TurndownService from "turndown";
import { parseHTML } from "linkedom";

interface DocPage {
  url: string;
  outputPath: string;
  title: string;
}

// Image generation documentation pages
const DOC_PAGES: DocPage[] = [
  {
    url: "https://ai.google.dev/gemini-api/docs/image-generation",
    outputPath: "gemini-image-generation.md",
    title: "Gemini Image Generation",
  },
  {
    url: "https://ai.google.dev/gemini-api/docs/imagen",
    outputPath: "imagen.md",
    title: "Imagen",
  },
];

const RESOURCES_DIR = join(import.meta.dir, "..", "resources");

async function fetchAndConvert(page: DocPage): Promise<string> {
  console.log(`Fetching: ${page.url}`);

  const response = await fetch(page.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${page.url}: ${response.status}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  // Find the main content area
  const article =
    document.querySelector("article") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("main") ||
    document.querySelector(".devsite-article-body") ||
    document.body;

  if (!article) {
    throw new Error(`Could not find content in ${page.url}`);
  }

  // Remove navigation, headers, footers, and scripts
  const removeSelectors = [
    "nav",
    "header",
    "footer",
    "script",
    "style",
    ".devsite-nav",
    ".devsite-header",
    ".devsite-footer",
    ".devsite-banner",
    ".nocontent",
    '[role="navigation"]',
    ".devsite-article-meta",
    ".devsite-content-footer",
    ".devsite-page-rating",
  ];

  for (const selector of removeSelectors) {
    for (const el of article.querySelectorAll(selector)) {
      el.remove();
    }
  }

  // Convert to markdown
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // Handle code blocks
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

  console.log(
    `\nSyncing Gemini image generation docs${dryRun ? " (dry run)" : ""}...\n`
  );

  let synced = 0;
  let failed = 0;

  for (const page of DOC_PAGES) {
    try {
      const markdown = await fetchAndConvert(page);
      const outputPath = join(RESOURCES_DIR, page.outputPath);

      if (dryRun) {
        console.log(`Would write: ${outputPath} (${markdown.length} bytes)`);
      } else {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, markdown, "utf-8");
        console.log(`Wrote: ${outputPath}`);
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
