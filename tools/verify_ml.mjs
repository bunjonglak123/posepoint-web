/* ตรวจโมเดลรวมในเบราว์เซอร์จริง: เปิดแอป (เปิด ML) -> วิเคราะห์คลิป -> ดูว่าทุกครั้งตัดสินด้วยสามโมเดล
 * และจับภาพหน้า model.html ที่ความกว้างมือถือ
 * usage: POSEPOINT_CLIPS=<โฟลเดอร์ชุดข้อมูล> node tools/verify_ml.mjs <คลิป...> [--shot out.png]
 *        คลิประบุเป็นพาธใต้ POSEPOINT_CLIPS เช่น "Correct sequence/subject_001_push_up_good_side.mp4"
 */
import { launch } from "puppeteer-core";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = process.env.PORT || 5399;
const args = process.argv.slice(2);
const shotAt = args.indexOf("--shot");
const SHOT = shotAt >= 0 ? args.splice(shotAt, 2)[1] : null;
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => existsSync(p));

const server = spawn(process.execPath, ["server.js"], { cwd: APP_ROOT, env: { ...process.env, PORT: String(PORT) } });
const ORIGIN = await new Promise(res => server.stdout.on("data", d => {
  const m = String(d).match(/local\s*:\s*(https?:\/\/localhost:\d+)/);
  if (m) res(m[1]);
}));
const browser = await launch({ executablePath: CHROME, headless: "new", protocolTimeout: 600000,
  args: ["--no-sandbox", "--ignore-certificate-errors", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.setItem("pp_ml2", "1"));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => /RF \+ LSTM \+ CNN/.test(document.getElementById("mlStatus")?.textContent || ""), { timeout: 60000 });
  console.log("สถานะโมเดล:", await page.$eval("#mlStatus", e => e.textContent));

  for (const clip of args) {
    const url = "clips/" + clip.split("/").map(encodeURIComponent).join("/");
    const t0 = Date.now();
    const r = await page.evaluate(u => window.posepoint.analyzeVideoUrl(u, 15), url);
    console.log(`\n${clip}  reps=${r.reps}  (${((Date.now() - t0) / 1000).toFixed(0)} วิ)`);
    for (const x of r.results) {
      const m = x.m ? Object.entries(x.m).map(([k, p]) => `${k}=${p.toFixed(3)}`).join(" ") : "-";
      console.log(`  ${x.j.padEnd(4)} ${x.v.padEnd(9)} p=${x.p?.toFixed(3) ?? "-"}  ${m}`);
    }
  }
  const rows = await page.$$eval("#results li", li => li.slice(0, 3).map(e => e.textContent));
  console.log("\nแถวบนหน้าจอ:", rows);

  if (SHOT) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto(`${ORIGIN}/model.html`, { waitUntil: "networkidle0" });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log("model.html ล้นแนวนอน:", over, "px");
    await page.screenshot({ path: SHOT, fullPage: true });
    console.log("ภาพหน้า:", SHOT);
  }
  console.log("page errors:", errors.length ? errors : "ไม่มี");
} finally {
  await browser.close();
  server.kill();
}
