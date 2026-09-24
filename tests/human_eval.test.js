import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG } from "../src/config.js";

const h = JSON.parse(readFileSync(new URL("../model/human_eval.json", import.meta.url), "utf8"));

// หน้า model.html แสดงผลจากไฟล์นี้ — เกณฑ์ที่วัดผลต้องเป็นชุดเดียวกับที่แอปใช้จริง
test("rules measured on the model page are the rules the app runs", () => {
  assert.deepEqual(h.judging.rules_setting, CONFIG.RULES);
});
test("exactly one judging method is marked deployed, and it is the calibrated rules", () => {
  const dep = h.judging.rows.filter(r => r.deployed);
  assert.deepEqual(dep.map(r => r.key), ["rules_new"]);
});
test("counting accuracy was measured with the app's counter settings", () => {
  const s = h.counting.setting;
  assert.equal(s.mode, CONFIG.COUNT_MODE);
  assert.equal(s.delta, CONFIG.CYCLE_DELTA);
  assert.equal(s.smoothMs, CONFIG.SMOOTH_MS);
  assert.equal(s.minFlat, CONFIG.MIN_BODY_FLAT);
  assert.equal(s.travel, CONFIG.MIN_TRAVEL_RATIO);
});
