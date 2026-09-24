import { test } from "node:test";
import assert from "node:assert/strict";
import { RepCounter } from "../src/counter.js";
import { CONFIG } from "../src/config.js";

// sy = shoulderY, arm = armLen
const f = (elbow, wsd = 0.5, back = 170, knee = 170, lowerVis = 1, sy = 0.3, arm = 0.1) =>
  ({ elbowAngle: elbow, wsd, backAngle: back, kneeAngle: knee, lowerVis, shoulderY: sy, armLen: arm });

function drive(seq) {
  const rc = new RepCounter(CONFIG);
  const done = seq.map(x => rc.update(x)).filter(Boolean);
  return { rc, done };
}

// top: ไหล่สูง sy=0.3 ; bottom: ไหล่ลง sy=0.5 -> travel 0.2 >= 0.4*0.1 -> นับ
const TOP = (o = {}) => f(160, o.wsd ?? 0.6, o.back ?? 170, o.knee ?? 170, o.lowerVis ?? 1, 0.3, 0.1);
const BOT = (o = {}) => f(80, o.wsd ?? 0.2, o.back ?? 170, o.knee ?? 170, o.lowerVis ?? 1, 0.5, 0.1);

test("counts one full rep", () => {
  const { rc, done } = drive([TOP(), BOT(), TOP()]);
  assert.equal(rc.count, 1);
  assert.equal(done.length, 1);
});
test("counts two reps", () => {
  const { rc } = drive([TOP(), BOT(), TOP(), BOT(), TOP()]);
  assert.equal(rc.count, 2);
});
test("no rep if never down", () => {
  const { rc, done } = drive([f(160), f(155), f(165)]);
  assert.equal(rc.count, 0);
  assert.equal(done.length, 0);
});
test("does NOT count if shoulder barely moves (งอแขนหลอก)", () => {
  const { rc, done } = drive([
    f(160, 0.6, 170, 170, 1, 0.30, 0.1),
    f(80, 0.2, 170, 170, 1, 0.30, 0.1),   // ไหล่อยู่กับที่
    f(160, 0.6, 170, 170, 1, 0.30, 0.1)
  ]);
  assert.equal(rc.count, 0);
  assert.equal(done.length, 0);
});
test("lower body invisible -> back/knee null", () => {
  const { done } = drive([TOP({ lowerVis: 0 }), BOT({ lowerVis: 0 }), TOP({ lowerVis: 0 })]);
  assert.equal(done[0].backMin, null);
  assert.equal(done[0].kneeMin, null);
});
test("แนบเฟรมของครั้งนั้นไว้ใน m.frames (ให้โมเดล ML ใช้)", () => {
  const seq = [TOP(), BOT(), TOP(), BOT(), TOP()];
  const { done } = drive(seq);
  assert.equal(done.length, 2);
  assert.deepEqual(done[0].frames, seq.slice(0, 3));   // ครั้งแรก: ตั้งแต่เริ่มถึงเฟรมที่ขึ้นสุด
  assert.deepEqual(done[1].frames, seq.slice(3, 5));   // ครั้งถัดไปเริ่มหลังครั้งก่อนจบ
});
test("captures min/max", () => {
  const { done } = drive([TOP(), BOT({ knee: 140 }), TOP()]);
  assert.equal(done[0].elbowMin, 80);
  assert.equal(done[0].elbowMax, 160);
  assert.equal(done[0].wsdMin, 0.2);
  assert.equal(done[0].kneeMin, 140);
});

// ---------- ตัวนับแบบรอบการเคลื่อนไหว (CycleCounter) ----------
import { CycleCounter, makeCounter } from "../src/counter.js";
const cyc = (seq, sy) => {
  const c = new CycleCounter({ ...CONFIG, CYCLE_DELTA: 20 });
  const reps = [];
  seq.forEach((e, i) => { const m = c.update({ elbowAngle: e, backAngle: 170, kneeAngle: 170, wsd: 0.3, lowerVis: 1, shoulderY: sy ? sy[i] : 0.3 + (170 - e) / 400, armLen: 0.1 }); if (m) reps.push(m); });
  return { c, reps };
};

test("CycleCounter: ครั้งปกตินับหนึ่งครั้ง", () => {
  assert.equal(cyc([170, 150, 120, 85, 80, 100, 140, 170, 172]).c.count, 1);
});

test("CycleCounter: ลงไม่สุดก็นับ (แล้วให้เกณฑ์แจ้งว่าผิด) — แบบเดิมไม่นับเลย", () => {
  const shallow = [172, 160, 145, 135, 132, 140, 160, 172, 172];
  const { c, reps } = cyc(shallow);
  assert.equal(c.count, 1);
  assert.ok(reps[0].elbowMin > CONFIG.ELBOW_DOWN, "ครั้งนี้ศอกไม่ถึง 90° จึงถูกเกณฑ์ศอกจับว่าผิด");
  const old = makeCounter({ ...CONFIG, COUNT_MODE: "abs" });
  shallow.forEach(e => old.update({ elbowAngle: e, backAngle: 170, kneeAngle: 170, wsd: 0.3, lowerVis: 1, shoulderY: 0.3 + (170 - e) / 400, armLen: 0.1 }));
  assert.equal(old.count, 0);
});

test("CycleCounter: มุมแกว่งน้อยกว่า Δ ไม่นับ", () => {
  assert.equal(cyc([170, 160, 158, 165, 160, 170, 162, 168]).c.count, 0);
});

test("CycleCounter: งอแขนอยู่กับที่ (ไหล่ไม่ขยับ) ไม่นับ — กันหลอกยังทำงาน", () => {
  const seq = [170, 140, 100, 80, 100, 140, 170, 172];
  assert.equal(cyc(seq, seq.map(() => 0.3)).c.count, 0);
});

test("makeCounter เลือกตามค่าตั้ง", () => {
  assert.ok(makeCounter({ ...CONFIG, COUNT_MODE: "cycle" }) instanceof CycleCounter);
  assert.ok(!(makeCounter({ ...CONFIG, COUNT_MODE: "abs" }) instanceof CycleCounter));
});
