/* สกัดชุดข้อมูลด้วย pipeline ของเว็บจริง (MediaPipe Pose Landmarker lite) แบบอัตโนมัติ
 * เปิด Chrome headless -> โหลดแอป -> เดินทีละคลิปด้วย window.posepoint.analyzeVideoUrl
 * ได้ทั้งคุณลักษณะ 26 ค่า และลำดับเฟรมรายครั้ง (สำหรับโมเดลลำดับเวลา)
 *
 * ต้องสกัดจากเว็บ ไม่ใช่ Python เพราะ MediaPipe คนละรุ่นให้ค่ามุมไม่เท่ากัน
 * โมเดลที่เทรนจากค่าฝั่ง Python จึงตัดสินเพี้ยนเมื่อนำขึ้นเว็บ
 *
 * usage: node tools/extract_web.mjs [--out <path>] [--limit N] [--fps 25]
 * ต้องตั้ง POSEPOINT_CLIPS ให้ชี้โฟลเดอร์ชุดข้อมูล (มีโฟลเดอร์ย่อยตามคลาส)
 */
import { launch } from "puppeteer-core";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));   // โฟลเดอร์ pushup-web

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const CLIPS = process.env.POSEPOINT_CLIPS;
const CLASSES = { "Correct sequence": "correct", "Wrong sequence": "incorrect" };
const PORT = process.env.PORT || 5199;
const OUT = arg("--out", join(CLIPS || ".", "results", "web_seqs.json"));
const LIMIT = Number(arg("--limit", "0"));
const FPS = Number(arg("--fps", "25"));
const PAGES = Number(arg("--pages", "3"));
const RECYCLE = Number(arg("--recycle", "4"));      // เปิดแท็บใหม่ทุกกี่คลิป (กัน renderer พังสะสม)
const RAW = args.includes("--raw");                  // เก็บผลตรวจจับดิบทุกคนทุกเฟรม (สำหรับ tools/replay.mjs)
const VIDEO_EXT = /\.(mp4|avi|mov|webm|mkv)$/i;
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(p => existsSync(p));

if (!CLIPS) { console.error("ต้องตั้ง POSEPOINT_CLIPS ให้ชี้โฟลเดอร์ชุดข้อมูล"); process.exit(1); }
if (!CHROME) { console.error("ไม่พบ Chrome ในเครื่อง"); process.exit(1); }

async function listClips() {
  const out = [];
  for (const [dir, truth] of Object.entries(CLASSES)) {
    const files = (await readdir(join(CLIPS, dir))).filter(f => VIDEO_EXT.test(f)).sort();
    for (const f of files) out.push({ truth, name: `${dir}/${f}`, url: `clips/${encodeURIComponent(dir)}/${encodeURIComponent(f)}` });
  }
  return LIMIT ? out.slice(0, LIMIT) : out;
}

let ORIGIN = `http://localhost:${PORT}`;

function startServer() {
  const proc = spawn(process.execPath, ["server.js"], {
    cwd: APP_ROOT,
    env: { ...process.env, PORT: String(PORT), POSEPOINT_CLIPS: CLIPS },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return new Promise((res, rej) => {
    proc.stdout.on("data", d => {
      const line = String(d);
      const m = line.match(/local\s*:\s*(https?:\/\/localhost:\d+)/);   // server เลือก https เองถ้ามี cert
      if (m) ORIGIN = m[1];
      if (line.includes("local")) res(proc);
    });
    proc.stderr.on("data", d => process.stderr.write(d));
    proc.on("exit", c => rej(new Error("server exited " + c)));
    setTimeout(() => res(proc), 3000);
  });
}

const clips = await listClips();
console.log(`clips=${clips.length} fps=${FPS} out=${OUT}`);
const server = await startServer();

// headless ของ Chrome ถอดรหัสวิดีโอ H.264 ไม่ได้ (ได้ภาพค้างเฟรมเดิม) -> ใช้หน้าต่างจริงแต่วางนอกจอ
const HEADLESS = process.env.EXTRACT_HEADLESS === "1";
const browser = await launch({
  executablePath: CHROME,
  headless: HEADLESS ? "new" : false,
  protocolTimeout: 3600000,       // คลิปยาวที่ตรวจหลายคนใช้เวลาหลายนาที และช้าลงอีกเมื่อรันขนาน
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required",
         "--ignore-certificate-errors",              // cert ของ localhost เป็น self-signed
         "--allow-insecure-localhost",
         // headless ไม่มี GPU จริง -> ใช้ GPU จำลองด้วย CPU (ช้า); โหมดหน้าต่างใช้ GPU ของเครื่อง (เร็วกว่ามาก)
         ...(HEADLESS ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []),
         "--enable-features=SharedArrayBuffer",
         "--window-position=-2400,0", "--window-size=900,700"]
});

try {
  const page = await browser.newPage();
  page.on("pageerror", e => console.error("  page error:", e.message));
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "load" });
  await page.waitForFunction("window.posepoint && window.posepoint.state", { timeout: 60000 });
  // ปิดโมเดล ML ระหว่างสกัด: ต้องการค่าดิบกับคำตัดสินเชิงกฎเท่านั้น (ไม่ให้โมเดลเก่ามีผลต่อผลลัพธ์)
  await page.evaluate(() => localStorage.setItem("pp_ml", "0"));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction("window.posepoint && window.posepoint.state", { timeout: 60000 });

  if (args.includes("--probe")) {
    // ตรวจว่าเบราว์เซอร์ถอดรหัสวิดีโอแล้วภาพเปลี่ยนจริงตอน seek (ไม่ใช่ค้างเฟรมแรก)
    const p = await page.evaluate(async (url) => {
      const v = document.createElement("video");
      v.src = url; v.muted = true; v.playsInline = true;
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("load fail")); });
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext("2d");
      const sums = [], times = [];
      for (let i = 0; i < 6; i++) {
        await new Promise(r => { v.onseeked = r; v.currentTime = (v.duration * i) / 6; });
        times.push(Number(v.currentTime.toFixed(2)));
        g.drawImage(v, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let s = 0; for (let k = 0; k < d.length; k += 97) s += d[k];
        sums.push(s);
      }
      return { w: v.videoWidth, h: v.videoHeight, duration: v.duration, sums, times,
               seekable: v.seekable.length ? [v.seekable.start(0), v.seekable.end(0)] : null,
               buffered: v.buffered.length ? [v.buffered.start(0), v.buffered.end(0)] : null };
    }, clips[0].url);
    console.log("probe:", JSON.stringify(p));
    await browser.close(); server.kill(); process.exit(0);
  }

  await page.close();   // ใช้แท็บที่สร้างใหม่ต่อคิวแทน (รีไซเคิลเป็นรอบ ๆ)

  async function freshPage() {
    const p = await browser.newPage();
    p.on("pageerror", e => console.error("  page error:", e.message));
    await p.goto(`${ORIGIN}/index.html`, { waitUntil: "load" });
    await p.waitForFunction("window.posepoint && window.posepoint.state", { timeout: 120000 });
    return p;
  }

  const results = new Array(clips.length);
  let next = 0, done = 0;
  const t0 = Date.now();

  // แท็บขนาน: MediaPipe หนึ่งตัวต่อแท็บ; ปิด-เปิดแท็บใหม่ทุก RECYCLE คลิป
  // เพราะรันยาว ๆ แล้ว renderer พังเอง ("detached Frame") แล้วคลิปที่เหลือล้มทั้งแถว
  await Promise.all(Array.from({ length: PAGES }, async () => {
    let pg = await freshPage(), used = 0;
    while (true) {
      const i = next++;
      if (i >= clips.length) { await pg.close().catch(() => {}); return; }
      const clip = clips[i];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await pg.evaluate(
            (url, fps, raw) => window.posepoint.analyzeVideoUrl(url, fps, { frames: true, raw }),
            clip.url, FPS, RAW);
          results[i] = {
            clip: clip.name, truth: clip.truth, duration: r.duration, stats: { ...r.stats, elbow: undefined },
            ...(RAW ? { width: r.width, height: r.height, fps: r.fps, raw: r.raw } : {}),
            reps: r.results.map(x => ({ rule: x.v, failed: x.f, feat: x.feat, seq: x.seq }))
          };
          const s = r.stats || {}, el = s.elbow || [];
          done += 1;
          const rate = (Date.now() - t0) / done / 1000;
          console.log(`[${done}/${clips.length}] ${clip.name} reps=${r.reps} usable=${s.usable}/${s.frames}` +
            (el.length ? ` elbow ${Math.min(...el)}..${Math.max(...el)}` : "") +
            ` (${rate.toFixed(1)}s/clip, เหลือ ~${Math.round(rate * (clips.length - done) / 60)} นาที)`);
          break;
        } catch (e) {
          await pg.close().catch(() => {});
          pg = await freshPage(); used = 0;               // แท็บใหม่แล้วลองซ้ำหนึ่งครั้ง
          if (attempt === 2) {
            done += 1;
            console.error(`[${done}/${clips.length}] ${clip.name} FAILED: ${e.message}`);
            results[i] = { clip: clip.name, truth: clip.truth, reps: [], error: String(e.message) };
          }
        }
      }
      if (++used >= RECYCLE) { await pg.close().catch(() => {}); pg = await freshPage(); used = 0; }
    }
  }));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(results));
  const reps = results.reduce((a, c) => a + c.reps.length, 0);
  console.log(`\nเขียน ${OUT}  คลิป=${results.length} ครั้ง=${reps} คลิปที่ไม่มีครั้ง=${results.filter(c => !c.reps.length).length}`);
} finally {
  await browser.close();
  server.kill();
}
