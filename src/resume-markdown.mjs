const SELF_CLOSING_PAGE_BREAK = /^<div\s+class=["']page-break["']\s*><\/div>$/i;

export function renderResumeDocument(markdown, options = {}) {
  const { frontMatter, body } = parseFrontMatter(markdown);
  const content = renderResumeBody(body, frontMatter);
  const title = frontMatter.name || frontMatter.title || "Resume";
  const paper = frontMatter.paper || "A4";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Resume</title>
    <link rel="stylesheet" href="media/resume.css" />
  </head>
  <body>
    <div class="app-shell">
      <main class="preview-stage" aria-label="Resume preview">
        <article class="resume-paper">
${content}
        </article>
      </main>
      <aside class="preview-sidebar" aria-label="Resume tools">
        <div class="tool-brand">
          <p class="tool-title">Handler Resume</p>
          <p class="tool-subtitle">${escapeHtml(paper)} Markdown resume</p>
        </div>
        <div class="tool-stack">
          <button class="tool-button" type="button" data-action="reload">Reload</button>
          <button class="tool-button" type="button" data-action="print">Print</button>
          <button class="tool-button primary" type="button" data-action="export-pdf">Export PDF</button>
          <a class="tool-button" href="/resume.pdf" target="_blank" rel="noreferrer">Open PDF</a>
        </div>
        <p class="tool-status" data-status><strong>Ready</strong></p>
      </aside>
    </div>
    <script>
${clientScript(options.liveReload)}
    </script>
  </body>
</html>`;
}

export function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontMatter: {}, body: markdown };

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
    html: [],
    paragraph: [],
    listOpen: false,
    heroOpen: false,
    sectionOpen: false,
    entryOpen: false,
    heroParagraphCount: 0,
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

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem) {
      flushParagraph(state);
      openList(state);
      state.html.push(`            <li>${renderInline(listItem[1])}</li>`);
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

  const raw = state.paragraph.join("\n").trim();
  const rendered = renderInline(raw).replace(/\n/g, "<br>");
  const className = paragraphClass(state, raw);
  state.html.push(`            <p class="${className}">${rendered}</p>`);
  state.paragraph = [];
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

function closeList(state) {
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
    contactValue(data.location) && ["Location", contactValue(data.location)],
    contactValue(data.phone) && ["Phone", contactValue(data.phone)],
    contactValue(data.email) && ["Email", contactValue(data.email)],
    contactValue(data.homepage) && ["Web", contactValue(data.homepage)],
    contactValue(data.github) && ["GitHub", contactValue(data.github)],
    contactValue(data.linkedin) && ["LinkedIn", contactValue(data.linkedin)],
  ].filter(Boolean);

  if (!items.length) return "";

  return `            <div class="resume-contact">${items
    .map(([, value]) => `<span>${renderInline(String(value))}</span>`)
    .join("")}</div>`;
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
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

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

function clientScript(liveReload) {
  return `const statusEl = document.querySelector("[data-status]");
const setStatus = (html) => {
  if (statusEl) statusEl.innerHTML = html;
};

document.querySelector("[data-action='reload']")?.addEventListener("click", () => {
  window.location.reload();
});

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
    window.open("/resume.pdf?ts=" + Date.now(), "_blank", "noreferrer");
  } catch (error) {
    setStatus("<strong>PDF export unavailable</strong><br>" + error.message);
  } finally {
    button.disabled = false;
    document.body.classList.remove("is-busy");
  }
});

${liveReload ? `const events = new EventSource("/__events");
events.addEventListener("built", () => {
  setStatus("<strong>Updated</strong>");
  window.location.reload();
});
events.addEventListener("open", () => setStatus("<strong>Live preview</strong>"));
events.addEventListener("error", () => setStatus("<strong>Reconnecting...</strong>"));` : ""}`;
}
