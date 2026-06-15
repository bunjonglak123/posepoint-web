import { initPose, detect } from "./poseService.js";
import { selectSide } from "./landmarks.js";
import { computeFeatures } from "./features.js";
import { RepCounter } from "./counter.js";
import { evaluateRep } from "./criteria.js";
import { repScore, sessionScore } from "./scoring.js";
import { rank } from "./leaderboard.js";
import { CONFIG } from "./config.js";
import { saveSession, listSessions, clearSessions } from "./store.js";
import * as auth from "./auth.js";

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx = canvas.getContext("2d");
const statusEl = $("statusText"), repEl = $("rep"), lastEl = $("last"), resultsEl = $("results"), lbEl = $("leaderboard"), resultsEmpty = $("resultsEmpty");
const statStreak = $("statStreak"), statScore = $("statScore"), statCorrect = $("statCorrect"), fpsEl = $("fps");

const DETECT_INTERVAL = 1000 / 24;   // จำกัด detection ~24fps (กัน backlog/ค้าง)
let lastDetect = 0, fpsCount = 0, fpsT = 0;

const targetRow = $("targetRow"), targetInput = $("targetInput"), targetLabel = $("targetLabel"), targetUnit = $("targetUnit");
const timerEl = $("timer"), countdownEl = $("countdown"), countNum = $("countNum");
const summaryEl = $("summary"), summaryTitle = $("summaryTitle");
const sumReps = $("sumReps"), sumCorrect = $("sumCorrect"), sumScore = $("sumScore"), sumTime = $("sumTime");
const bodyHint = $("bodyHint"), guideEl = $("guide");

const MODE_LABEL = { free: "Freestyle", reps: "Reps Goal", time: "Time Attack" };
let mode = "free", target = 20, ended = false;

function setMode(m) {
  mode = m;
  for (const [id, mm] of [["modeFree", "free"], ["modeReps", "reps"], ["modeTime", "time"]]) {
    const on = mm === m;
    $(id).classList.toggle("active", on);
    $(id).setAttribute("aria-selected", on ? "true" : "false");
  }
  if (m === "free") { targetRow.hidden = true; }
  else {
    targetRow.hidden = false;
    targetLabel.textContent = m === "reps" ? "จำนวนครั้ง" : "เวลา (วินาที)";
    targetUnit.textContent = m === "reps" ? "ครั้ง" : "วินาที";
    targetInput.value = m === "reps" ? 20 : 30;
  }
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

let soundOn = localStorage.getItem("pp_sound") !== "0";
let audioCtx = null;
function beep(freq = 660, dur = 0.08, vol = 0.15) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type = "sine"; g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* ignore */ }
}

// ปลุก AudioContext ภายใน user gesture (iOS Safari เปิดมาแบบ suspended)
function primeAudio() {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch { /* ignore */ }
}

function stopStream() {
  if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
}

let counter = null, results = [], running = false, ready = false, startMs = 0, streak = 0, facing = "environment";

function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function updateStats() {
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  statStreak.textContent = streak;
  statCorrect.textContent = `${correct}/${results.length}`;
  const sc = results.length ? Math.round(sessionScore(results)) : null;
  statScore.textContent = sc === null ? "–" : sc;
  pulse(statScore, "bump");
}

async function ensureReady() {
  if (ready) return;
  statusEl.textContent = "กำลังโหลดโมเดล MediaPipe…";
  await initPose();
  ready = true;
  statusEl.textContent = "พร้อม";
}

function resize() {
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  // ตั้ง aspect ของ stage ให้ตรงกล้อง -> ไม่มี letterbox -> overlay ตรงวิดีโอ
  if (video.videoWidth) video.parentElement.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
}

function updateBodyHint(lowerVis) {
  const full = lowerVis >= CONFIG.MIN_VISIBILITY;
  bodyHint.textContent = full ? "✓ เห็นเต็มตัว · 4 เกณฑ์" : "⚠ เห็นแค่ท่อนบน · ขยับให้เห็นขา (2 เกณฑ์)";
  bodyHint.className = "bodyhint " + (full ? "ok" : "warn");
}

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
  for (const k of pts) { const [x, y] = px(lm[k]); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
}

function processFrame(tsMs) {
  const raw = detect(video, tsMs);
  if (!raw) { drawOverlay(null); return; }
  const { landmarks } = selectSide(raw);
  // gate core joints — ไม่วาด/ไม่นับถ้า confidence ต่ำ (กันจับ background)
  const core = Math.min(landmarks.shoulder.visibility, landmarks.elbow.visibility, landmarks.wrist.visibility);
  if (core < CONFIG.MIN_VISIBILITY) { drawOverlay(null); return; }
  drawOverlay(landmarks);
  const f = computeFeatures(landmarks);
  updateBodyHint(f.lowerVis);
  const m = counter.update(f);
  if (m) {
    const res = evaluateRep(m, CONFIG);
    results.push(res);
    renderRep(res);
  }
  repEl.textContent = counter.count;
}

function renderRep(res) {
  if (resultsEmpty) resultsEmpty.style.display = "none";
  const ok = res.verdict === "CORRECT";
  streak = ok ? streak + 1 : 0;        // ต่อเนื่องถูก = streak
  pulse(repEl, "pop");
  beep(ok ? 760 : 320, 0.09);
  updateStats();
  lastEl.textContent = `#${res.index} ${res.verdict}` + (ok ? "" : ": " + res.failed.join(", "));
  lastEl.style.color = ok ? "#3fb950" : "#ff6b6b";
  const li = document.createElement("li");
  const sk = res.skipped.length ? ` (skip: ${res.skipped.join(",")})` : "";
  li.textContent = `#${res.index} ${res.verdict} — score ${repScore(res)}${res.failed.length ? " | fail: " + res.failed.join(",") : ""}${sk}`;
  li.style.color = ok ? "#3fb950" : "#ff6b6b";
  resultsEl.appendChild(li);
}

function checkEnd(now) {
  if (mode === "reps" && counter && counter.count >= target) { endWorkout("ครบเป้าหมาย! 🎯"); return true; }
  if (mode === "time") {
    const rem = target - (now - startMs) / 1000;
    timerEl.textContent = fmtTime(rem);
    if (rem <= 0) { endWorkout("หมดเวลา!"); return true; }
  }
  return false;
}

function loop() {
  if (!running) return;
  const now = performance.now();
  if (checkEnd(now)) return;
  if (video.readyState >= 2 && now - lastDetect >= DETECT_INTERVAL) {
    lastDetect = now;
    processFrame(now);
    fpsCount++;
    if (now - fpsT >= 500) {            // อัปเดต fps ทุกครึ่งวิ
      fpsEl.textContent = Math.round((fpsCount * 1000) / (now - fpsT)) + " fps";
      fpsCount = 0; fpsT = now;
    }
  }
  requestAnimationFrame(loop);
}

async function openCamera() {
  // ปิดกล้องเก่าก่อน (มือถือหลายรุ่นเปิดได้ทีละกล้อง) แล้วค่อยขอกล้องใหม่
  stopStream();
  video.removeAttribute("src");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
  video.srcObject = stream; await video.play(); resize();
}

function camActive() { return !!video.srcObject; }

function countdown() {
  return new Promise((resolve) => {
    let n = 3;
    countdownEl.hidden = false;
    const tick = () => {
      if (n > 0) { countNum.textContent = n; countNum.className = "anim"; beep(440, 0.1); }
      else if (n === 0) { countNum.textContent = "GO"; countNum.className = "go anim"; beep(880, 0.18); }
      void countNum.offsetWidth;
      if (n < 0) { countdownEl.hidden = true; resolve(); return; }
      n--; setTimeout(tick, 700);
    };
    tick();
  });
}

async function startCamera() {
  const btn = $("btnCamera");
  btn.disabled = true;
  primeAudio();              // ปลุกเสียงภายใน gesture (iOS)
  try {
    await ensureReady();
    target = Math.max(1, parseInt(targetInput.value, 10) || (mode === "reps" ? 20 : 30));
    await openCamera();
    await countdown();
    beginSession();
  } finally {
    btn.disabled = false;
  }
}

async function flipCamera() {
  facing = facing === "environment" ? "user" : "environment";
  if (!camActive()) return;                 // ยังไม่เปิดกล้อง — แค่จำค่าไว้
  const btn = $("btnFlip");
  btn.disabled = true;
  try {
    await openCamera();                     // สลับสตรีมโดยไม่รีเซ็ตการนับ
  } catch (e) {
    statusEl.textContent = "สลับกล้องไม่ได้: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

function beginSession() {
  counter = new RepCounter(CONFIG); results = []; resultsEl.innerHTML = ""; lastEl.textContent = "";
  if (resultsEmpty) resultsEmpty.style.display = "";
  repEl.textContent = "0"; streak = 0; updateStats();
  lastDetect = 0; fpsCount = 0; fpsT = performance.now(); fpsEl.textContent = "";
  ended = false; summaryEl.hidden = true;
  bodyHint.hidden = false; bodyHint.textContent = "";
  timerEl.hidden = mode !== "time";
  if (mode === "time") timerEl.textContent = fmtTime(target);
  running = true; startMs = performance.now();
  statusEl.textContent = mode === "reps" ? `เป้า ${target} ครั้ง — เริ่ม!`
    : mode === "time" ? `จับเวลา ${fmtTime(target)} — เริ่ม!` : "กำลังจับท่า…";
  loop();
}

async function endWorkout(title) {
  if (ended) return;
  ended = true; running = false; timerEl.hidden = true; bodyHint.hidden = true;
  stopStream();
  await finalize();
  showSummary(title);
}

function showSummary(title) {
  summaryTitle.textContent = title;
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  sumReps.textContent = results.length;
  sumCorrect.textContent = correct;
  sumScore.textContent = results.length ? Math.round(sessionScore(results)) : 0;
  sumTime.textContent = fmtTime((performance.now() - startMs) / 1000);
  summaryEl.hidden = false;
}

async function stopSession() {
  if (!running) return;
  await endWorkout("จบเซต");
}

async function finalize() {
  if (!results.length) { statusEl.textContent = "ไม่พบ rep"; return; }
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  const sess = {
    sessionId: crypto.randomUUID(), user: "local", mode: MODE_LABEL[mode],
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
  let entries = await listSessions();
  try {
    if (auth.isConfigured() && auth.currentUser()) entries = entries.concat(await auth.fetchLeaderboard());
  } catch { /* cloud optional */ }
  const top = rank(entries).slice(0, 10);
  lbEl.innerHTML = "<h2>อันดับ</h2>";
  if (!top.length) { lbEl.insertAdjacentHTML("beforeend", '<p class="muted-note">ยังไม่มีข้อมูล — เล่นสักเซตก่อน</p>'); return; }
  for (const s of top) {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `<span>#${s.rank} ${s.user || "local"}</span><span>${Math.round(s.avgScore)} · ${s.repsCompleted} reps</span>`;
    lbEl.appendChild(row);
  }
}

// โหมดไฟล์ (ทดสอบ/cross-check): เลือกไฟล์วิดีโอ -> ประมวลผลจนจบ
async function runFile(file) {
  await ensureReady();
  stopStream(); video.src = URL.createObjectURL(file);
  await video.play().catch(() => {}); resize(); beginSession();
  video.onended = () => endWorkout("จบคลิป");   // โชว์ summary เหมือนโหมดกล้อง
}

// expose สำหรับ headless verification
window.posepoint = {
  async runVideoUrl(url) {
    await ensureReady();
    video.srcObject = null; video.src = url; video.muted = true;
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error("โหลดวิดีโอไม่ได้ (ไม่มี sample บนเว็บโฮสต์ — ใช้กล้องหรือเลือกไฟล์แทน)")); });
    resize(); beginSession();
    await new Promise(r => { video.onended = r; video.play(); });
    running = false;
    return { reps: counter.count, results: results.map(x => ({ v: x.verdict, f: x.failed, s: x.skipped })) };
  },
  state: () => ({ ready, reps: counter ? counter.count : 0 })
};

$("btnCamera").onclick = () => startCamera().catch(e => statusEl.textContent = "Error: " + e.message);
$("btnFlip").onclick = () => flipCamera();
$("modeFree").onclick = () => setMode("free");
$("modeReps").onclick = () => setMode("reps");
$("modeTime").onclick = () => setMode("time");
$("btnAgain").onclick = () => {
  summaryEl.hidden = true;
  startCamera().catch(e => { statusEl.textContent = "Error: " + e.message; summaryEl.hidden = false; });
};
$("btnStop").onclick = () => stopSession();
$("btnSample").onclick = () => window.posepoint.runVideoUrl("sample.mp4")
  .then(r => statusEl.textContent = `sample: ${r.reps} reps`)
  .catch(e => statusEl.textContent = e.message);
$("file").onchange = (e) => { if (e.target.files[0]) runFile(e.target.files[0]); };

// ---------- camera guide ----------
$("btnGuide").onclick = () => { guideEl.hidden = false; };
$("btnGuideClose").onclick = () => { guideEl.hidden = true; localStorage.setItem("pp_guide_seen", "1"); };
if (!localStorage.getItem("pp_guide_seen")) guideEl.hidden = false;   // โชว์อัตโนมัติครั้งแรก

renderLeaderboard().catch(() => {});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// ---------- views / bottom nav ----------
const VIEWS = ["workout", "history", "leaderboard", "profile"];
function showView(name) {
  for (const v of VIEWS) {
    $("view-" + v).hidden = v !== name;
    $("nav" + v[0].toUpperCase() + v.slice(1)).classList.toggle("active", v === name);
  }
  window.scrollTo(0, 0);
  if (name === "history") renderHistory();
  if (name === "leaderboard") renderLeaderboard();
}
$("navWorkout").onclick = () => showView("workout");
$("navHistory").onclick = () => showView("history");
$("navLeaderboard").onclick = () => showView("leaderboard");
$("navProfile").onclick = () => showView("profile");

// ---------- history ----------
async function renderHistory() {
  const list = $("historyList"), empty = $("historyEmpty");
  const sessions = (await listSessions()).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  list.innerHTML = "";
  empty.style.display = sessions.length ? "none" : "";
  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const when = isNaN(d.getTime()) ? "" : d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><div class="big">${s.repsCompleted} ครั้ง</div>`
      + `<div class="meta">${s.mode} · ถูก ${s.correctCount} · ${when}</div></div>`
      + `<div class="big">${Math.round(s.avgScore)}</div>`;
    list.appendChild(el);
  }
}

// ---------- settings ----------
const setSound = $("setSound");
setSound.checked = soundOn;
setSound.onchange = () => { soundOn = setSound.checked; localStorage.setItem("pp_sound", soundOn ? "1" : "0"); if (soundOn) beep(); };
$("btnClearHistory").onclick = async () => {
  if (!confirm("ล้างประวัติทั้งหมดในเครื่อง?")) return;
  await clearSessions(); await renderHistory(); await renderLeaderboard();
};

// ---------- auth (Firebase, optional) ----------
const authErr = $("authErr"), authConfigNote = $("authConfigNote"), syncNote = $("syncNote");
function setAuthUI(user) {
  $("authSignedOut").hidden = !!user;
  $("authSignedIn").hidden = !user;
  if (user) $("authWho").textContent = user.email;
  renderLeaderboard().catch(() => {});
}
async function initAuth() {
  if (!auth.isConfigured()) {
    authConfigNote.innerHTML = "ยังไม่ได้ตั้งค่า Firebase — แอปใช้งานแบบในเครื่องได้ปกติ ใส่ค่าใน "
      + "<code>src/firebase-config.js</code> เพื่อเปิด account + cloud";
    $("btnSignIn").disabled = true; $("btnSignUp").disabled = true;
    return;
  }
  await auth.init();
  auth.onAuth(setAuthUI);
}
$("btnSignIn").onclick = async () => {
  authErr.textContent = "";
  try { await auth.signIn($("authEmail").value.trim(), $("authPass").value); }
  catch (e) { authErr.textContent = e.message; }
};
$("btnSignUp").onclick = async () => {
  authErr.textContent = "";
  try { await auth.signUp($("authEmail").value.trim(), $("authPass").value); }
  catch (e) { authErr.textContent = e.message; }
};
$("btnSignOut").onclick = () => auth.signOutUser();
$("btnSyncCloud").onclick = async () => {
  syncNote.textContent = "กำลังซิงค์…";
  try {
    const sessions = await listSessions();
    if (!sessions.length) { syncNote.textContent = "ไม่มีข้อมูลให้ซิงค์"; return; }
    const best = rank(sessions)[0];
    await auth.pushLeaderboard({ avgScore: best.avgScore, repsCompleted: best.repsCompleted });
    syncNote.textContent = "ซิงค์สำเร็จ ✓";
    renderLeaderboard().catch(() => {});
  } catch (e) { syncNote.textContent = "ซิงค์ไม่ได้: " + e.message; }
};

initAuth().catch(() => {});
