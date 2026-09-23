// ค่า threshold ของอัลกอริทึม (คาลิเบรตแล้ว — ตรงกับ Python config.py)
export const CONFIG = {
  ELBOW_DOWN: 90,     // มุมศอกตอนต่ำสุดต้อง < ค่านี้
  ELBOW_UP: 150,      // มุมศอกตอนสูงสุดต้อง > ค่านี้
  DEPTH_RATIO: 0.5,   // wsdMin < DEPTH_RATIO * wsdMax
  BACK_MIN: 150,      // backAngle ต้อง >= ค่านี้ตลอด rep
  KNEE_MIN: 150,      // kneeAngle ต้อง >= ค่านี้ตลอด rep (คาลิเบรตจาก 160)
  MIN_VISIBILITY: 0.5, // visibility ต่ำกว่านี้ = ไม่น่าเชื่อถือ
  MIN_TRAVEL_RATIO: 0.4 // ไหล่ต้องเลื่อนแนวดิ่ง >= ค่านี้ × ความยาวต้นแขน ถึงนับ (กันงอแขนหลอก)
};

// ค่าปรับแต่งของแอป (แยกจากอัลกอริทึม) — รวมไว้ที่เดียวแทนการฝังตัวเลขในโค้ด
export const APP = {
  DETECT_FPS: 24,             // จำกัดอัตราการตรวจจับ (กัน backlog/ค้าง)
  ANALYZE_FPS: 25,            // อัตราการเดินเฟรมตอนวิเคราะห์ไฟล์วิดีโอ
  MODEL_URL: "model/pushup_rf.json",
  ML_THRESHOLD: 0.5,          // ใช้เมื่อไฟล์โมเดลไม่ได้ระบุ threshold มาเอง
  SCORE_MAX: 100,             // คะแนนเต็มต่อครั้ง
  PROB_DECIMALS: 3,           // ความละเอียดของความน่าจะเป็นที่บันทึกลงประวัติ
  ALERT_MS: { ok: 1200, bad: 2200 },   // เวลาที่แบนเนอร์ค้างบนจอ
  COUNTDOWN_FROM: 3,
  COUNTDOWN_STEP_MS: 700,
  LEADERBOARD_SIZE: 10,
  SKELETON: { line: "#4ea1ff", joint: "#7ee787", lineWidth: 3, jointRadius: 5 },
  BEEP: {                     // ความถี่ (Hz) / ความยาว (วินาที)
    repOk: { freq: 760, dur: 0.09 }, repBad: { freq: 320, dur: 0.09 },
    countdown: { freq: 440, dur: 0.1 }, go: { freq: 880, dur: 0.18 }
  },
  DEFAULT_TARGET: { reps: 20, seconds: 30 },
  VOICE: {                    // เสียงพูด (TTS) — เสียงสังเคราะห์ฟังไม่เป็นธรรมชาติ จึงเลือกพูดเฉพาะที่จำเป็น
    countReps: false,         // ไม่พูดเลขนับ (มีเสียงบี๊บ + เลขบนจออยู่แล้ว)
    mute: ["back"]            // จุดผิดที่ไม่ต้องพูด — ยังขึ้นแบนเนอร์ + เสียงบี๊บตามปกติ
  }
};
