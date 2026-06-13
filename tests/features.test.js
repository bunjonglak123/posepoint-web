import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFeatures } from "../src/features.js";

const lm = (shoulder, elbow, wrist, hip, knee, ankle, vis = 1) => ({
  shoulder: { ...shoulder, visibility: vis }, elbow: { ...elbow, visibility: vis },
  wrist: { ...wrist, visibility: vis }, hip: { ...hip, visibility: vis },
  knee: { ...knee, visibility: vis }, ankle: { ...ankle, visibility: vis }
});

test("straight plank: big angles", () => {
  const f = computeFeatures(lm(
    { x: 0.20, y: 0.40 }, { x: 0.35, y: 0.40 }, { x: 0.50, y: 0.40 },
    { x: 0.40, y: 0.40 }, { x: 0.60, y: 0.40 }, { x: 0.80, y: 0.40 }));
  assert.ok(f.elbowAngle > 170);
  assert.ok(f.backAngle > 150);
  assert.ok(f.kneeAngle > 150);
});
test("wsd is vertical gap", () => {
  const f = computeFeatures(lm(
    { x: 0.3, y: 0.2 }, { x: 0.3, y: 0.5 }, { x: 0.3, y: 0.8 },
    { x: 0.3, y: 0.25 }, { x: 0.3, y: 0.30 }, { x: 0.3, y: 0.35 }));
  assert.ok(Math.abs(f.wsd - 0.6) < 1e-9);
});
test("lowerVis is min of hip/knee/ankle", () => {
  const m = lm({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 });
  m.hip.visibility = 0.9; m.knee.visibility = 0.1; m.ankle.visibility = 0.4;
  assert.ok(Math.abs(computeFeatures(m).lowerVis - 0.1) < 1e-9);
});
