// ค่า threshold (คาลิเบรตแล้ว — ตรงกับ Python config.py)
export const CONFIG = {
  ELBOW_DOWN: 90,     // มุมศอกตอนต่ำสุดต้อง < ค่านี้
  ELBOW_UP: 150,      // มุมศอกตอนสูงสุดต้อง > ค่านี้
  DEPTH_RATIO: 0.5,   // wsdMin < DEPTH_RATIO * wsdMax
  BACK_MIN: 150,      // backAngle ต้อง >= ค่านี้ตลอด rep
  KNEE_MIN: 150,      // kneeAngle ต้อง >= ค่านี้ตลอด rep (คาลิเบรตจาก 160)
  MIN_VISIBILITY: 0.5 // visibility ต่ำกว่านี้ = ไม่น่าเชื่อถือ
};
