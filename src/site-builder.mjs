import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { resolveOutput, resolveSource } from "./config.mjs";
import { renderResumeDocument } from "./resume-markdown.mjs";

export function buildSite({
  root,
  liveReload = false,
  source = resolveSource(),
  output = resolveOutput(source),
  outDir = join(root ?? "", "_site"),
} = {}) {
  if (!root) throw new Error("buildSite requires a root directory");

  const siteDir = outDir;
  const markdownPath = resolve(root, source);

  if (!existsSync(markdownPath)) {
    const hint = source === "index.md" ? "" : `\nCreate it from the sample first:  cp index.md ${relative(root, markdownPath)}`;
    throw new Error(`Resume source not found: ${markdownPath}${hint}`);
  }

  const markdown = readFileSync(markdownPath, "utf8");
  const html = renderResumeDocument(markdown, { liveReload, pdfName: output });

  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { recursive: true });
  writeFileSync(join(siteDir, "index.html"), html);
  cpSync(join(root, "media"), join(siteDir, "media"), { recursive: true });

  return {
    siteDir,
    htmlPath: join(siteDir, "index.html"),
    markdownPath,
  };
}
