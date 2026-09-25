// @ts-nocheck
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CDN = "https://meet.jit.si/v1/_cdn/meetjitsi_9442.6546";
export const MEET_HOST = "meet.ffmuc.net";

function vendorDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "../vendor/jitsi"), join(here, "vendor/jitsi"), join(process.cwd(), "vendor/jitsi")];
  return candidates.find((dir) => existsSync(join(dir, "index.html"))) || candidates[0];
}

const VENDOR = vendorDir();
const read = (path) => readFileSync(join(VENDOR, path));
const LOCAL = {
  "/orbit-extension.js": { type: "application/javascript; charset=utf-8", body: read("orbit-extension.js") },
  "/images/orbit-translator.svg": { type: "image/svg+xml", body: read("images/orbit-translator.svg") },
  "/images/orbit-donate.svg": { type: "image/svg+xml", body: read("images/orbit-donate.svg") },
  "/images/watermark.svg": { type: "image/svg+xml", body: read("images/watermark.svg") },
  "/images/favicon.svg": { type: "image/svg+xml", body: read("images/favicon.svg") },
};
const cache = new Map();
const ASSET_EXT = /\.(js|mjs|css|map|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|mp3|wav|wasm|json|webmanifest)$/i;

export function passesThrough(pathname) {
  return pathname.startsWith("/__grok") || pathname.startsWith("/@") || pathname.startsWith("/src/") ||
    pathname.startsWith("/node_modules") || pathname.startsWith("/auth") || pathname.startsWith("/api");
}

export function isMeetProxyPath(pathname) {
  return pathname === "/http-bind" || pathname.startsWith("/http-bind/") || pathname === "/_unlock" ||
    pathname.startsWith("/xmpp-websocket") || pathname.startsWith("/conference-request");
}

function isCdnAsset(pathname) {
  if (LOCAL[pathname]) return false;
  return pathname.startsWith("/libs/") || pathname.startsWith("/css/") || pathname.startsWith("/images/") ||
    pathname.startsWith("/lang/") || pathname.startsWith("/sounds/") || pathname.startsWith("/fonts/") ||
    pathname.startsWith("/static/") || ASSET_EXT.test(pathname);
}

function rewriteBundle(buffer) {
  return Buffer.from(buffer.toString("utf8")
    .replaceAll("Jitsi Meet", "Orbit Meeting")
    .replaceAll("Jitsi meet", "Orbit Meeting")
    .replaceAll("Jitsi on mobile", "Orbit Meeting on mobile")
    .replaceAll("Jitsi as a Service", "Orbit Meeting")
    .replaceAll("a Jitsi link", "an Orbit Meeting link"));
}

async function fetchCdn(pathAndQuery) {
  const key = pathAndQuery.split("?")[0];
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(CDN + pathAndQuery, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) return null;
  const entry = { buffer: Buffer.from(await response.arrayBuffer()), type: response.headers.get("content-type") || "application/octet-stream" };
  cache.set(key, entry);
  return entry;
}

export async function handleJitsiRequest(urlString, method, accept) {
  const url = new URL(urlString, "http://localhost");
  const pathname = url.pathname;
  if (passesThrough(pathname) || isMeetProxyPath(pathname)) return null;

  const local = LOCAL[pathname];
  if (local && (method === "GET" || method === "HEAD")) {
    return { status: 200, headers: { "content-type": local.type, "cache-control": "no-cache" }, body: method === "HEAD" ? Buffer.alloc(0) : local.body };
  }

  if (isCdnAsset(pathname) && (method === "GET" || method === "HEAD")) {
    const asset = await fetchCdn(pathname + url.search);
    if (!asset) return null;
    const body = pathname.includes("app.bundle.min.js") ? rewriteBundle(asset.buffer) : asset.buffer;
    return { status: 200, headers: { "content-type": asset.type, "cache-control": "public, max-age=3600" }, body: method === "HEAD" ? Buffer.alloc(0) : body };
  }

  if (method === "GET" && (String(accept || "").includes("text/html") || !pathname.includes("."))) {
    return { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" }, body: read("index.html") };
  }
  return null;
}

export async function proxyMeet(method, urlString, contentType, body) {
  const url = new URL(urlString, "http://localhost");
  const response = await fetch("https://" + MEET_HOST + url.pathname + url.search, {
    method,
    headers: { "content-type": contentType || "text/xml; charset=utf-8", origin: "https://" + MEET_HOST, referer: "https://" + MEET_HOST + "/" },
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
  return {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "text/xml; charset=utf-8", "cache-control": "no-store" },
    body: Buffer.from(await response.arrayBuffer()),
  };
}
