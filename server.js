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

// โฟลเดอร์คลิปสำหรับสกัดชุดข้อมูล (เฉพาะตอนพัฒนา) — เสิร์ฟที่ /clips/ ให้เป็น origin เดียวกับแอป
// ไม่งั้น canvas จะโดน taint แล้ว MediaPipe อ่านภาพไม่ได้
const CLIPS = process.env.POSEPOINT_CLIPS ? normalize(process.env.POSEPOINT_CLIPS) : null;

// ตอบแบบรองรับ Range — ถ้าไม่มี Accept-Ranges เบราว์เซอร์จะ seek วิดีโอไม่ได้ (video.seekable ว่าง)
function send(res, data, type, range) {
  const head = { "Content-Type": type, "Accept-Ranges": "bytes" };
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) {
    res.writeHead(200, { ...head, "Content-Length": data.length });
    res.end(data);
    return;
  }
  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = Math.min(m[2] ? parseInt(m[2], 10) : data.length - 1, data.length - 1);
  if (start >= data.length || start > end) {
    res.writeHead(416, { ...head, "Content-Range": `bytes */${data.length}` }).end();
    return;
  }
  res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": end - start + 1 });
  res.end(data.subarray(start, end + 1));
}

const handler = async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const root = CLIPS && p.startsWith("/clips/") ? CLIPS : ROOT;
    const rel = root === CLIPS ? p.slice("/clips".length) : p;
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) { res.writeHead(403).end("forbidden"); return; }
    send(res, await readFile(file), MIME[extname(file)] || "application/octet-stream", req.headers.range);
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
