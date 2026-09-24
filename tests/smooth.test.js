import { test } from "node:test";
import assert from "node:assert/strict";
import { FeatureSmoother, windowFrames } from "../src/smooth.js";
import { RepCounter } from "../src/counter.js";
import { CONFIG } from "../src/config.js";

const fr = (elbow, sy = 0.3, extra = {}) => ({ elbowAngle: elbow, backAngle: 170, kneeAngle: 170, wsd: 0.3, lowerVis: 1, shoulderY: sy, armLen: 0.1, ...extra });

test("ค่าโดดเฟรมเดียวถูกตัดทิ้ง", () => {
  const s = new FeatureSmoother(5);
  const out = [165, 166, 6, 164, 165].map(e => s.push(fr(e)).elbowAngle);
  assert.ok(out[2] > 150, `มุมโดด 6° ต้องไม่ผ่าน ได้ ${out[2]}`);
});

test("การเคลื่อนไหวจริงยังผ่านได้ (ลงลึกหลายเฟรมติดกัน)", () => {
  const s = new FeatureSmoother(5);
  const seq = [170, 150, 120, 90, 70, 65, 70, 95, 130, 160, 170, 172, 172];
  const out = seq.map(e => s.push(fr(e)).elbowAngle);
  assert.ok(Math.min(...out) < 90 && Math.max(...out.slice(-3)) > 150);
});

test("ตัวนับไม่นับครั้งปลอมจากค่าโดด เมื่อกรองก่อน", () => {
  const spiky = [170, 170, 20, 170, 170, 170, 25, 175, 170, 170];      // ศอกโดดลงแค่เฟรมเดียว สองรอบ
  const shoulder = [0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3]; // ไหล่โดดตามจุดที่ผิด
  const raw = new RepCounter(CONFIG), smooth = new RepCounter(CONFIG), s = new FeatureSmoother(5);
  spiky.forEach((e, i) => { raw.update(fr(e, shoulder[i])); smooth.update(s.push(fr(e, shoulder[i]))); });
  assert.ok(raw.count >= 1, "ไม่กรอง = นับครั้งปลอม (ยืนยันว่าปัญหามีจริง)");
  assert.equal(smooth.count, 0);
});

test("เก็บฟิลด์อื่นของเฟรมล่าสุดไว้ (เวลา/พิกัดดิบ) และหน้าต่าง 1 = ไม่กรอง", () => {
  const s = new FeatureSmoother(5);
  s.push(fr(160, 0.3, { t: 1 }));
  assert.equal(s.push(fr(150, 0.3, { t: 2 })).t, 2);
  assert.equal(new FeatureSmoother(1).push(fr(6)).elbowAngle, 6);
});

test("หน้าต่างกำหนดเป็นเวลา: จำนวนเฟรมเป็นเลขคี่ตาม fps", () => {
  assert.equal(windowFrames(200, 15), 3);
  assert.equal(windowFrames(200, 25), 5);
  assert.equal(windowFrames(0, 30), 1);
});
