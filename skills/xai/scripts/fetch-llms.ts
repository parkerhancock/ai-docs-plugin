/**
 * Helper script to fetch llms.txt using dev-browser
 * Called by sync-docs.ts
 */

import { connect, waitForPageLoad } from "@/client.js";

const LLMS_TXT_URL = "https://docs.x.ai/llms.txt";

async function main() {
  const client = await connect("http://localhost:9222");
  const page = await client.page("xai-sync");

  await page.goto(LLMS_TXT_URL);
  await waitForPageLoad(page);

  const content = await page.textContent("body");
  console.log(content);

  await client.disconnect();
}

main();
