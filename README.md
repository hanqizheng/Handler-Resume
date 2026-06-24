# Handler Resume

A focused Markdown resume renderer. The public sample source is `index.md`; the
project builds a polished HTML preview and exports a print-ready `resume.pdf`
with Chrome's PDF engine.

There is no Jekyll, Ruby, Docker, or bundler step in the main workflow.

## Quick Start

```sh
npm run dev
```

Open the printed URL, usually:

```text
http://127.0.0.1:4000
```

Edit `index.md` for a public sample resume. The dev server rebuilds automatically and refreshes the
browser preview.

For a real private resume, keep the file out of git and point the renderer at it:

```sh
cp index.md resume.private.md
RESUME_SOURCE=resume.private.md npm run dev
```

`resume.private.md`, `*.private.md`, `private/`, and `resume.pdf` are ignored by git.

## Export PDF

From the terminal:

```sh
npm run pdf
```

For a private source:

```sh
RESUME_SOURCE=resume.private.md npm run pdf
```

From the local preview, click `Export PDF`.

The generated file is:

```text
resume.pdf
```

If Chrome is not in a standard location, set:

```sh
CHROME_PATH="/path/to/chrome" npm run pdf
```

## Resume Markdown Conventions

The renderer is intentionally resume-specific:

- `#` is the candidate name.
- The first paragraph after `#` is the headline; following paragraphs before the first `##` become compact profile metadata.
- `##` starts a resume section.
- `### Entry title \`date or meta\`` starts an entry with right-aligned metadata.
- An italic first paragraph under an entry becomes the role line.
- Bullets are compact and print-safe.
- `<div class="page-break"></div>` is supported, but should be used sparingly.

Example:

```md
## 工作经历

### **示例公司** `2023.01 - 至今`

_高级前端工程师 · 示例业务方向_

- 主导组件库建设、复杂页面治理与 AI 应用工程化落地。
```

## Commands

```sh
npm run dev      # live local preview
npm run build    # build _site/index.html
npm run pdf      # build and export resume.pdf
npm run clean    # remove generated files
```

`make dev`, `make build`, `make pdf`, and `make clean` are equivalent wrappers.

## Project Structure

```text
index.md                  resume content
media/resume.css          screen and print design
src/resume-markdown.mjs   resume-specific Markdown renderer
src/site-builder.mjs      static HTML builder
src/pdf-exporter.mjs      Chrome PDF exporter
scripts/dev.mjs           live preview server
scripts/build.mjs         build command
scripts/export-pdf.mjs    PDF command
```
