import { test } from "node:test";
import assert from "node:assert/strict";
import { angle3pt, distance, verticalDistance } from "../src/geometry.js";

const P = (x, y) => ({ x, y });

test("right angle = 90", () => {
  assert.ok(Math.abs(angle3pt(P(0, 1), P(0, 0), P(1, 0)) - 90) < 1e-6);
});
test("straight line = 180", () => {
  assert.ok(Math.abs(angle3pt(P(-1, 0), P(0, 0), P(1, 0)) - 180) < 1e-6);
});
test("collapsed safe 0..180", () => {
  const v = angle3pt(P(0, 0), P(0, 0), P(1, 0));
  assert.ok(v >= 0 && v <= 180);
});
test("distance 3-4-5", () => {
  assert.ok(Math.abs(distance(P(0, 0), P(3, 4)) - 5) < 1e-9);
});
test("vertical distance", () => {
  assert.ok(Math.abs(verticalDistance(P(0, 0.2), P(0, 0.8)) - 0.6) < 1e-9);
});
