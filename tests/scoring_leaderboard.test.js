import { test } from "node:test";
import assert from "node:assert/strict";
import { repScore, sessionScore } from "../src/scoring.js";
import { rank, top } from "../src/leaderboard.js";
import { selectSide } from "../src/landmarks.js";

const r = (failed) => ({ failed });

test("rep score full / deduct / floor", () => {
  assert.equal(repScore(r([])), 100);
  assert.equal(repScore(r(["depth"])), 75);
  assert.equal(repScore(r(["depth", "knee"])), 50);
  assert.equal(repScore(r(["elbow", "depth", "back", "knee"])), 0);
});
test("session score mean", () => {
  assert.equal(sessionScore([r([]), r(["depth"])]), 87.5);
});

const S = () => ([
  { sessionId: "a", avgScore: 90, repsCompleted: 10 },
  { sessionId: "b", avgScore: 90, repsCompleted: 15 },
  { sessionId: "c", avgScore: 95, repsCompleted: 5 }
]);
test("rank by score then reps", () => {
  assert.deepEqual(rank(S()).map(x => x.sessionId), ["c", "b", "a"]);
});
test("top n", () => {
  assert.deepEqual(top(S(), 2).map(x => x.sessionId), ["c", "b"]);
});

test("selectSide picks higher visibility", () => {
  const raw = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  for (const i of [12, 14, 16, 24, 26, 28]) raw[i] = { x: 0.6, y: 0.5, visibility: 0.9 };
  const { landmarks, side } = selectSide(raw);
  assert.equal(side, "right");
  assert.equal(landmarks.shoulder.x, 0.6);
});
