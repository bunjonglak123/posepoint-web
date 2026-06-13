// ตัดสินถูก/ผิด — พอร์ตตรงจาก Python criteria.py (visibility-aware skip)
export function evaluateRep(m, cfg) {
  const failed = [], skipped = [];
  // C1 ศอก
  if (!(m.elbowMin < cfg.ELBOW_DOWN && m.elbowMax > cfg.ELBOW_UP)) failed.push("elbow");
  // C2 ลึก
  if (!(m.wsdMax > 0 && m.wsdMin < cfg.DEPTH_RATIO * m.wsdMax)) failed.push("depth");
  // C4 หลัง (skip ถ้าวัดไม่ได้)
  if (m.backMin === null) skipped.push("back");
  else if (m.backMin < cfg.BACK_MIN) failed.push("back");
  // C5 เข่า (skip ถ้าวัดไม่ได้)
  if (m.kneeMin === null) skipped.push("knee");
  else if (m.kneeMin < cfg.KNEE_MIN) failed.push("knee");
  return {
    index: m.index,
    verdict: failed.length ? "INCORRECT" : "CORRECT",
    failed, skipped, metrics: m
  };
}
