/* แคปภาพหน้าจอแอปสำหรับเอกสาร (คู่มือ / UAT / เล่ม) จากโค้ดปัจจุบัน ด้วย demo hooks ใน app.js
 * usage: node tools/capture_shots.mjs <out_dir>
 * ภาพหน้าจอกล้องใช้ข้อมูลสาธิต (ไม่มีกล้องจริงใน headless) — ใช้ประกอบคำอธิบายเท่านั้น
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "puppeteer-core";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(APP_ROOT, "shots");
mkdirSync(OUT, { recursive: true });
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome"].find(p => existsSync(p));
const PORT = process.env.PORT || 5398;

const server = spawn(process.execPath, ["server.js"], { cwd: APP_ROOT, env: { ...process.env, PORT: String(PORT) } });
const ORIGIN = await new Promise(res => server.stdout.on("data", d => {
  const m = String(d).match(/local\s*:\s*(https?:\/\/localhost:\d+)/);
  if (m) res(m[1]);
}));
const browser = await launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--ignore-certificate-errors"] });

// [ไฟล์, hash, ตัวปรับ DOM เพิ่ม (ถ้ามี), ตัวเลือกองค์ประกอบ (แคปเฉพาะส่วน)]
const SHOTS = [
  ["m_home.png", "view=workout"],
  ["m_guide.png", "guide"],
  ["m_mode.png", "mode=reps"],
  ["m_countdown.png", "demo-countdown"],
  ["m_alert.png", "demo-alert=depth", () => {
    document.getElementById("repOk").textContent = "✓ 5";
  }],
  ["m_summary.png", "demo-summary"],
  ["m_history.png", "view=history&demo-data"],
  ["m_leaderboard.png", "view=leaderboard&demo-data"],
  ["m_profile.png", "view=profile"],
  ["m_settings.png", "view=profile", null, "#settingsTitle"],
];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => { localStorage.setItem("pp_guide_seen", "1"); localStorage.setItem("pp_lang", "th"); });
  for (const [file, hash, tweak, sel] of SHOTS) {
    await page.goto(`${ORIGIN}/index.html#${hash}`, { waitUntil: "load" });
    await page.reload({ waitUntil: "load" });      // hash อย่างเดียวไม่โหลดหน้าใหม่
    await new Promise(r => setTimeout(r, 1200));
    if (tweak) await page.evaluate(tweak);
    const path = join(OUT, file);
    if (sel) {
      await page.evaluate(() => { document.querySelector(".bottomnav").style.display = "none"; });   // เมนูล่างลอยทับการ์ด
      const card = await page.evaluateHandle(s => document.querySelector(s).closest("section, .card, div"), sel);
      await card.screenshot({ path });
    } else await page.screenshot({ path });
    console.log("saved", path);
  }
  await page.goto(`${ORIGIN}/model.html`, { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: join(OUT, "m_model.png") });
  console.log("saved", join(OUT, "m_model.png"));
} finally {
  await browser.close();
  server.kill();
}
