#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportPdf } from "../src/pdf-exporter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const result = exportPdf({ root });
  console.log(`Wrote ${result.outputPath} (${result.bytes} bytes)`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
