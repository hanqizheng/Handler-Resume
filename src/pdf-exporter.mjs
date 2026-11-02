import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildSite } from "./site-builder.mjs";

export function exportPdf({ root, output = "resume.pdf", build = true, source = process.env.RESUME_SOURCE || "index.md" } = {}) {
  if (!root) throw new Error("exportPdf requires a root directory");

  const site = build ? buildSite({ root, liveReload: false, source }) : { htmlPath: join(root, "_site", "index.html") };
  const outputPath = resolve(root, output);
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
