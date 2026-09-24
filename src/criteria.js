// ตัดสินถูก/ผิดด้วยเกณฑ์เชิงกฎ (visibility-aware skip)
// ค่าเกณฑ์อยู่ใน cfg.RULES — ค่า null = ปิดข้อนั้น
export function evaluateRep(m, cfg) {
  const r = cfg.RULES;
  const failed = [], skipped = [];
  const fail = k => { if (!failed.includes(k)) failed.push(k); };
  // C1 ศอก
  if (r.ELBOW_DOWN != null && !(m.elbowMin < r.ELBOW_DOWN)) fail("elbow");
  if (r.ELBOW_UP != null && !(m.elbowMax > r.ELBOW_UP)) fail("elbow");
  // C2 ลึก: ระยะข้อมือ-ไหล่ลดลงพอ / ไหล่เลื่อนลงพอเทียบความยาวแขน
  if (r.DEPTH_RATIO != null && !(m.wsdMax > 0 && m.wsdMin < r.DEPTH_RATIO * m.wsdMax)) fail("depth");
  if (r.TRAVEL_MIN != null && m.travelRatio != null && m.travelRatio < r.TRAVEL_MIN) fail("depth");
  // C4 หลัง (skip ถ้าวัดไม่ได้)
  if (m.backMin === null) skipped.push("back");
  else if (r.BACK_MIN != null && m.backMin < r.BACK_MIN) fail("back");
  // C5 เข่า (skip ถ้าวัดไม่ได้)
  if (m.kneeMin === null) skipped.push("knee");
  else if (r.KNEE_MIN != null && m.kneeMin < r.KNEE_MIN) fail("knee");
  return {
    index: m.index,
    verdict: failed.length ? "INCORRECT" : "CORRECT",
    failed, skipped, metrics: m
  };
}
