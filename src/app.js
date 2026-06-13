import { initPose, detect } from "./poseService.js";
import { selectSide } from "./landmarks.js";
import { computeFeatures } from "./features.js";
import { RepCounter } from "./counter.js";
import { evaluateRep } from "./criteria.js";
import { repScore, sessionScore } from "./scoring.js";
import { rank } from "./leaderboard.js";
import { CONFIG } from "./config.js";
import { saveSession, listSessions } from "./store.js";

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx = canvas.getContext("2d");
const statusEl = $("status"), repEl = $("rep"), lastEl = $("last"), resultsEl = $("results"), lbEl = $("leaderboard");

let counter = null, results = [], running = false, ready = false, startMs = 0;

async function ensureReady() {
  if (ready) return;
  statusEl.textContent = "กำลังโหลดโมเดล MediaPipe…";
  await initPose();
  ready = true;
  statusEl.textContent = "พร้อม";
}

function resize() { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }

function drawOverlay(lm) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const pts = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];
  const px = (p) => [p.x * canvas.width, p.y * canvas.height];
  ctx.lineWidth = 3; ctx.strokeStyle = "#4ea1ff";
  const line = (a, b) => { const [x1, y1] = px(lm[a]), [x2, y2] = px(lm[b]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  line("shoulder", "elbow"); line("elbow", "wrist");
  line("shoulder", "hip"); line("hip", "knee"); line("knee", "ankle");
  ctx.fillStyle = "#7ee787";
  for (const k of pts) { const [x, y] = px(lm[k]); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
}

function processFrame(tsMs) {
  const raw = detect(video, tsMs);
  if (!raw) { drawOverlay(null); return; }
  const { landmarks } = selectSide(raw);
  // gate core joints
  const core = Math.min(landmarks.shoulder.visibility, landmarks.elbow.visibility, landmarks.wrist.visibility);
  drawOverlay(landmarks);
  if (core < CONFIG.MIN_VISIBILITY) return;
  const f = computeFeatures(landmarks);
  const m = counter.update(f);
  if (m) {
    const res = evaluateRep(m, CONFIG);
    results.push(res);
    renderRep(res);
  }
  repEl.textContent = `Reps: ${counter.count} [${counter.state}]`;
}

function renderRep(res) {
  const ok = res.verdict === "CORRECT";
  lastEl.textContent = `#${res.index} ${res.verdict}` + (ok ? "" : ": " + res.failed.join(", "));
  lastEl.style.color = ok ? "#3fb950" : "#ff6b6b";
  const li = document.createElement("li");
  const sk = res.skipped.length ? ` (skip: ${res.skipped.join(",")})` : "";
  li.textContent = `#${res.index} ${res.verdict} — score ${repScore(res)}${res.failed.length ? " | fail: " + res.failed.join(",") : ""}${sk}`;
  li.style.color = ok ? "#3fb950" : "#ff6b6b";
  resultsEl.appendChild(li);
}

function loop() {
  if (!running) return;
  if (video.readyState >= 2) processFrame(performance.now());
  requestAnimationFrame(loop);
}

async function startCamera() {
  await ensureReady();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream; await video.play(); resize();
  beginSession();
}

function beginSession() {
  counter = new RepCounter(CONFIG); results = []; resultsEl.innerHTML = ""; lastEl.textContent = "";
  running = true; startMs = performance.now(); statusEl.textContent = "กำลังจับท่า…"; loop();
}

async function stopSession() {
  running = false;
  if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
  await finalize();
}

async function finalize() {
  if (!results.length) { statusEl.textContent = "ไม่พบ rep"; return; }
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  const sess = {
    sessionId: crypto.randomUUID(), user: "local", mode: "Freestyle",
    repsCompleted: results.length, correctCount: correct,
    avgScore: Math.round(sessionScore(results) * 10) / 10,
    durationS: Math.round((performance.now() - startMs) / 1000),
    timestamp: new Date().toISOString(),
    perRep: results.map(r => ({ index: r.index, score: repScore(r), verdict: r.verdict, failed: r.failed, skipped: r.skipped }))
  };
  await saveSession(sess);
  statusEl.textContent = `จบ: ${sess.repsCompleted} reps | ถูก ${correct} | avg ${sess.avgScore}`;
  await renderLeaderboard();
}

async function renderLeaderboard() {
  const top = rank(await listSessions()).slice(0, 5);
  lbEl.innerHTML = "<b>Leaderboard</b>";
  for (const s of top) {
    const li = document.createElement("div");
    li.textContent = `#${s.rank} ${s.user} — score ${s.avgScore} | ${s.repsCompleted} reps`;
    lbEl.appendChild(li);
  }
}

// โหมดไฟล์ (ทดสอบ/cross-check): เลือกไฟล์วิดีโอ -> ประมวลผลจนจบ
async function runFile(file) {
  await ensureReady();
  video.srcObject = null; video.src = URL.createObjectURL(file);
  await video.play().catch(() => {}); resize(); beginSession();
  video.onended = () => stopSessionFileMode();
}
async function stopSessionFileMode() { running = false; await finalize(); }

// expose สำหรับ headless verification
window.posepoint = {
  async runVideoUrl(url) {
    await ensureReady();
    video.srcObject = null; video.src = url; video.muted = true;
    await new Promise(r => { video.onloadeddata = r; });
    resize(); beginSession();
    await new Promise(r => { video.onended = r; video.play(); });
    running = false;
    return { reps: counter.count, results: results.map(x => ({ v: x.verdict, f: x.failed, s: x.skipped })) };
  },
  state: () => ({ ready, reps: counter ? counter.count : 0 })
};

$("btnCamera").onclick = () => startCamera().catch(e => statusEl.textContent = "Error: " + e.message);
$("btnStop").onclick = () => stopSession();
$("btnSample").onclick = () => window.posepoint.runVideoUrl("sample.mp4").then(r => statusEl.textContent = `sample: ${r.reps} reps`);
$("file").onchange = (e) => { if (e.target.files[0]) runFile(e.target.files[0]); };

renderLeaderboard().catch(() => {});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
