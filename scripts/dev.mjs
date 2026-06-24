#!/usr/bin/env node

import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/site-builder.mjs";
import { exportPdf } from "../src/pdf-exporter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = join(root, "_site");
const host = process.env.HOST || "127.0.0.1";
const preferredPort = Number(process.env.PORT || 4000);
const clients = new Set();

let currentPort = preferredPort;

build();
watchSources();
startServer(preferredPort);

function startServer(port) {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);

    if (requestUrl.pathname === "/__events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write("event: open\ndata: ok\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    if (requestUrl.pathname === "/__export-pdf" && request.method === "POST") {
      try {
        const pdf = exportPdf({ root });
        build();
        broadcast("built");
        json(response, 200, { ok: true, outputPath: pdf.outputPath, bytes: pdf.bytes });
      } catch (error) {
        json(response, 500, { ok: false, error: error.message });
      }
      return;
    }

    serveStatic(requestUrl, response);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT) {
      startServer(port + 1);
      return;
    }

    console.error(`Could not start preview server on ${host}:${port}: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    currentPort = port;
    console.log(`Resume preview: http://${host}:${currentPort}`);
  });
}

function serveStatic(requestUrl, response) {
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidateRoots = [siteDir, root];

  for (const base of candidateRoots) {
    const filePath = resolve(base, normalize(relativePath));
    if (!filePath.startsWith(base) || !existsSync(filePath) || statSync(filePath).isDirectory()) continue;

    response.writeHead(200, { "Content-Type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function build() {
  try {
    const result = buildSite({ root, liveReload: true });
    console.log(`Built ${result.htmlPath}`);
  } catch (error) {
    console.error(error);
  }
}

function watchSources() {
  const targets = ["index.md", "src", "media"].map((name) => join(root, name));
  let timer;

  for (const target of targets) {
    if (!existsSync(target)) continue;

    watch(target, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        build();
        broadcast("built");
      }, 120);
    });
  }
}

function broadcast(eventName) {
  for (const client of clients) {
    client.write(`event: ${eventName}\ndata: ${Date.now()}\n\n`);
  }
}

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[extname(filePath)] || "application/octet-stream";
}
