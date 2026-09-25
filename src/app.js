import { initPose, detect } from "./poseService.js";
import { selectSide } from "./landmarks.js";
import { pickPoseIndex, hipOf } from "./posePick.js";
import { FeatureSmoother, windowFrames } from "./smooth.js";
import { computeFeatures } from "./features.js";
import { makeCounter } from "./counter.js";
import { ReadyGate } from "./readyGate.js";
import { repScore, sessionScore } from "./scoring.js";
import { rank } from "./leaderboard.js";
import { CONFIG, APP } from "./config.js";
import { saveSession, listSessions, clearSessions } from "./store.js";
import * as auth from "./auth.js";
import { t, getLang, applyStatic, toggleLang } from "./i18n.js?v=13";
import { loadModel } from "./mlModel.js";
import { judgeRep } from "./judge.js";

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx = canvas.getContext("2d");
const statusEl = $("statusText"), repEl = $("rep"), lastEl = $("last"), resultsEl = $("results"), lbEl = $("leaderboard"), resultsEmpty = $("resultsEmpty");
const statStreak = $("statStreak"), statScore = $("statScore"), statCorrect = $("statCorrect"), fpsEl = $("fps");
const repOkEl = $("repOk");                   // ครั้งที่ท่าถูก ใต้ตัวเลขใหญ่ (ตัวเลขใหญ่ = ทุกครั้งที่วิด)

const DETECT_INTERVAL = 1000 / APP.DETECT_FPS;   // จำกัดอัตราการตรวจจับ (กัน backlog/ค้าง)
let lastDetect = 0, fpsCount = 0, fpsT = 0, lastTs = 0;
let prevHip = null;                          // สะโพกของคนที่เลือกเฟรมก่อน (ให้ติดตามคนเดิมต่อเนื่อง)
const smoother = new FeatureSmoother(windowFrames(CONFIG.SMOOTH_MS, APP.DETECT_FPS));

const targetRow = $("targetRow"), targetInput = $("targetInput"), targetLabel = $("targetLabel"), targetUnit = $("targetUnit");
const timerEl = $("timer"), countdownEl = $("countdown"), countNum = $("countNum");
const summaryEl = $("summary"), summaryTitle = $("summaryTitle");
const sumReps = $("sumReps"), sumCorrect = $("sumCorrect"), sumScore = $("sumScore"), sumTime = $("sumTime"), sumBest = $("sumBest");
const bodyHint = $("bodyHint"), guideEl = $("guide"), formAlert = $("formAlert");

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
    targetLabel.textContent = m === "reps" ? t("targetRepsLabel") : t("targetTimeLabel");
    targetUnit.textContent = m === "reps" ? t("targetRepsUnit") : t("targetTimeUnit");
    targetInput.value = m === "reps" ? APP.DEFAULT_TARGET.reps : APP.DEFAULT_TARGET.seconds;
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
  // ปลุก speechSynthesis ด้วย (iOS ต้อง speak ครั้งแรกใน gesture)
  try {
    if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
  } catch { /* ignore */ }
}

// เสียงพูดแจ้งฟอร์ม — on-device TTS ตามภาษาแอป
function speak(text) {
  if (!soundOn || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();                       // ตัดคิวเก่า กันพูดซ้อน
    const u = new SpeechSynthesisUtterance(text);
    u.lang = getLang() === "th" ? "th-TH" : "en-US";
    u.rate = 1.1;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// แบนเนอร์ใหญ่กลางจอกล้อง — เห็นจากระยะวิดพื้น ไม่ต้องเลื่อนจอ
let alertTimer = null;
function showFormAlert(text, ok) {
  formAlert.textContent = text;
  formAlert.className = "formalert " + (ok ? "good" : "bad");
  formAlert.hidden = false;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => { formAlert.hidden = true; }, ok ? APP.ALERT_MS.ok : APP.ALERT_MS.bad);
}
const ALERT_KEY = { elbow: "alertElbow", depth: "alertDepth", back: "alertBack", knee: "alertKnee", form: "alertForm" };
const VOICE_KEY = { elbow: "voiceElbow", depth: "voiceDepth", back: "voiceBack", knee: "voiceKnee", form: "voiceForm" };

// ---------- โมเดล ML ตัดสินท่า (Random Forest, รันในเบราว์เซอร์) ----------
let mlModel = null, mlError = false;
// ค่าเริ่มต้น = เกณฑ์เชิงกฎ: เมื่อวัดกับป้ายรายครั้งของคน เกณฑ์ที่ปรับแล้วแม่นกว่าโมเดล ML (ดู model.html)
// ใช้คีย์ใหม่ เพื่อให้ผู้ใช้เดิมที่เคยเปิด ML ไว้โดยค่าเริ่มต้นกลับมาใช้เกณฑ์ด้วย
let mlOn = localStorage.getItem("pp_ml2") === "1";
let collectFrames = false;                   // เปิดเฉพาะตอนสกัดชุดข้อมูล (analyzeVideoUrl) — ปกติไม่เก็บเฟรมดิบ
let detStats = null;                         // นับผลการตรวจจับระหว่างสกัด ไว้ไล่หาสาเหตุเวลาไม่ได้ rep
let extractT = null;                         // เวลาในคลิปของเฟรมที่กำลังสกัด (วินาที)
let rawFrames = null;                        // ผลตรวจจับดิบทุกเฟรม (เฉพาะโหมดสกัดดิบ)
// เก็บเฉพาะจุดที่ระบบใช้ (ไหล่ ศอก ข้อมือ สะโพก เข่า ข้อเท้า ทั้งสองข้าง) ไฟล์จะได้ไม่ใหญ่เกิน
const KEEP = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const compactPose = p => Object.fromEntries(KEEP.map(i => [i, [+p[i].x.toFixed(4), +p[i].y.toFixed(4), +(p[i].visibility ?? 1).toFixed(3)]]));
loadModel(APP.MODEL_URL)
  .then(m => { mlModel = m; })
  .catch(() => { mlError = true; })          // โหลดไม่ได้ -> ใช้เกณฑ์เชิงกฎแทน
  .finally(() => updateMlStatus());

function updateMlStatus() {
  const el = $("mlStatus");
  if (!el) return;
  el.textContent = !mlOn ? t("mlOff") : mlModel ? t("mlReady", mlModel.version) : mlError ? t("mlFallback") : t("mlLoading");
}

function stopStream() {
  if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
}

let gate = null;                             // ด่านท่าเตรียม: ยังไม่นับจนเห็นท่าบนของวิดพื้น (กันนับตอนวางมือถือ/ลงพื้น)
let counter = null, results = [], running = false, ready = false, startMs = 0, streak = 0, facing = "environment", newBestFlag = false;

function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function updateStats() {
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  statStreak.textContent = streak;
  statCorrect.textContent = `${correct}/${results.length}`;
  repOkEl.textContent = `✓ ${correct}`;
  const sc = results.length ? Math.round(sessionScore(results)) : null;
  statScore.textContent = sc === null ? "–" : sc;
  pulse(statScore, "bump");
}

async function ensureReady() {
  if (ready) return;
  statusEl.textContent = t("loadingModel");
  await initPose();
  ready = true;
  statusEl.textContent = t("ready");
}

function resize() {
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  // ตั้ง aspect ของ stage ให้ตรงกล้อง -> ไม่มี letterbox -> overlay ตรงวิดีโอ
  if (video.videoWidth) video.parentElement.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
}

function updateBodyHint(lowerVis) {
  const full = lowerVis >= CONFIG.MIN_VISIBILITY;
  bodyHint.textContent = full ? t("hintFull") : t("hintUpper");
  bodyHint.className = "bodyhint " + (full ? "ok" : "warn");
}

function drawOverlay(lm) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const pts = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];
  const px = (p) => [p.x * canvas.width, p.y * canvas.height];
  ctx.lineWidth = APP.SKELETON.lineWidth; ctx.strokeStyle = APP.SKELETON.line;
  const line = (a, b) => { const [x1, y1] = px(lm[a]), [x2, y2] = px(lm[b]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  line("shoulder", "elbow"); line("elbow", "wrist");
  line("shoulder", "hip"); line("hip", "knee"); line("knee", "ankle");
  ctx.fillStyle = APP.SKELETON.joint;
  for (const k of pts) { const [x, y] = px(lm[k]); ctx.beginPath(); ctx.arc(x, y, APP.SKELETON.jointRadius, 0, Math.PI * 2); ctx.fill(); }
}

// ยังไม่เข้าท่าเตรียม -> บอกผู้ใช้ ; เพิ่งเข้าท่า -> แจ้ง "พร้อม" แล้วเริ่มนับ
function showGetReady() {
  statusEl.dataset.waiting = "1";
  statusEl.textContent = t("getReady");
}
function onReady() {
  delete statusEl.dataset.waiting;
  showFormAlert(t("readyGo"), true);
  beep(APP.BEEP.go.freq, APP.BEEP.go.dur);
  statusEl.textContent = mode === "reps" ? t("startReps", target) : mode === "time" ? t("startTime", fmtTime(target)) : t("tracking");
}

function processFrame(tsMs, source = video) {
  // MediaPipe VIDEO mode ต้องได้ timestamp เพิ่มขึ้นเสมอ แม้สลับระหว่างวิเคราะห์ไฟล์กับกล้อง
  lastTs = Math.max(tsMs, lastTs + 1);
  const poses = detect(source, lastTs);
  if (detStats) detStats.frames += 1;
  // โหมดสกัดดิบ: เก็บผลตรวจจับของ "ทุกคน" ทุกเฟรม ไว้เล่นซ้ำออฟไลน์ (tools/replay.mjs)
  // จะได้ปรับตัวเลือกคน/ตัวกรอง/ตัวนับได้โดยไม่ต้องรันตัวตรวจจับในเบราว์เซอร์ใหม่
  if (rawFrames) rawFrames.push({ t: extractT, poses: (poses || []).map(compactPose) });
  // เห็นหลายคน -> เลือกคนที่ลำตัวแนวนอนและอยู่ใกล้คนเดิม (ไม่งั้นจะกระโดดไปนับคนที่ยืนอยู่ด้านหลัง)
  const pick = pickPoseIndex(poses, (source.videoWidth || source.width) / (source.videoHeight || source.height) || 1, prevHip, CONFIG.MIN_BODY_FLAT);
  if (pick < 0) { drawOverlay(null); if (gate) gate.miss(); return; }
  const raw = poses[pick];
  prevHip = hipOf(raw);
  if (detStats) { detStats.detected += 1; if (poses.length > 1) detStats.multi += 1; }
  const { landmarks } = selectSide(raw);
  // gate core joints — ไม่วาด/ไม่นับถ้า confidence ต่ำ (กันจับ background)
  const core = Math.min(landmarks.shoulder.visibility, landmarks.elbow.visibility, landmarks.wrist.visibility);
  if (core < CONFIG.MIN_VISIBILITY) { drawOverlay(null); if (gate) gate.miss(); return; }
  if (detStats) { detStats.usable += 1; if (detStats.elbow.length < 600) detStats.elbow.push(Math.round(computeFeatures(landmarks).elbowAngle)); }
  drawOverlay(landmarks);
  const f = smoother.push(computeFeatures(landmarks));
  if (collectFrames) {
    // โหมดสกัดชุดข้อมูลเท่านั้น: เวลาในคลิป (ใช้เปิดดูครั้งนั้นตอนติดป้าย) + พิกัดดิบ (คิดคุณลักษณะใหม่ได้โดยไม่ต้องสกัดซ้ำ)
    f.t = extractT;
    f.lm = Object.fromEntries(Object.entries(landmarks).map(([k, p]) => [k, [+p.x.toFixed(4), +p.y.toFixed(4), +p.visibility.toFixed(3)]]));
  }
  updateBodyHint(f.lowerVis);
  const wasArmed = gate.armed;
  if (!gate.push(f, counter)) {
    if (wasArmed !== gate.armed || !statusEl.dataset.waiting) showGetReady();
    return;
  }
  if (!wasArmed) onReady();
  const m = counter.update(f);
  if (m) {
    const seq = collectFrames ? m.frames : null;      // เก็บก่อน judgeRep ลบเฟรมดิบทิ้ง
    const res = judgeRep(m, CONFIG, mlModel, mlOn);
    if (seq) res.seq = seq;                           // ใช้สร้างชุดข้อมูลลำดับเวลาจาก pipeline ของเว็บ
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
  beep(...(ok ? [APP.BEEP.repOk.freq, APP.BEEP.repOk.dur] : [APP.BEEP.repBad.freq, APP.BEEP.repBad.dur]));
  // แจ้งบนจอกล้อง + เสียงพูด — คนถือถ่าย/คนวิดเห็นและได้ยินโดยไม่ต้องเลื่อนจอ
  if (ok) {
    showFormAlert(`✓ ${counter.count}`, true);
    if (APP.VOICE.countReps) speak(String(counter.count));
  } else {
    const key = res.failed[0];                       // แจ้งจุดผิดแรก (สำคัญสุด)
    showFormAlert(t(ALERT_KEY[key] || "alertDepth"), false);
    if (!APP.VOICE.mute.includes(key)) speak(t(VOICE_KEY[key] || "voiceDepth"));
  }
  updateStats();
  lastEl.textContent = `#${res.index} ${res.verdict}` + (ok ? "" : ": " + res.failed.join(", "));
  lastEl.style.color = ok ? "#3fb950" : "#ff6b6b";
  const li = document.createElement("li");
  const sk = res.skipped.length ? ` (skip: ${res.skipped.join(",")})` : "";
  // ตัดสินด้วย ML -> โชว์ความน่าจะเป็น "ท่าผิด" จากแต่ละโมเดล เช่น [RF .31 · LSTM .25 · CNN .28]
  const by = res.judge !== "ml" ? "" : " [" + Object.entries(res.members || {})
    .map(([k, p]) => `${k.toUpperCase()} ${p.toFixed(2).replace(/^0/, "")}`).join(" · ") + "]";
  li.textContent = `#${res.index} ${res.verdict}${by} — score ${repScore(res)}${res.failed.length ? " | fail: " + res.failed.join(",") : ""}${sk}`;
  li.style.color = ok ? "#3fb950" : "#ff6b6b";
  resultsEl.appendChild(li);
}

function checkEnd(now) {
  if (mode === "reps" && counter && counter.count >= target) { endWorkout(t("goalDone")); return true; }
  if (mode === "time") {
    const rem = target - (now - startMs) / 1000;
    timerEl.textContent = fmtTime(rem);
    if (rem <= 0) { endWorkout(t("timeUp")); return true; }
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
    let n = APP.COUNTDOWN_FROM;
    countdownEl.hidden = false;
    const tick = () => {
      if (n > 0) { countNum.textContent = n; countNum.className = "anim"; beep(APP.BEEP.countdown.freq, APP.BEEP.countdown.dur); }
      else if (n === 0) { countNum.textContent = "GO"; countNum.className = "go anim"; beep(APP.BEEP.go.freq, APP.BEEP.go.dur); }
      void countNum.offsetWidth;
      if (n < 0) { countdownEl.hidden = true; resolve(); return; }
      n--; setTimeout(tick, APP.COUNTDOWN_STEP_MS);
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
    target = Math.max(1, parseInt(targetInput.value, 10) || (mode === "reps" ? APP.DEFAULT_TARGET.reps : APP.DEFAULT_TARGET.seconds));
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
    statusEl.textContent = t("flipFail") + e.message;
  } finally {
    btn.disabled = false;
  }
}

function beginSession() {
  counter = makeCounter(CONFIG); gate = new ReadyGate(CONFIG, APP.DETECT_FPS); results = []; prevHip = null; smoother.setWindow(windowFrames(CONFIG.SMOOTH_MS, APP.DETECT_FPS)); resultsEl.innerHTML = ""; lastEl.textContent = "";
  if (resultsEmpty) resultsEmpty.style.display = "";
  repEl.textContent = "0"; streak = 0; updateStats();
  lastDetect = 0; fpsCount = 0; fpsT = performance.now(); fpsEl.textContent = "";
  ended = false; summaryEl.hidden = true;
  bodyHint.hidden = false; bodyHint.textContent = "";
  formAlert.hidden = true;
  timerEl.hidden = mode !== "time";
  if (mode === "time") timerEl.textContent = fmtTime(target);
  running = true; startMs = performance.now();
  showGetReady();
  loop();
}

async function endWorkout(title) {
  if (ended) return;
  ended = true; running = false; timerEl.hidden = true; bodyHint.hidden = true; formAlert.hidden = true;
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
  sumBest.hidden = !newBestFlag;                       // ป้ายสถิติใหม่ (คำนวณใน finalize)
  sumBest.textContent = t("newBest");
  summaryEl.hidden = false;
}

// แชร์ผล: Web Share API (มือถือ) -> fallback คัดลอกลง clipboard
async function shareResult() {
  const text = t("shareText", sumReps.textContent, sumCorrect.textContent, sumScore.textContent, sumTime.textContent);
  const btn = $("btnShareLabel");
  try {
    if (navigator.share) { await navigator.share({ title: "PosePoint", text }); return; }
    await navigator.clipboard.writeText(text);
    const prev = btn.textContent; btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = prev; }, 1500);
  } catch { /* user ยกเลิก share = ไม่ทำอะไร */ }
}

async function stopSession() {
  if (!running) return;
  await endWorkout(t("setDone"));
}

async function finalize() {
  if (!results.length) { newBestFlag = false; statusEl.textContent = t("noReps"); return; }
  const correct = results.filter(r => r.verdict === "CORRECT").length;
  const sess = {
    sessionId: crypto.randomUUID(), user: "local", mode: MODE_LABEL[mode],
    repsCompleted: results.length, correctCount: correct,
    avgScore: Math.round(sessionScore(results) * 10) / 10,
    durationS: Math.round((performance.now() - startMs) / 1000),
    timestamp: new Date().toISOString(),
    judge: results.some(r => r.judge === "ml") ? "ml" : "rule",
    modelVersion: mlModel && mlOn ? mlModel.version : null,
    perRep: results.map(r => ({
      index: r.index, score: repScore(r), verdict: r.verdict, failed: r.failed, skipped: r.skipped,
      judge: r.judge, ...(r.judge === "ml" ? { pIncorrect: +r.pIncorrect.toFixed(APP.PROB_DECIMALS), ruleFailed: r.ruleFailed,
        members: Object.fromEntries(Object.entries(r.members || {}).map(([k, p]) => [k, +p.toFixed(APP.PROB_DECIMALS)])) } : {})
    }))
  };
  // สถิติใหม่? เทียบคะแนนกับเซสชันเดิม "ก่อน" บันทึกอันนี้
  try {
    const prevBest = Math.max(0, ...(await listSessions()).map(s => +s.avgScore || 0));
    newBestFlag = sess.avgScore > prevBest;
  } catch { newBestFlag = false; }
  await saveSession(sess);
  statusEl.textContent = t("finalized", sess.repsCompleted, correct, sess.avgScore);
  await renderLeaderboard();
}

async function renderLeaderboard() {
  let entries = await listSessions();
  try {
    if (auth.isConfigured() && auth.currentUser()) entries = entries.concat(await auth.fetchLeaderboard());
  } catch { /* cloud optional */ }
  const top = rank(entries).slice(0, APP.LEADERBOARD_SIZE);
  lbEl.innerHTML = `<h2>${t("lbTitle")}</h2>`;
  if (!top.length) { lbEl.insertAdjacentHTML("beforeend", `<p class="muted-note">${t("lbEmpty")}</p>`); return; }
  for (const s of top) {
    const row = document.createElement("div");
    row.className = "lb-row";
    // textContent ทั้งหมด: กัน stored XSS จาก cloud doc ที่ผู้ใช้เขียนเองได้ (user/reps)
    const who = document.createElement("span");
    who.textContent = `#${s.rank} ${maskUser(s.user)}`;
    const stat = document.createElement("span");
    stat.textContent = `${Math.round(+s.avgScore) || 0} · ${Math.max(0, Math.trunc(+s.repsCompleted) || 0)} reps`;
    row.append(who, stat);
    lbEl.appendChild(row);
  }
}

// โชว์เฉพาะส่วนหน้า @ บน leaderboard สาธารณะ (ไม่รั่วอีเมลเต็ม)
function maskUser(u) {
  if (!u || u === "local") return "local";
  const at = String(u).indexOf("@");
  return at > 0 ? String(u).slice(0, at) : String(u);
}

// โหมดไฟล์ (ทดสอบ/cross-check): เลือกไฟล์วิดีโอ -> ประมวลผลจนจบ
async function runFile(file) {
  await ensureReady();
  stopStream(); video.src = URL.createObjectURL(file);
  await video.play().catch(() => {}); resize(); beginSession();
  video.onended = () => endWorkout(t("clipDone"));   // โชว์ summary เหมือนโหมดกล้อง
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
    return { reps: counter.count, results: results.map(x => ({ v: x.verdict, f: x.failed, s: x.skipped, j: x.judge, score: repScore(x), p: x.pIncorrect })) };
  },
  // วิเคราะห์ทีละเฟรมด้วยการ seek (ไม่พึ่ง requestAnimationFrame) — ใช้วัดผลฝั่งเว็บ/ตรวจในเบราว์เซอร์ที่ไม่ render
  async analyzeVideoUrl(url, fps = APP.ANALYZE_FPS, opts = {}) {
    collectFrames = !!opts.frames;       // opts.frames = true -> คืนลำดับเฟรมรายครั้งด้วย (สำหรับเทรนโมเดลลำดับเวลา)
    rawFrames = opts.raw ? [] : null;    // opts.raw = true -> คืนผลตรวจจับดิบทุกคนทุกเฟรม (เล่นซ้ำออฟไลน์)
    detStats = { frames: 0, detected: 0, usable: 0, multi: 0, elbow: [] };
    await ensureReady();
    stopStream(); video.src = url; video.muted = true;
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error("โหลดวิดีโอไม่ได้")); });
    resize(); beginSession(); running = false;          // หยุด loop อัตโนมัติ แล้วเดินเฟรมเอง
    smoother.setWindow(windowFrames(CONFIG.SMOOTH_MS, fps));   // หน้าต่างตาม fps ที่เดินเฟรมจริง
    gate = new ReadyGate(CONFIG, fps);                         // ด่านท่าเตรียมนับเวลาตาม fps ของคลิป
    const step = 1 / fps;
    // คัดลอกเฟรมลง canvas ก่อนตรวจจับ: ได้ภาพจริงแม้เบราว์เซอร์ไม่ได้ render วิดีโอบนจอ
    const frame = document.createElement("canvas");
    frame.width = video.videoWidth; frame.height = video.videoHeight;
    const fctx = frame.getContext("2d");
    for (let i = 0; i * step < video.duration; i++) {
      await new Promise(r => { video.onseeked = r; video.currentTime = i * step; });
      fctx.drawImage(video, 0, 0, frame.width, frame.height);
      extractT = +(i * step).toFixed(3);                 // เวลาของเฟรมนี้ในคลิป (วินาที)
      processFrame(lastTs + 1000 / fps, frame);          // เดินเวลาตามเฟรมของวิดีโอ (processFrame กันย้อนเวลาให้)
    }
    const out = { reps: counter.count, stats: detStats, duration: video.duration, width: video.videoWidth, height: video.videoHeight, fps,
                  raw: rawFrames,
                  results: results.map(x => ({ v: x.verdict, f: x.failed, s: x.skipped, j: x.judge, score: repScore(x), p: x.pIncorrect, m: x.members, rule: x.ruleFailed, feat: x.features, seq: x.seq })) };
    collectFrames = false; detStats = null; rawFrames = null;
    return out;
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
$("btnShare").onclick = () => shareResult();
$("btnSample").onclick = () => window.posepoint.runVideoUrl("sample.mp4")
  .then(r => statusEl.textContent = `sample: ${r.reps} reps`)
  .catch(e => statusEl.textContent = e.message);
$("file").onchange = (e) => { if (e.target.files[0]) runFile(e.target.files[0]); };

// ---------- language toggle ----------
applyStatic();                                       // ใช้ภาษาที่จำไว้ตอนโหลด
if (getLang() !== "th") statusEl.textContent = t("readyIdle");   // status เริ่มต้นใน HTML เป็นไทย
function refreshLangUI() {
  applyStatic();
  // อัปเดต label เป้าหมายโดยไม่รีเซ็ตค่าที่ผู้ใช้พิมพ์
  if (mode !== "free") {
    targetLabel.textContent = mode === "reps" ? t("targetRepsLabel") : t("targetTimeLabel");
    targetUnit.textContent = mode === "reps" ? t("targetRepsUnit") : t("targetTimeUnit");
  }
  if (!running && !camActive()) statusEl.textContent = t("readyIdle");
  if (!auth.isConfigured()) authConfigNote.innerHTML = t("noFirebase");
  updateMlStatus();
  renderLeaderboard().catch(() => {});
  if (!$("view-history").hidden) renderHistory();
}
$("btnLang").onclick = () => { toggleLang(); refreshLangUI(); };

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
    const when = isNaN(d.getTime()) ? "" : d.toLocaleString(getLang() === "th" ? "th-TH" : "en-GB", { dateStyle: "short", timeStyle: "short" });
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><div class="big">${s.repsCompleted} ${t("reps")}</div>`
      + `<div class="meta">${s.mode} · ${t("correctWord")} ${s.correctCount} · ${when}</div></div>`
      + `<div class="big">${Math.round(s.avgScore)}</div>`;
    list.appendChild(el);
  }
}

// ---------- settings ----------
const setSound = $("setSound");
setSound.checked = soundOn;
setSound.onchange = () => { soundOn = setSound.checked; localStorage.setItem("pp_sound", soundOn ? "1" : "0"); if (soundOn) beep(); };
const setMl = $("setMl");
setMl.checked = mlOn;
setMl.onchange = () => { mlOn = setMl.checked; localStorage.setItem("pp_ml2", mlOn ? "1" : "0"); updateMlStatus(); };
updateMlStatus();
$("btnClearHistory").onclick = async () => {
  if (!confirm(t("confirmClear"))) return;
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
    authConfigNote.innerHTML = t("noFirebase");
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
  syncNote.textContent = t("syncing");
  try {
    const sessions = await listSessions();
    if (!sessions.length) { syncNote.textContent = t("syncNone"); return; }
    const best = rank(sessions)[0];
    await auth.pushLeaderboard({ avgScore: best.avgScore, repsCompleted: best.repsCompleted });
    syncNote.textContent = t("syncOk");
    renderLeaderboard().catch(() => {});
  } catch (e) { syncNote.textContent = t("syncFail") + e.message; }
};

initAuth().catch(() => {});

// ---------- screenshot/demo hooks (ใช้ตอนแคปภาพประกอบเอกสาร) ----------
// #view=history|leaderboard|profile  #guide  #demo-summary  #demo-alert=back
{
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("view")) showView(h.get("view"));
  if (h.has("guide")) guideEl.hidden = false;
  else if (!localStorage.getItem("pp_guide_seen") && h.toString()) guideEl.hidden = true;
  if (h.has("demo-summary")) {
    summaryTitle.textContent = t("setDone");
    sumReps.textContent = "12"; sumCorrect.textContent = "10";
    sumScore.textContent = "86"; sumTime.textContent = "58s";
    summaryEl.hidden = false; guideEl.hidden = true;
  }
  if (h.get("demo-alert")) {
    const k = h.get("demo-alert");
    showFormAlert(t(ALERT_KEY[k] || "alertBack"), false);
    clearTimeout(alertTimer); guideEl.hidden = true;
    repEl.textContent = "7";
  }
  if (h.get("mode")) setMode(h.get("mode"));
  if (h.has("demo-countdown")) { countdownEl.hidden = false; countNum.textContent = "2"; guideEl.hidden = true; }
  if (h.get("scroll")) setTimeout(() => window.scrollTo(0, +h.get("scroll")), 700);
  if (h.has("demo-data")) setTimeout(() => {       // DOM อย่างเดียว ไม่แตะ IndexedDB
    const rows = [[12, 10, 86, "Freestyle"], [20, 17, 82, "Reps Goal"], [15, 11, 74, "Time Attack"]];
    const hl = $("historyList");
    if (hl) {
      $("historyEmpty").style.display = "none"; hl.innerHTML = "";
      for (const [r, c, s, m] of rows) hl.insertAdjacentHTML("beforeend",
        `<div class="history-item"><div><div class="big">${r} ${t("reps")}</div>`
        + `<div class="meta">${m} · ${t("correctWord")} ${c} · 17/7/2569 20:1${r % 10}</div></div>`
        + `<div class="big">${s}</div></div>`);
    }
    lbEl.innerHTML = `<h2>${t("lbTitle")}</h2>`;
    rows.forEach(([r, , s], i) => lbEl.insertAdjacentHTML("beforeend",
      `<div class="lb-row"><span>#${i + 1} local</span><span>${s} · ${r} reps</span></div>`));
  }, 600);
}
