/* เซิร์ฟเวอร์เครื่องมือติดป้ายรายครั้ง (ใช้ในเครื่อง)
 *
 * ทำไมต้องติดป้ายรายครั้ง: ชุดข้อมูลให้ป้ายระดับคลิป ทุกครั้งในคลิปจึงได้ป้ายเดียวกัน
 * ครั้งที่ทำถูกในคลิป "ท่าผิด" ถูกสอนโมเดลว่าผิด — เป็นเพดานความแม่นยำหลักของระบบ
 *
 * ออกแบบให้ติดป้ายแบบ blind: ไม่แสดงชื่อไฟล์ (มีคำว่า good/bad) ไม่แสดงป้ายเดิม/ผลโมเดล
 * สลับลำดับข้ามคลิป และแทรกรายการซ้ำ ~10% ไว้วัดความสม่ำเสมอของผู้ติดป้าย
 *
 * usage: node tools/label_server.mjs <โฟลเดอร์ชุดข้อมูล ...> [--out labels.json] [--port 5400]
 *   โฟลเดอร์ชุดข้อมูลต้องมี results/web_seqs.json (จาก extract_web.mjs รุ่นที่เก็บเวลาเฟรม)
 */
import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const OUT = opt("--out", fileURLToPath(new URL("../../pushup-counter/data/labels/rep_labels.json", import.meta.url)));
const COUNTS_OUT = opt("--counts-out", join(dirname(OUT), "rep_counts.json"));
const COUNT_PER_SET = Number(opt("--count-clips", "10"));   // คลิปต่อชุดข้อมูลที่ให้คนนับจำนวนครั้ง (เฉลยของตัวนับ)
const PORT = Number(opt("--port", "5400"));
const REPEAT_FRAC = 0.1, SEED = 7;
const ELBOW_UP = 150;                               // ต้องตรงกับ CONFIG.ELBOW_UP (จุดเริ่มท่าลง)
const DIRS = args;
if (!DIRS.length) { console.error("ระบุโฟลเดอร์ชุดข้อมูลอย่างน้อย 1 โฟลเดอร์"); process.exit(1); }

// สุ่มแบบกำหนด seed — ลำดับเดิมทุกครั้งที่เปิด ทำต่อจากที่ค้างได้
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const opaque = s => createHash("sha1").update(s).digest("hex").slice(0, 12);

// ช่วงเวลาที่ควรดู: จากจุดเริ่มท่าลง (เฟรมสุดท้ายที่ศอกยังเหยียด ก่อนถึงจุดต่ำสุด) ถึงจบครั้ง
// ครั้งแรกของคลิปมีเฟรมตั้งแต่ต้นคลิป ถ้าไม่ตัด ผู้ติดป้ายจะต้องดูช่วงนิ่ง ๆ นานเกินจำเป็น
function window(seq) {
  const bottom = seq.reduce((b, f, i) => (f.elbowAngle < seq[b].elbowAngle ? i : b), 0);
  let s = bottom;
  while (s > 0 && seq[s - 1].elbowAngle < ELBOW_UP) s--;
  s = Math.max(0, s - 1);
  return [seq[s].t, seq[seq.length - 1].t];
}

const videos = new Map();                           // url ทึบ -> พาธไฟล์จริง
const items = [];
const countItems = [];                              // คลิปที่ให้คนนับจำนวนครั้งทั้งคลิป (ใช้วัดความแม่นยำของตัวนับ)
for (const dir of DIRS) {
  const tag = basename(dir);
  const data = JSON.parse(await readFile(join(dir, "results", "web_seqs.json"), "utf8"));
  // สุ่มคลิปแบบกำหนด seed ให้มีทั้งคลาสถูกและผิดเท่า ๆ กัน
  for (const cls of ["correct", "incorrect"]) {
    const pool = shuffle(data.filter(c => c.truth === cls), rng(SEED + (cls === "correct" ? 11 : 13)));
    for (const c of pool.slice(0, Math.ceil(COUNT_PER_SET / 2))) {
      const url = "v/" + opaque(tag + "/" + c.clip) + extname(c.clip);
      countItems.push({ id: `${tag}|${c.clip}`, url });
    }
  }
  for (const clip of data) {
    const url = "v/" + opaque(tag + "/" + clip.clip) + extname(clip.clip);
    videos.set(url, join(dir, clip.clip));
    clip.reps.forEach((rep, j) => {
      if (!rep.seq?.length || rep.seq[0].t == null) return;            // ต้องเป็นข้อมูลรุ่นที่มีเวลาเฟรม
      const [t0, t1] = window(rep.seq);
      items.push({ id: `${tag}|${clip.clip}|${j}|${t0.toFixed(2)}`, url, t0, t1 });
    });
  }
}
const r = rng(SEED);
shuffle(items, r);
// รายการซ้ำสำหรับวัดความสม่ำเสมอ: แทรกไว้ช่วงหลังของงาน ห่างจากครั้งแรกพอสมควร
const reps = shuffle(items.slice(), rng(SEED + 1)).slice(0, Math.round(items.length * REPEAT_FRAC))
  .map(it => ({ ...it, id: it.id + "~repeat", repeat: true }));
for (const it of reps) items.splice(Math.floor(items.length * (0.55 + 0.45 * r())), 0, it);

shuffle(countItems, rng(SEED + 2));
let labels = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : {};
let counts = existsSync(COUNTS_OUT) ? JSON.parse(await readFile(COUNTS_OUT, "utf8")) : {};
async function saveJson(path, obj) {                // เขียนไฟล์ชั่วคราวแล้วค่อยแทนที่ — ไฟล์ไม่พังถ้าปิดกลางคัน
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + ".tmp", JSON.stringify(obj, null, 1));
  await rename(path + ".tmp", path);
}
const save = () => saveJson(OUT, labels);

const HTML = fileURLToPath(new URL("./label.html", import.meta.url));
function sendRange(req, res, buf, type) {
  const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  const head = { "Content-Type": type, "Accept-Ranges": "bytes" };
  if (!m) { res.writeHead(200, { ...head, "Content-Length": buf.length }); return res.end(buf); }
  const a = m[1] ? +m[1] : 0, b = Math.min(m[2] ? +m[2] : buf.length - 1, buf.length - 1);
  res.writeHead(206, { ...head, "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 });
  res.end(buf.subarray(a, b + 1));
}

createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://x").pathname;
    if (p === "/" || p === "/index.html") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(await readFile(HTML)); }
    if (p === "/api/items") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ items: items.map(({ id, url, t0, t1, repeat }) => ({ id, url, t0, t1, repeat: !!repeat })), labels }));
    }
    if (p === "/api/label" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      const { id, label, errors, who, at } = JSON.parse(body);
      if (!items.some(it => it.id === id) || !["good", "bad", "unsure", "notrep"].includes(label)) { res.writeHead(400); return res.end("bad label"); }
      labels[id] = { label, errors: errors || [], who, at };
      await save();
      res.writeHead(204); return res.end();
    }
    if (p === "/api/count-items") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ items: countItems, counts }));
    }
    if (p === "/api/count" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      const { id, n, who, at } = JSON.parse(body);
      if (!countItems.some(it => it.id === id) || !Number.isInteger(n) || n < 0 || n > 200) { res.writeHead(400); return res.end("bad count"); }
      counts[id] = { n, who, at };
      await saveJson(COUNTS_OUT, counts);
      res.writeHead(204); return res.end();
    }
    const file = videos.get(p.slice(1));
    if (file) return sendRange(req, res, await readFile(file), "video/mp4");
    res.writeHead(404); res.end("not found");
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
}).listen(PORT, "127.0.0.1", () => {
  const done = Object.keys(labels).filter(k => items.some(it => it.id === k)).length;
  console.log(`รายการ ${items.length} (ทวนซ้ำ ${reps.length}) · ติดป้ายแล้ว ${done} · บันทึกที่ ${OUT}`);
  console.log(`เปิด http://localhost:${PORT}/`);
});
