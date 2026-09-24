// ตัดสินหนึ่งครั้ง: โมเดล ML เป็นตัวตัดสินหลัก เกณฑ์เชิงกฎใช้บอกว่าผิดตรงไหน และเป็นตัวสำรอง
import { evaluateRep } from "./criteria.js";
import { repFeatureVector, FEATURE_NAMES } from "./repFeatures.js";
import { predictIncorrectProba } from "./mlModel.js";
import { seqProbas } from "./seqModel.js";
import { APP } from "./config.js";

const LOWER_VIS = FEATURE_NAMES.indexOf("lower_vis_mean");

export function judgeRep(m, cfg, model, mlOn) {
  const res = evaluateRep(m, cfg);
  res.judge = "rule";
  const frames = m.frames;
  delete res.metrics.frames;   // ไม่ต้องเก็บเฟรมดิบไว้ในผลลัพธ์ของเซสชัน
  if (!mlOn || !model || !frames || !frames.length) return res;

  const x = repFeatureVector(frames);
  res.features = x;            // เก็บไว้ใช้สร้างชุดข้อมูลเทรนจาก pipeline ของเว็บ (26 ค่า)
  // โมเดลเทรนจากคลิปเห็นเต็มตัว: ถ้ามองไม่เห็นครึ่งล่าง ค่ามุมหลัง/เข่าเชื่อไม่ได้ -> ใช้เกณฑ์เชิงกฎแทน
  if (x[LOWER_VIS] < cfg.MIN_VISIBILITY) { res.mlSkipped = "lowerBodyHidden"; return res; }

  // รวมหลายโมเดล: RF (สถิติสรุป) + LSTM/CNN (ลำดับเฟรม) เฉลี่ยความน่าจะเป็น
  // ไฟล์โมเดลรุ่นเก่าที่มีแต่ RF ก็ยังใช้ได้ (seqProbas คืน {})
  const members = { rf: predictIncorrectProba(model, x), ...seqProbas(model, frames) };
  const probs = Object.values(members);
  const p = probs.reduce((s, v) => s + v, 0) / probs.length;
  res.judge = "ml";
  res.members = members;
  res.pIncorrect = p;
  res.score = Math.round((1 - p) * APP.SCORE_MAX);
  res.ruleFailed = res.failed;
  res.verdict = p >= (model.threshold ?? APP.ML_THRESHOLD) ? "INCORRECT" : "CORRECT";
  // โมเดลบอกถูก -> ไม่แจ้งจุดผิด ; โมเดลบอกผิดแต่เกณฑ์ไม่เจอจุดผิด -> แจ้งแบบทั่วไป
  res.failed = res.verdict === "CORRECT" ? [] : (res.failed.length ? res.failed : ["form"]);
  return res;
}
