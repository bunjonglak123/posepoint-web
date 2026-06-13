import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRep } from "../src/criteria.js";
import { CONFIG } from "../src/config.js";

const m = (o = {}) => ({
  index: 1, elbowMin: 80, elbowMax: 160, wsdMin: 0.2, wsdMax: 0.6,
  backMin: 165, kneeMin: 170, ...o
});

test("correct passes all", () => {
  const r = evaluateRep(m(), CONFIG);
  assert.equal(r.verdict, "CORRECT");
  assert.deepEqual(r.failed, []);
});
test("elbow not low enough", () => {
  assert.ok(evaluateRep(m({ elbowMin: 100 }), CONFIG).failed.includes("elbow"));
});
test("depth too shallow", () => {
  assert.ok(evaluateRep(m({ wsdMin: 0.5, wsdMax: 0.6 }), CONFIG).failed.includes("depth"));
});
test("back sag", () => {
  assert.ok(evaluateRep(m({ backMin: 140 }), CONFIG).failed.includes("back"));
});
test("knee bent", () => {
  assert.ok(evaluateRep(m({ kneeMin: 140 }), CONFIG).failed.includes("knee"));
});
test("skips unmeasurable back/knee (null)", () => {
  const r = evaluateRep(m({ backMin: null, kneeMin: null }), CONFIG);
  assert.deepEqual(new Set(r.skipped), new Set(["back", "knee"]));
  assert.ok(!r.failed.includes("back") && !r.failed.includes("knee"));
  assert.equal(r.verdict, "CORRECT");
});
