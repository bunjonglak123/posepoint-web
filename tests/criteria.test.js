import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRep } from "../src/criteria.js";
import { CONFIG } from "../src/config.js";

const m = (o = {}) => ({
  index: 1, elbowMin: 80, elbowMax: 160, wsdMin: 0.2, wsdMax: 0.6, travelRatio: 1.2,
  backMin: 165, kneeMin: 170, ...o
});
// เกณฑ์แบบเดิมทุกข้อ (ใช้ทดสอบตรรกะแต่ละข้อ ไม่ขึ้นกับค่าที่แอปใช้จริง)
const ALL = { ...CONFIG, RULES: { ELBOW_DOWN: 90, ELBOW_UP: 150, DEPTH_RATIO: 0.5, TRAVEL_MIN: 0.8, BACK_MIN: 150, KNEE_MIN: 150 } };

test("correct passes all", () => {
  const r = evaluateRep(m(), ALL);
  assert.equal(r.verdict, "CORRECT");
  assert.deepEqual(r.failed, []);
});
test("elbow not low enough", () => {
  assert.ok(evaluateRep(m({ elbowMin: 100 }), ALL).failed.includes("elbow"));
});
test("depth too shallow", () => {
  assert.ok(evaluateRep(m({ wsdMin: 0.5, wsdMax: 0.6 }), ALL).failed.includes("depth"));
});
test("shoulder travel too short counts as depth, reported once", () => {
  const r = evaluateRep(m({ travelRatio: 0.5, wsdMin: 0.5, wsdMax: 0.6 }), ALL);
  assert.deepEqual(r.failed.filter(f => f === "depth"), ["depth"]);
});
test("back sag", () => {
  assert.ok(evaluateRep(m({ backMin: 140 }), ALL).failed.includes("back"));
});
test("knee bent", () => {
  assert.ok(evaluateRep(m({ kneeMin: 140 }), ALL).failed.includes("knee"));
});
test("skips unmeasurable back/knee (null)", () => {
  const r = evaluateRep(m({ backMin: null, kneeMin: null }), ALL);
  assert.deepEqual(new Set(r.skipped), new Set(["back", "knee"]));
  assert.ok(!r.failed.includes("back") && !r.failed.includes("knee"));
  assert.equal(r.verdict, "CORRECT");
});
test("a rule set to null is switched off", () => {
  const off = { ...CONFIG, RULES: { ELBOW_DOWN: null, ELBOW_UP: null, DEPTH_RATIO: null, TRAVEL_MIN: null, BACK_MIN: null, KNEE_MIN: null } };
  assert.equal(evaluateRep(m({ elbowMin: 130, elbowMax: 120, wsdMin: 0.6, travelRatio: 0.1, backMin: 50, kneeMin: 50 }), off).verdict, "CORRECT");
});

// ค่าที่แอปใช้จริง: ปรับจากป้ายรายครั้งที่คนติด (rule_calibration.py, nested CV แบ่งตามคน)
test("calibrated rules: 2D elbow angle alone no longer fails a rep", () => {
  assert.equal(evaluateRep(m({ elbowMin: 110, elbowMax: 140 }), CONFIG).verdict, "CORRECT");
});
test("calibrated rules: short shoulder travel -> depth", () => {
  assert.deepEqual(evaluateRep(m({ travelRatio: 0.7 }), CONFIG).failed, ["depth"]);
});
test("calibrated rules: knee < 120 fails, 130 passes", () => {
  assert.ok(evaluateRep(m({ kneeMin: 110 }), CONFIG).failed.includes("knee"));
  assert.ok(!evaluateRep(m({ kneeMin: 130 }), CONFIG).failed.includes("knee"));
});
test("calibrated rules: only severe back sag (< 100) fails", () => {
  assert.ok(evaluateRep(m({ backMin: 90 }), CONFIG).failed.includes("back"));
  assert.ok(!evaluateRep(m({ backMin: 130 }), CONFIG).failed.includes("back"));
});
