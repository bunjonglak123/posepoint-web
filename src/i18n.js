// i18n — TH/EN ทั้งแอป. static UI ใช้ selector map, dynamic string ใช้ t(key)
const STR = {
  th: {
    // dynamic
    loadingModel: "กำลังโหลดโมเดล MediaPipe…",
    ready: "พร้อม",
    readyIdle: "พร้อมใช้งาน — กดเริ่มกล้องหรือเลือกไฟล์",
    startReps: (n) => `เป้า ${n} ครั้ง — เริ่ม!`,
    startTime: (t) => `จับเวลา ${t} — เริ่ม!`,
    tracking: "กำลังจับท่า…",
    goalDone: "ครบเป้าหมาย! 🎯",
    timeUp: "หมดเวลา!",
    setDone: "จบเซต",
    clipDone: "จบคลิป",
    noReps: "ไม่พบ rep",
    finalized: (r, c, a) => `จบ: ${r} reps | ถูก ${c} | avg ${a}`,
    flipFail: "สลับกล้องไม่ได้: ",
    hintFull: "✓ เห็นเต็มตัว · 4 เกณฑ์",
    hintUpper: "⚠ เห็นแค่ท่อนบน · ขยับให้เห็นขา (2 เกณฑ์)",
    targetRepsLabel: "จำนวนครั้ง", targetRepsUnit: "ครั้ง",
    targetTimeLabel: "เวลา (วินาที)", targetTimeUnit: "วินาที",
    lbTitle: "อันดับ", lbEmpty: "ยังไม่มีข้อมูล — เล่นสักเซตก่อน",
    reps: "ครั้ง", correctWord: "ถูก",
    confirmClear: "ล้างประวัติทั้งหมดในเครื่อง?",
    syncing: "กำลังซิงค์…", syncOk: "ซิงค์สำเร็จ ✓", syncNone: "ไม่มีข้อมูลให้ซิงค์", syncFail: "ซิงค์ไม่ได้: ",
    signedInAs: "เข้าสู่ระบบในชื่อ ",
    newBest: "🏆 สถิติใหม่!",
    copied: "คัดลอกแล้ว ✓",
    shareText: (r, c, s, tm) => `PosePoint 💪 วิดพื้น ${r} ครั้ง (ถูกฟอร์ม ${c}) คะแนน ${s} ใน ${tm}\nลองเลย: https://bunjonglak123.github.io/posepoint-web/`,
    noFirebase: 'ยังไม่ได้ตั้งค่า Firebase — แอปใช้งานแบบในเครื่องได้ปกติ ใส่ค่าใน <code>src/firebase-config.js</code> เพื่อเปิด account + cloud',
    // form alert (banner สั้น มองไกลได้)
    alertElbow: "ศอกไม่ลึก!", alertDepth: "ลงไม่สุด!", alertBack: "หลังแอ่น!", alertKnee: "เข่างอ!",
    // voice (พูดเต็ม)
    voiceElbow: "งอศอกให้ลึกกว่านี้", voiceDepth: "ลงให้ลึกกว่านี้",
    voiceBack: "หลังแอ่น เกร็งลำตัว", voiceKnee: "เหยียดเข่าให้ตรง",
    // static UI (selector -> text)
    _: {
      "header .sub": "นับ + ตรวจฟอร์มวิดพื้น · on-device",
      "#modeFree": "Freestyle", "#modeReps": "เป้าจำนวน", "#modeTime": "จับเวลา",
      "#btnCamera": "เริ่มกล้อง", "#btnStop": "หยุด", "#btnSample": "ทดสอบ",
      "label.file.ghost": "เลือกไฟล์",
      ".stat:nth-child(2) .stat-label": "คะแนนเฉลี่ย", ".stat:nth-child(3) .stat-label": "ถูก / ทั้งหมด",
      "#summaryTitle": "สรุปผล",
      ".sum-cell:nth-child(1) .l": "ครั้งทั้งหมด", ".sum-cell:nth-child(2) .l": "ถูกต้อง",
      ".sum-cell:nth-child(3) .l": "คะแนนเฉลี่ย", ".sum-cell:nth-child(4) .l": "เวลา",
      "#btnShareLabel": "แชร์", "#btnAgain": "เริ่มใหม่",
      "#perRepTitle": "ผลแต่ละครั้ง",
      "#resultsEmpty": "ยังไม่มี rep — เริ่มจับท่าเพื่อดูผล",
      "#navWorkout span": "ออกกำลังกาย", "#navHistory span": "ประวัติ",
      "#navLeaderboard span": "อันดับ", "#navProfile span": "โปรไฟล์",
      "#view-history h2": "ประวัติการออกกำลังกาย",
      "#historyEmpty": "ยังไม่มีประวัติ — ออกกำลังกายสักเซตก่อน",
      "#authCard h2": "บัญชีผู้ใช้",
      "label[for='authEmail']": "อีเมล", "label[for='authPass']": "รหัสผ่าน",
      "#btnSignIn": "เข้าสู่ระบบ", "#btnSignUp": "สมัคร",
      "#btnSyncCloud": "ซิงค์ขึ้นคลาวด์", "#btnSignOut": "ออกจากระบบ",
      "#authSignedIn > p": "เข้าสู่ระบบในชื่อ",
      "#settingsTitle": "ตั้งค่า", "#soundLabel": "เสียงตอนนับ/นับถอยหลัง/พูดเตือน",
      "#btnClearHistory": "ล้างประวัติทั้งหมด (ในเครื่อง)",
      "#howtoTitle": "วิธีใช้งาน",
      "#guide h2": "วางกล้องแบบนี้", "#btnGuideClose": "เข้าใจแล้ว",
      "#guideNote": "เห็นเต็มตัว = ตรวจครบ 4 เกณฑ์ (ศอก/ลึก/หลัง/เข่า)"
    },
    _html: {
      "#noteClip": 'คลิปท่อนบน (ไม่เห็นสะโพก/เข่า/ข้อเท้า) จะวัดได้แค่เกณฑ์ <b>ศอก</b> + <b>ความลึก</b> ส่วนหลัง/เข่าจะถูก skip. อยากครบ 4 เกณฑ์ให้ถ่าย <b>เต็มตัวมุมข้าง</b>.',
      "#notePrivacy": 'ประมวลผลในเครื่อง ไม่อัปโหลดวิดีโอ · <a href="privacy.html" style="color:var(--accent);">นโยบายความเป็นส่วนตัว</a>',
      "#howtoList": '<li>เลือกโหมด: Freestyle / เป้าจำนวน / จับเวลา</li><li>วางมือถือให้เห็น<b>มุมข้าง</b> ทั้งตัว (อยากครบ 4 เกณฑ์ ต้องเห็นสะโพก-เข่า-ข้อเท้า)</li><li>กด "เริ่มกล้อง" → รอนับถอยหลัง 3-2-1 → วิดพื้น</li><li>ดูผลแต่ละครั้ง + คะแนน; จบเซตดูสรุป</li><li>ติดตั้งเป็นแอป: เมนูเบราว์เซอร์ → "Add to Home screen"</li>',
      "#guideList": '<li>หัน<b>ด้านข้าง</b>ให้กล้อง (ตั้งฉาก 90° ไม่เฉียง)</li><li>กล้องเห็น<b>เต็มตัว หัวถึงเท้า</b> — ขาดขา = วัดได้แค่ 2 เกณฑ์</li><li>วางกล้อง<b>ต่ำ</b> ระดับลำตัว ห่าง ~1.5-2 ม. แนวนอน</li><li>แสงสว่างพอ ฉากหลังโล่ง</li>'
    }
  },
  en: {
    loadingModel: "Loading MediaPipe model…",
    ready: "Ready",
    readyIdle: "Ready — press Start Camera or choose a file",
    startReps: (n) => `Goal ${n} reps — go!`,
    startTime: (t) => `Timer ${t} — go!`,
    tracking: "Tracking…",
    goalDone: "Goal reached! 🎯",
    timeUp: "Time's up!",
    setDone: "Set finished",
    clipDone: "Clip finished",
    noReps: "No reps detected",
    finalized: (r, c, a) => `Done: ${r} reps | correct ${c} | avg ${a}`,
    flipFail: "Can't flip camera: ",
    hintFull: "✓ Full body · 4 criteria",
    hintUpper: "⚠ Upper body only · show your legs (2 criteria)",
    targetRepsLabel: "Reps", targetRepsUnit: "reps",
    targetTimeLabel: "Time (sec)", targetTimeUnit: "sec",
    lbTitle: "Ranking", lbEmpty: "No data yet — do a set first",
    reps: "reps", correctWord: "correct",
    confirmClear: "Clear all local history?",
    syncing: "Syncing…", syncOk: "Synced ✓", syncNone: "Nothing to sync", syncFail: "Sync failed: ",
    signedInAs: "Signed in as ",
    newBest: "🏆 New best!",
    copied: "Copied ✓",
    shareText: (r, c, s, tm) => `PosePoint 💪 ${r} push-ups (${c} good form) score ${s} in ${tm}\nTry it: https://bunjonglak123.github.io/posepoint-web/`,
    noFirebase: 'Firebase not configured — the app works locally. Fill <code>src/firebase-config.js</code> to enable account + cloud.',
    alertElbow: "ELBOWS!", alertDepth: "GO LOWER!", alertBack: "BACK SAGGING!", alertKnee: "KNEES BENT!",
    voiceElbow: "Bend your elbows more", voiceDepth: "Go lower",
    voiceBack: "Keep your back straight", voiceKnee: "Straighten your knees",
    _: {
      "header .sub": "Push-up counter + form check · on-device",
      "#modeFree": "Freestyle", "#modeReps": "Reps Goal", "#modeTime": "Time Attack",
      "#btnCamera": "Start Camera", "#btnStop": "Stop", "#btnSample": "Test",
      "label.file.ghost": "Choose File",
      ".stat:nth-child(2) .stat-label": "Avg Score", ".stat:nth-child(3) .stat-label": "Correct / Total",
      "#summaryTitle": "Summary",
      ".sum-cell:nth-child(1) .l": "Total Reps", ".sum-cell:nth-child(2) .l": "Correct",
      ".sum-cell:nth-child(3) .l": "Avg Score", ".sum-cell:nth-child(4) .l": "Time",
      "#btnShareLabel": "Share", "#btnAgain": "Restart",
      "#perRepTitle": "Per-Rep Results",
      "#resultsEmpty": "No reps yet — start tracking to see results",
      "#navWorkout span": "Workout", "#navHistory span": "History",
      "#navLeaderboard span": "Ranking", "#navProfile span": "Profile",
      "#view-history h2": "Workout History",
      "#historyEmpty": "No history yet — do a set first",
      "#authCard h2": "Account",
      "label[for='authEmail']": "Email", "label[for='authPass']": "Password",
      "#btnSignIn": "Sign In", "#btnSignUp": "Sign Up",
      "#btnSyncCloud": "Sync to Cloud", "#btnSignOut": "Sign Out",
      "#authSignedIn > p": "Signed in as",
      "#settingsTitle": "Settings", "#soundLabel": "Sound (count / countdown / voice)",
      "#btnClearHistory": "Clear all history (local)",
      "#howtoTitle": "How to Use",
      "#guide h2": "Place Camera Like This", "#btnGuideClose": "Got it",
      "#guideNote": "Full body visible = all 4 criteria checked (elbow/depth/back/knee)"
    },
    _html: {
      "#noteClip": 'Upper-body-only clips (no hip/knee/ankle) can only check <b>elbow</b> + <b>depth</b>; back/knee get skipped. For all 4 criteria, film <b>full body from the side</b>.',
      "#notePrivacy": 'Processed on-device, no video uploaded · <a href="privacy.html" style="color:var(--accent);">Privacy policy</a>',
      "#howtoList": '<li>Pick a mode: Freestyle / Reps Goal / Time Attack</li><li>Place the phone to see your <b>full body from the side</b> (all 4 criteria need hip-knee-ankle visible)</li><li>Press "Start Camera" → 3-2-1 countdown → push up</li><li>Watch per-rep results + score; see the summary when done</li><li>Install as app: browser menu → "Add to Home screen"</li>',
      "#guideList": '<li>Face the camera <b>side-on</b> (90°, not angled)</li><li>Camera sees your <b>full body, head to toe</b> — no legs = only 2 criteria</li><li>Place the camera <b>low</b>, torso level, ~1.5-2 m away, landscape</li><li>Good lighting, clear background</li>'
    }
  }
};

let lang = localStorage.getItem("pp_lang") || "th";
export const getLang = () => lang;
export function t(key, ...args) {
  const v = (STR[lang] && STR[lang][key]) ?? STR.th[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}
export function applyStatic() {
  document.documentElement.lang = lang;
  for (const [sel, text] of Object.entries(STR[lang]._)) {
    document.querySelectorAll(sel).forEach(el => { el.querySelector("svg,input,b,code,a")
      ? setLastText(el, text) : el.textContent = text; });
  }
  for (const [sel, html] of Object.entries(STR[lang]._html)) {
    document.querySelectorAll(sel).forEach(el => { el.innerHTML = html; });
  }
  const b = document.getElementById("btnLang");
  if (b) b.textContent = lang === "th" ? "EN" : "ไทย";
}
// ปุ่ม/label ที่มี svg หรือ input ข้างใน — แทนเฉพาะ text node สุดท้าย ไม่ลบลูก
function setLastText(el, text) {
  for (let i = el.childNodes.length - 1; i >= 0; i--) {
    const n = el.childNodes[i];
    if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = " " + text + " "; return; }
  }
  el.appendChild(document.createTextNode(" " + text));
}
export function setLang(l) { lang = l; localStorage.setItem("pp_lang", l); applyStatic(); }
export function toggleLang() { setLang(lang === "th" ? "en" : "th"); }
