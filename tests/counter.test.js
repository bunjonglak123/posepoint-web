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
test("captures min/max", () => {
  const { done } = drive([TOP(), BOT({ knee: 140 }), TOP()]);
  assert.equal(done[0].elbowMin, 80);
  assert.equal(done[0].elbowMax, 160);
  assert.equal(done[0].wsdMin, 0.2);
  assert.equal(done[0].kneeMin, 140);
});
