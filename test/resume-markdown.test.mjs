import assert from "node:assert/strict";
import test from "node:test";
import { resolveOutput } from "../src/config.mjs";
import { parseFrontMatter, renderResumeDocument } from "../src/resume-markdown.mjs";

const render = (markdown) => renderResumeDocument(markdown);
const body = (html) => html.slice(html.indexOf("<article"), html.indexOf("</article>"));

test("front matter parses with CRLF line endings and a BOM", () => {
  const { frontMatter, body: rest } = parseFrontMatter("﻿---\r\nname: Ada\r\nstyle:\r\n  body-size: 9pt\r\n---\r\n# Ada\r\n");
  assert.equal(frontMatter.name, "Ada");
  assert.deepEqual(frontMatter.style, { "body-size": "9pt" });
  assert.equal(rest, "# Ada\n");
});

test("location is not repeated when the meta line already contains it", () => {
  const html = render("---\nlocation: 北京\n---\n# 张三\n\n工程师\n\n北京 · 本科\n");
  assert.match(html, /resume-meta">北京 · 本科</);
});

test("location is prefixed to the meta line when missing", () => {
  const html = render("---\nlocation: 北京\n---\n# 张三\n\n工程师\n\n本科\n");
  assert.match(html, /resume-meta">北京 · 本科</);
});

test("list items accept -, * and + markers and indented continuation lines", () => {
  const html = body(render("## Skills\n\n- one\n  continued\n* two\n+ three\n"));
  assert.match(html, /<li>one continued<\/li>/);
  assert.match(html, /<li>two<\/li>/);
  assert.match(html, /<li>three<\/li>/);
});

test("underscores inside words are not treated as emphasis", () => {
  const html = body(render("## A\n\nuse snake_case_name and _this_\n"));
  assert.match(html, /snake_case_name and <em>this<\/em>/);
});

test("contact fields become links", () => {
  const html = render('---\nemail: a@b.com\nphone: "+86 138 0000 0000"\nhomepage: https://ex.com/\n---\n# A\n');
  assert.match(html, /href="mailto:a@b.com">a@b.com</);
  assert.match(html, /href="tel:\+8613800000000"/);
  assert.match(html, /href="https:\/\/ex.com\/">ex.com</);
});

test("entry headings split title and backtick meta", () => {
  const html = body(render("## Work\n\n### **Acme** `2020 - 2023`\n\n_Engineer_\n\nDid things.\n"));
  assert.match(html, /<h3><strong>Acme<\/strong><\/h3>/);
  assert.match(html, /entry-meta">2020 - 2023</);
  assert.match(html, /entry-role"><em>Engineer<\/em>/);
});

test("lang is detected and can be overridden", () => {
  assert.match(render("# 张三\n"), /<html lang="zh-CN">/);
  assert.match(render("# Ada\n"), /<html lang="en">/);
  assert.match(render("---\nlang: ja\n---\n# A\n"), /<html lang="ja">/);
});

test("style overrides become CSS variables and unsafe values are dropped", () => {
  const html = render("---\nstyle:\n  body-size: 9pt\n  text: red;}</style>\n  page-margin-y: 9mm\n---\n# A\n");
  assert.match(html, /--body-size: 9pt;/);
  assert.doesNotMatch(html, /red;}/);
  assert.match(html, /@page \{ size: A4; margin: 9mm /);
});

test("PDF name is derived from the source file", () => {
  assert.equal(resolveOutput("index.md", ""), "resume.pdf");
  assert.equal(resolveOutput("resume.private.md", ""), "resume.pdf");
  assert.equal(resolveOutput("resume.en.private.md", ""), "resume.en.pdf");
  assert.equal(resolveOutput("private/cv.md", ""), "cv.pdf");
  assert.equal(resolveOutput("index.md", "out.pdf"), "out.pdf");
});
