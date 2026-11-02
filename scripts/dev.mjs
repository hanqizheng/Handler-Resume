#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveOutput, resolveSource } from "../src/config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = join(root, "_site");
const host = process.env.HOST || "127.0.0.1";
const preferredPort = Number(process.env.PORT || 4000);
const source = resolveSource();
const output = resolveOutput(source);
const childEnv = { ...process.env, RESUME_SOURCE: source, RESUME_OUTPUT: output };
const clients = new Set();
const watchers = [];
const pollers = [];

let currentPort = preferredPort;

if (!build()) process.exit(1);
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
      // Export in a child process so that edits under src/ are always picked up.
      const child = spawn(process.execPath, [join(root, "scripts/export-pdf.mjs")], { cwd: root, env: childEnv });
      let log = "";
      child.stdout.on("data", (chunk) => (log += chunk));
      child.stderr.on("data", (chunk) => (log += chunk));
      child.on("close", (code) => {
        if (code === 0) json(response, 200, { ok: true, output, log: log.trim() });
        else json(response, 500, { ok: false, error: log.trim() || `PDF export exited with ${code}` });
      });
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

// Only the built site and the exported PDF are served; never the project root (private sources, .git).
function serveStatic(requestUrl, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    pathname = "";
  }

  const filePath =
    pathname === `/${output}` ? join(root, output) : resolve(siteDir, `.${pathname === "/" ? "/index.html" : pathname}`);
  const allowed = filePath === join(root, output) || filePath.startsWith(siteDir + sep);

  if (!allowed || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(response);
}

// Build in a child process so that renderer changes under src/ apply without restarting the server.
function build() {
  const result = spawnSync(process.execPath, [join(root, "scripts/build.mjs")], {
    cwd: root,
    env: { ...childEnv, RESUME_LIVE_RELOAD: "1" },
    encoding: "utf8",
  });

  if (result.status === 0) {
    console.log(result.stdout.trim());
    return true;
  }

  console.error(result.stderr.trim() || result.stdout.trim());
  return false;
}

function watchSources() {
  const targets = [source, "src", "media"].map((name) => resolve(root, name));
  let timer;
  const rebuildSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (build()) broadcast("built");
    }, 120);
  };

  for (const target of targets) {
    if (!existsSync(target)) continue;

    try {
      const stats = statSync(target);
      const watcher = watch(target, stats.isDirectory() ? { recursive: true } : {}, rebuildSoon);

      watcher.on("error", (error) => {
        console.warn(`File watcher failed for ${target}: ${error.message}`);
        watcher.close();
        startPolling(target, rebuildSoon);
      });

      watchers.push(watcher);
    } catch (error) {
      console.warn(`Could not watch ${target}: ${error.message}`);
      startPolling(target, rebuildSoon);
    }
  }
}

function startPolling(target, onChange) {
  let previous = snapshotTarget(target);
  const interval = setInterval(() => {
    const next = snapshotTarget(target);
    if (!snapshotsEqual(previous, next)) {
      previous = next;
      onChange();
    }
  }, 800);

  pollers.push(interval);
}

function snapshotTarget(target) {
  const snapshot = new Map();
  collectSnapshot(target, snapshot);
  return snapshot;
}

function collectSnapshot(target, snapshot) {
  try {
    const stats = statSync(target);
    snapshot.set(target, `${stats.mtimeMs}:${stats.size}`);

    if (!stats.isDirectory()) return;

    for (const entry of readdirSync(target)) {
      collectSnapshot(join(target, entry), snapshot);
    }
  } catch {
    snapshot.set(target, "missing");
  }
}

function snapshotsEqual(left, right) {
  if (left.size !== right.size) return false;

  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }

  return true;
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
