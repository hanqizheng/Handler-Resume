import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderResumeDocument } from "./resume-markdown.mjs";

export function buildSite({ root, liveReload = false } = {}) {
  if (!root) throw new Error("buildSite requires a root directory");

  const siteDir = join(root, "_site");
  const markdownPath = join(root, "index.md");
  const markdown = readFileSync(markdownPath, "utf8");
  const html = renderResumeDocument(markdown, { liveReload });

  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { recursive: true });
  writeFileSync(join(siteDir, "index.html"), html);

  const mediaDir = join(root, "media");
  if (existsSync(mediaDir)) {
    cpSync(mediaDir, join(siteDir, "media"), { recursive: true });
  }

  return {
    siteDir,
    htmlPath: join(siteDir, "index.html"),
  };
}
