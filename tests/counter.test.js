import { test } from "node:test";
import assert from "node:assert/strict";
import { RepCounter } from "../src/counter.js";
import { CONFIG } from "../src/config.js";

const f = (elbow, wsd = 0.5, back = 170, knee = 170, lowerVis = 1) =>
  ({ elbowAngle: elbow, wsd, backAngle: back, kneeAngle: knee, lowerVis });

function drive(seq) {
  const rc = new RepCounter(CONFIG);
  const done = seq.map(x => rc.update(x)).filter(Boolean);
  return { rc, done };
}

test("counts one full rep", () => {
  const { rc, done } = drive([f(160, 0.6), f(80, 0.2), f(160, 0.6)]);
  assert.equal(rc.count, 1);
  assert.equal(done.length, 1);
});
test("counts two reps", () => {
  const { rc } = drive([f(160, 0.6), f(80, 0.2), f(160, 0.6), f(80, 0.2), f(160, 0.6)]);
  assert.equal(rc.count, 2);
});
test("no rep if never down", () => {
  const { rc, done } = drive([f(160), f(155), f(165)]);
  assert.equal(rc.count, 0);
  assert.equal(done.length, 0);
});
test("lower body invisible -> back/knee null", () => {
  const { done } = drive([f(160, 0.6, 170, 170, 0), f(80, 0.2, 170, 170, 0), f(160, 0.6, 170, 170, 0)]);
  assert.equal(done[0].backMin, null);
  assert.equal(done[0].kneeMin, null);
});
test("captures min/max", () => {
  const { done } = drive([f(160, 0.6, 170, 170), f(70, 0.2, 170, 140), f(160, 0.6, 170, 170)]);
  assert.equal(done[0].elbowMin, 70);
  assert.equal(done[0].elbowMax, 160);
  assert.equal(done[0].wsdMin, 0.2);
  assert.equal(done[0].kneeMin, 140);
});
