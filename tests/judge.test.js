import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeRep } from "../src/judge.js";
import { CONFIG } from "../src/config.js";
import { FEATURE_NAMES } from "../src/repFeatures.js";

const frame = (elbow, lowerVis = 1, sy = 0.3) =>
  ({ elbowAngle: elbow, backAngle: 170, kneeAngle: 170, wsd: elbow > 120 ? 0.6 : 0.2, lowerVis, shoulderY: sy, armLen: 0.1 });
const rep = (lowerVis = 1) => ({
  index: 1, valid: true, elbowMin: 80, elbowMax: 160, wsdMin: 0.2, wsdMax: 0.6,
  backMin: lowerVis >= 0.5 ? 170 : null, kneeMin: lowerVis >= 0.5 ? 170 : null,
  frames: [frame(160, lowerVis, 0.3), frame(80, lowerVis, 0.5), frame(160, lowerVis, 0.3)]
});
// โมเดลปลอม: ต้นไม้เดียว ใบเดียว ให้ P(incorrect) คงที่
const stub = (p) => ({ version: "t", threshold: 0.5, feature_names: FEATURE_NAMES, trees: [{ l: [-1], r: [-1], f: [-1], t: [0], p: [p] }] });

test("ใช้โมเดล ML เมื่อเปิดใช้และเห็นเต็มตัว: คะแนนจากความน่าจะเป็น", () => {
  const res = judgeRep(rep(), CONFIG, stub(0.2), true);
  assert.equal(res.judge, "ml");
  assert.equal(res.verdict, "CORRECT");
  assert.equal(res.score, 80);
  assert.deepEqual(res.failed, []);
});

test("โมเดลบอกผิดแต่เกณฑ์ไม่เจอจุดผิด -> แจ้งแบบทั่วไป 'form'", () => {
  const res = judgeRep(rep(), CONFIG, stub(0.9), true);
  assert.equal(res.verdict, "INCORRECT");
  assert.equal(res.score, 10);
  assert.deepEqual(res.failed, ["form"]);
  assert.deepEqual(res.ruleFailed, []);
});

test("มองไม่เห็นครึ่งล่าง -> ไม่ใช้โมเดล กลับไปใช้เกณฑ์เชิงกฎ", () => {
  const res = judgeRep(rep(0.1), CONFIG, stub(0.9), true);
  assert.equal(res.judge, "rule");
  assert.equal(res.mlSkipped, "lowerBodyHidden");
  assert.equal(res.verdict, "CORRECT");
  assert.equal(res.score, undefined);
});

test("ปิด ML หรือไม่มีโมเดล -> ใช้เกณฑ์เชิงกฎ", () => {
  assert.equal(judgeRep(rep(), CONFIG, stub(0.9), false).judge, "rule");
  assert.equal(judgeRep(rep(), CONFIG, null, true).judge, "rule");
});

test("ไม่เก็บเฟรมดิบไว้ในผลลัพธ์ แต่เก็บคุณลักษณะ 26 ค่า", () => {
  const res = judgeRep(rep(), CONFIG, stub(0.2), true);
  assert.equal(res.metrics.frames, undefined);
  assert.equal(res.features.length, 26);
});
