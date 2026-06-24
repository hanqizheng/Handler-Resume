#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/site-builder.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = buildSite({ root, liveReload: false });

console.log(`Built ${result.htmlPath}`);
