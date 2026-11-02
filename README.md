# Handler Resume

A focused Markdown resume renderer. You write the resume in Markdown, and the project exports a
**standard A4 PDF** with Chrome's PDF engine. The PDF is the deliverable. The local web page is only
a live preview of that PDF, and it uses the same page size and margins.

No dependencies: Node.js 20+ and a Chrome / Chromium / Edge install are all you need.

## Quick Start

```sh
npm run dev
```

Open the printed URL, usually `http://127.0.0.1:4000`. The sidebar shows how many A4 pages the
resume will print to, and a red dashed line marks each page break.

`index.md` is a public sample. Keep your real resume in a private file:

```sh
cp index.md resume.private.md
npm run dev:private          # Chinese / main resume
npm run dev:private:en       # resume.en.private.md
```

## Keeping personal data out of git

- Real content lives only in `*.private.md` files (or under `private/`). They are ignored by git,
  together with every `resume*.pdf`, `_site/`, and `tmp/`.
- `RESUME_SOURCE` picks which Markdown file is rendered. It defaults to `index.md`.
- The preview server only serves the built page and the exported PDF. It never serves the project
  directory, so private sources and `.git` aren't reachable over HTTP.

Before committing, `git status` should never list a private file.

## Export PDF

```sh
npm run pdf                  # index.md             -> resume.pdf
npm run pdf:private          # resume.private.md    -> resume.pdf
npm run pdf:private:en       # resume.en.private.md -> resume.en.pdf
```

You can also click **Export PDF** in the preview. The output name comes from the source file name.
Set `RESUME_OUTPUT=path.pdf` to override it, and `CHROME_PATH=/path/to/chrome` if Chrome isn't in
a standard location.

## Resume Markdown Conventions

```md
---
name: 张三
location: 北京            # added to the meta line unless it already contains it
phone: "+86 138 0000 0000"
email: name@example.com
homepage: example.com
github: username
lang: zh-CN               # optional; detected from the content by default
style:                    # optional; override any CSS variable from media/resume.css
  body-size: 8.7pt
  page-margin-y: 9mm
---

# 张三

高级前端工程师 | 7 年经验          <- headline (first paragraph after the name)

北京 · 本科 · 计算机科学与技术      <- meta line(s)

## 工作经历                         <- section

### **示例公司** `2023.01 - 至今`    <- entry; backtick text is right-aligned meta

_高级前端工程师 · 示例业务方向_      <- role line (an italic paragraph)

- 主导组件库建设与 AI 应用工程化落地。
  Indented lines continue the same bullet.
```

- Bullets may use `-`, `*`, or `+`.
- `<div class="page-break"></div>` forces a page break. Use it sparingly.

### Fitting the page

When the preview reports one page too many, trim the content first. If it's only a line or two
over, tighten the density in the front matter instead of editing the CSS:

```yaml
style:
  body-size: 8.7pt       # default 8.8pt
  body-leading: 1.32     # default 1.35
  section-gap: 2.4mm     # default 2.8mm
  page-margin-y: 7mm     # default 8mm (top/bottom)
  page-margin-x: 9mm     # default 10mm (left/right)
```

## Commands

```sh
npm run dev | dev:private | dev:private:en    # live preview
npm run pdf | pdf:private | pdf:private:en    # export PDF
npm run build                                 # build _site/index.html only
npm test                                      # renderer tests
npm run clean                                 # remove generated files
```

`make dev`, `make private`, `make pdf-private`, and the other `make` targets are equivalent
wrappers.

## Project Structure

```text
index.md                  public sample resume
media/resume.css          A4 print design + preview shell
src/resume-markdown.mjs   resume-specific Markdown renderer
src/site-builder.mjs      static HTML builder
src/pdf-exporter.mjs      Chrome PDF exporter (builds in a temp dir)
src/config.mjs            source / output file resolution
scripts/dev.mjs           live preview server
scripts/build.mjs         build command
scripts/export-pdf.mjs    PDF command
test/                     node:test suite
```
