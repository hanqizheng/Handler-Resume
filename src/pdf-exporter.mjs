import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolveOutput, resolveSource } from "./config.mjs";
import { buildSite } from "./site-builder.mjs";

export function exportPdf({ root, source = resolveSource(), output = resolveOutput(source) } = {}) {
  if (!root) throw new Error("exportPdf requires a root directory");

  // Build into a private temp directory so a running preview server can't overwrite the page mid-export.
  const outDir = mkdtempSync(join(tmpdir(), "handler-resume-"));
  try {
    return printToPdf(buildSite({ root, liveReload: false, source, output, outDir }), resolve(root, output));
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function printToPdf(site, outputPath) {
  const chromePath = findChrome();

  if (!chromePath) {
    throw new Error("Could not find Chrome, Chromium, or Microsoft Edge. Set CHROME_PATH to the browser executable.");
  }

  const result = spawnSync(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${outputPath}`,
      pathToFileURL(site.htmlPath).href,
    ],
    { stdio: "pipe", encoding: "utf8", timeout: 45_000 },
  );

  if (result.error) {
    throw new Error(result.error.code === "ETIMEDOUT" ? "Chrome PDF export timed out after 45 seconds." : result.error.message);
  }

  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join("\n").trim() || "Chrome PDF export failed");
  }

  if (!hasPdfOutput(outputPath)) {
    throw new Error(`Chrome exited successfully, but no PDF was written: ${outputPath}`);
  }

  return {
    outputPath,
    bytes: statSync(outputPath).size,
  };
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function hasPdfOutput(filePath) {
  try {
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
}
