#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/site-builder.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const result = buildSite({ root, liveReload: process.env.RESUME_LIVE_RELOAD === "1" });
  console.log(`Built ${result.htmlPath} from ${result.markdownPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
