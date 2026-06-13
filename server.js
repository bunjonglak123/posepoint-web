// static server ขั้นต่ำ (ไม่มี dependency) — รันบน localhost (secure context สำหรับกล้อง/MediaPipe)
import { createServer as createHttp } from "node:http";
import { createServer as createHttps } from "node:https";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".wasm": "application/wasm",
  ".css": "text/css", ".task": "application/octet-stream"
};

const handler = async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
};

const lanIp = Object.values(networkInterfaces()).flat()
  .find(n => n && n.family === "IPv4" && !n.internal)?.address || "localhost";

const useHttps = existsSync(join(ROOT, "cert.pem")) && existsSync(join(ROOT, "key.pem"));
const scheme = useHttps ? "https" : "http";
const server = useHttps
  ? createHttps({ cert: readFileSync(join(ROOT, "cert.pem")), key: readFileSync(join(ROOT, "key.pem")) }, handler)
  : createHttp(handler);

// bind 0.0.0.0 เพื่อให้มือถือใน WiFi เดียวกันเข้าได้
server.listen(PORT, "0.0.0.0", () => {
  console.log(`serving ${ROOT}`);
  console.log(`  local : ${scheme}://localhost:${PORT}`);
  console.log(`  phone : ${scheme}://${lanIp}:${PORT}   (WiFi เดียวกัน; ยอมรับ cert warning)`);
});
