import { basename } from "node:path";

export const DEFAULT_SOURCE = "index.md";

export function resolveSource(source = process.env.RESUME_SOURCE) {
  return source || DEFAULT_SOURCE;
}

/**
 * Derive the PDF file name from the Markdown source so that each variant gets its own file:
 *   index.md / resume.private.md -> resume.pdf
 *   resume.en.private.md         -> resume.en.pdf
 *   cv.md                        -> cv.pdf
 */
export function resolveOutput(source = resolveSource(), output = process.env.RESUME_OUTPUT) {
  if (output) return output;

  const name = basename(source).replace(/\.md$/i, "").replace(/\.private$/i, "");
  if (name === "index" || name === "resume") return "resume.pdf";
  return `${name}.pdf`;
}
