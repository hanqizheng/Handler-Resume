const SELF_CLOSING_PAGE_BREAK = /^<div\s+class=["']page-break["']\s*><\/div>$/i;

// The deliverable is always a standard A4 PDF; the HTML page is only a preview of it.
const A4 = { width: "210mm", height: "297mm", page: "A4" };

export function renderResumeDocument(markdown, options = {}) {
  const { frontMatter, body } = parseFrontMatter(markdown);
  const content = renderResumeBody(body, frontMatter);
  const title = contactValue(frontMatter.name) || contactValue(frontMatter.title) || "Resume";
  const lang = contactValue(frontMatter.lang) || detectLang(body);
  const pdfName = options.pdfName || "resume.pdf";
  const pdfHref = `/${encodeURI(pdfName)}`;

  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Resume</title>
    <link rel="stylesheet" href="media/resume.css" />
    <style>
${renderPageStyle(A4, frontMatter.style)}
    </style>
  </head>
  <body>
    <div class="app-shell">
      <main class="preview-stage" aria-label="Resume preview">
        <article class="resume-paper" data-paper>
${content}
        </article>
      </main>
      <aside class="preview-sidebar" aria-label="Resume tools">
        <div class="tool-brand">
          <p class="tool-title">Handler Resume</p>
          <p class="tool-subtitle">A4 PDF preview · <span data-pages>–</span></p>
        </div>
        <div class="tool-stack">
          <button class="tool-button" type="button" data-action="print">Print</button>
          <button class="tool-button primary" type="button" data-action="export-pdf">Export PDF</button>
          <a class="tool-button" href="${escapeAttribute(pdfHref)}" target="_blank" rel="noreferrer">Open ${escapeHtml(pdfName)}</a>
        </div>
        <p class="tool-status" data-status><strong>Ready</strong></p>
      </aside>
    </div>
    <script>
${clientScript({ liveReload: options.liveReload, pdfHref })}
    </script>
  </body>
</html>`;
}

function detectLang(text) {
  return /[\u4e00-\u9fff]/.test(text) ? "zh-CN" : "en";
}

const DEFAULT_MARGIN_Y = "8mm";
const DEFAULT_MARGIN_X = "10mm";
const SAFE_CSS_VALUE = /^[^;{}<>]+$/;
const isSafeCssValue = (value) => typeof value === "string" && SAFE_CSS_VALUE.test(value);

/**
 * Paper size, page margins and optional `style:` front matter overrides for CSS custom properties.
 * The same margins are used for the screen preview padding and the printed @page, so the
 * preview matches the PDF.
 */
function renderPageStyle(paper, overrides) {
  const style = overrides && typeof overrides === "object" ? overrides : {};
  const safe = (value, fallback) => (isSafeCssValue(value) ? value : fallback);
  const marginY = safe(style["page-margin-y"], DEFAULT_MARGIN_Y);
  const marginX = safe(style["page-margin-x"], DEFAULT_MARGIN_X);
  const vars = [
    `--paper-width: ${paper.width};`,
    `--paper-height: ${paper.height};`,
    `--page-margin-y: ${marginY};`,
    `--page-margin-x: ${marginX};`,
  ];

  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith("page-margin") || !/^[a-z][\w-]*$/i.test(key) || !isSafeCssValue(value)) continue;
    vars.push(`--${key}: ${value};`);
  }

  return `      :root { ${vars.join(" ")} }
      @page { size: ${paper.page}; margin: ${marginY} ${marginX}; }`;
}

export function parseFrontMatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontMatter: {}, body: normalized };

  return {
    frontMatter: parseSimpleYaml(match[1]),
    body: match[2],
  };
}

function parseSimpleYaml(source) {
  const data = {};
  let currentKey = null;

  for (const rawLine of source.split("\n")) {
    if (!rawLine.trim()) continue;

    const nested = rawLine.match(/^\s{2,}([\w-]+):\s*(.*)$/);
    if (nested && currentKey) {
      const container = data[currentKey];
      if (container && typeof container === "object") {
        container[nested[1]] = cleanYamlValue(nested[2]);
      }
      continue;
    }

    const topLevel = rawLine.match(/^([\w-]+):\s*(.*)$/);
    if (!topLevel) continue;

    currentKey = topLevel[1];
    data[currentKey] = topLevel[2] ? cleanYamlValue(topLevel[2]) : {};
  }

  return data;
}

function cleanYamlValue(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function renderResumeBody(markdown, data) {
  const state = {
    data,
    html: [],
    paragraph: [],
    listOpen: false,
    listItem: null,
    heroOpen: false,
    sectionOpen: false,
    entryOpen: false,
    heroParagraphCount: 0,
    heroLocationUsed: false,
    entryParagraphCount: 0,
  };

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(state);
      closeList(state);
      continue;
    }

    if (SELF_CLOSING_PAGE_BREAK.test(trimmed)) {
      flushParagraph(state);
      closeList(state);
      state.html.push('<div class="page-break"></div>');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(state);
      closeList(state);
      renderHeading(state, heading[1].length, heading[2], data);
      continue;
    }

    const listItem = line.match(/^\s*[-*+]\s+(.*)$/);
    if (listItem) {
      flushParagraph(state);
      openList(state);
      flushListItem(state);
      state.listItem = listItem[1];
      continue;
    }

    if (state.listItem !== null && /^\s+\S/.test(line)) {
      state.listItem += ` ${trimmed}`;
      continue;
    }

    state.paragraph.push(line);
  }

  flushParagraph(state);
  closeList(state);
  closeEntry(state);
  closeSection(state);
  closeHero(state);

  return state.html.join("\n");
}

function renderHeading(state, level, rawText, data) {
  if (level === 1) {
    closeEntry(state);
    closeSection(state);
    closeHero(state);
    state.heroOpen = true;
    state.heroParagraphCount = 0;
    state.html.push("          <header class=\"resume-hero\">");
    state.html.push(`            <h1>${renderInline(rawText)}</h1>`);
    const contact = renderContact(data);
    if (contact) state.html.push(contact);
    return;
  }

  if (level === 2) {
    closeEntry(state);
    closeSection(state);
    closeHero(state);
    state.sectionOpen = true;
    state.html.push("          <section class=\"resume-section\">");
    state.html.push(`            <h2>${renderInline(rawText)}</h2>`);
    return;
  }

  if (level === 3) {
    closeEntry(state);
    closeHero(state);
    if (!state.sectionOpen) {
      state.sectionOpen = true;
      state.html.push("          <section class=\"resume-section\">");
    }

    const { title, meta } = splitEntryHeading(rawText);
    state.entryOpen = true;
    state.entryParagraphCount = 0;
    state.html.push("            <article class=\"resume-entry\">");
    state.html.push("              <header class=\"entry-header\">");
    state.html.push(`                <h3>${renderInline(title)}</h3>`);
    if (meta) state.html.push(`                <span class=\"entry-meta\">${renderInline(meta)}</span>`);
    state.html.push("              </header>");
    return;
  }

  state.paragraph.push(rawText);
}

function splitEntryHeading(rawText) {
  const meta = [];
  const title = rawText
    .replace(/`([^`]+)`/g, (_, value) => {
      meta.push(value.trim());
      return "";
    })
    .trim();

  return { title, meta: meta.join(" · ") };
}

function flushParagraph(state) {
  if (!state.paragraph.length) return;
  closeList(state);

  const raw = state.paragraph.join("\n").trim();
  const className = paragraphClass(state, raw);
  const rendered = renderParagraphText(state, className, raw);
  state.html.push(`            <p class="${className}">${rendered}</p>`);
  state.paragraph = [];
}

function renderParagraphText(state, className, raw) {
  if (className === "resume-meta" && !state.heroLocationUsed) {
    const location = contactValue(state.data.location);
    state.heroLocationUsed = true;
    if (location && !raw.includes(location)) {
      return `${renderInline(location)} · ${renderInline(raw).replace(/\n/g, "<br>")}`;
    }
  }

  return renderInline(raw).replace(/\n/g, "<br>");
}

function paragraphClass(state, raw) {
  if (state.heroOpen) {
    const className = state.heroParagraphCount === 0 ? "resume-tagline" : "resume-meta";
    state.heroParagraphCount += 1;
    return className;
  }

  if (state.entryOpen) {
    const isItalicOnly = /^_[\s\S]+_$/.test(raw) || /^\*[\s\S]+\*$/.test(raw);
    const className = isItalicOnly ? "entry-role" : state.entryParagraphCount === 0 ? "entry-summary" : "entry-text";
    state.entryParagraphCount += 1;
    return className;
  }

  return "section-text";
}

function openList(state) {
  if (state.listOpen) return;
  state.html.push("            <ul>");
  state.listOpen = true;
}

function flushListItem(state) {
  if (state.listItem === null) return;
  state.html.push(`            <li>${renderInline(state.listItem)}</li>`);
  state.listItem = null;
}

function closeList(state) {
  flushListItem(state);
  if (!state.listOpen) return;
  state.html.push("            </ul>");
  state.listOpen = false;
}

function closeEntry(state) {
  closeList(state);
  if (!state.entryOpen) return;
  state.html.push("            </article>");
  state.entryOpen = false;
}

function closeSection(state) {
  closeEntry(state);
  if (!state.sectionOpen) return;
  state.html.push("          </section>");
  state.sectionOpen = false;
}

function closeHero(state) {
  if (!state.heroOpen) return;
  state.html.push("          </header>");
  state.heroOpen = false;
}

function renderContact(data) {
  const items = [
    contactLink(data.phone, (value) => `tel:${value.replace(/[^\d+]/g, "")}`),
    contactLink(data.email, (value) => `mailto:${value}`),
    contactLink(data.homepage),
    contactLink(data.github, (value) => (/^https?:/.test(value) ? value : `https://github.com/${value}`)),
    contactLink(data.linkedin),
  ].filter(Boolean);

  if (!items.length) return "";

  return `            <div class="resume-contact">${items.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

function contactLink(raw, toHref = (value) => (/^https?:/.test(value) ? value : `https://${value}`)) {
  const value = contactValue(raw);
  if (!value) return "";

  const url = (typeof raw === "object" && raw.url) || toHref(value);
  const label = value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `<a href="${escapeAttribute(url)}">${escapeHtml(label)}</a>`;
}

function contactValue(value) {
  if (!value) return "";
  if (typeof value === "object") return value.text || value.url || "";
  return String(value).trim();
}

function renderInline(text) {
  const tokens = [];
  const reserve = (html) => {
    const key = `@@TOKEN_${tokens.length}@@`;
    tokens.push([key, html]);
    return key;
  };

  let output = String(text)
    .replace(/\\([*_`[\]])/g, (_, value) => reserve(escapeHtml(value)))
    .replace(/`([^`]+)`/g, (_, code) => reserve(`<code>${escapeHtml(code)}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
      reserve(`<a href="${escapeAttribute(url)}">${renderInline(label)}</a>`),
    );

  output = escapeHtml(output)
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([\s\S]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");

  for (const [key, html] of tokens) {
    output = output.replaceAll(escapeHtml(key), html).replaceAll(key, html);
  }

  return output;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function clientScript({ liveReload, pdfHref }) {
  return `const statusEl = document.querySelector("[data-status]");
const setStatus = (html) => {
  if (statusEl) statusEl.innerHTML = html;
};

// Estimate the printed page count and draw a guide where each page ends.
const paperEl = document.querySelector("[data-paper]");
const pagesEl = document.querySelector("[data-pages]");
function measurePages() {
  if (!paperEl || !pagesEl) return;
  paperEl.querySelectorAll(".page-guide").forEach((guide) => guide.remove());
  const styles = getComputedStyle(paperEl);
  const padTop = parseFloat(styles.paddingTop);
  const padBottom = parseFloat(styles.paddingBottom);
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:var(--paper-height)";
  document.body.appendChild(probe);
  const pageHeight = probe.getBoundingClientRect().height;
  probe.remove();
  const contentPerPage = pageHeight - padTop - padBottom;
  const contentHeight = paperEl.scrollHeight - padTop - padBottom;
  const pages = Math.max(1, Math.ceil((contentHeight - 1) / contentPerPage));
  pagesEl.textContent = pages === 1 ? "1 page" : pages + " pages";
  pagesEl.classList.toggle("is-over", pages > 1);
  for (let index = 1; index < pages; index += 1) {
    const guide = document.createElement("div");
    guide.className = "page-guide";
    guide.style.top = padTop + index * contentPerPage + "px";
    guide.dataset.label = "Page " + (index + 1);
    paperEl.appendChild(guide);
  }
}
document.fonts?.ready.then(measurePages);
window.addEventListener("load", measurePages);

document.querySelector("[data-action='print']")?.addEventListener("click", () => {
  window.print();
});

document.querySelector("[data-action='export-pdf']")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  document.body.classList.add("is-busy");
  setStatus("<strong>Exporting PDF...</strong>");

  try {
    const response = await fetch("/__export-pdf", { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "PDF export failed");
    setStatus("<strong>PDF ready</strong>");
    window.open(${JSON.stringify(pdfHref)} + "?ts=" + Date.now(), "_blank", "noreferrer");
  } catch (error) {
    setStatus("<strong>PDF export unavailable</strong><br>" + error.message);
  } finally {
    button.disabled = false;
    document.body.classList.remove("is-busy");
  }
});

${liveReload ? `const events = new EventSource("/__events");
events.addEventListener("built", () => window.location.reload());
events.addEventListener("open", () => setStatus("<strong>Live preview</strong>"));
events.addEventListener("error", () => setStatus("<strong>Reconnecting...</strong>"));` : ""}`;
}
