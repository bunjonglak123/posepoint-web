// รันโมเดล Random Forest (export จาก scikit-learn ด้วย train_model.py) ในเบราว์เซอร์ ไม่ต้องใช้เซิร์ฟเวอร์
import { FEATURE_NAMES } from "./repFeatures.js";

export function validateModel(m) {
  if (!m || !Array.isArray(m.trees) || !m.trees.length) throw new Error("ไฟล์โมเดลไม่มีต้นไม้");
  const names = m.feature_names || [];
  if (names.length !== FEATURE_NAMES.length || names.some((n, i) => n !== FEATURE_NAMES[i]))
    throw new Error("คุณลักษณะของโมเดลไม่ตรงกับ repFeatures.js");
  return m;
}

export async function loadModel(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`โหลดโมเดลไม่ได้ (${r.status})`);
  return validateModel(await r.json());
}

// ความน่าจะเป็นที่ท่าไม่ถูกต้อง = ค่าเฉลี่ยของใบไม้จากทุกต้น (เหมือน predict_proba)
// sklearn เทียบค่าแบบ float32: x <= threshold ไปทางซ้าย
export function predictIncorrectProba(model, x) {
  let sum = 0;
  for (const t of model.trees) {
    let n = 0;
    while (t.l[n] !== -1) n = Math.fround(x[t.f[n]]) <= t.t[n] ? t.l[n] : t.r[n];
    sum += t.p[n];
  }
  return sum / model.trees.length;
}
