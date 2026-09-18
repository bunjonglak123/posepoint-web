import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repFeatureVector, FEATURE_NAMES } from "../src/repFeatures.js";
import { predictIncorrectProba, validateModel } from "../src/mlModel.js";

const model = JSON.parse(readFileSync(new URL("../model/pushup_rf.json", import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL("./fixtures/ml_parity.json", import.meta.url)));
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test("feature names ตรงกับไฟล์โมเดล", () => {
  assert.deepEqual(model.feature_names, FEATURE_NAMES);
  assert.equal(FEATURE_NAMES.length, 26);
});

test("repFeatureVector ตรงกับ Python ทุกค่า", () => {
  for (const s of fixture) {
    const x = repFeatureVector(s.frames);
    x.forEach((v, i) => assert.ok(close(v, s.features[i], 1e-9), `${FEATURE_NAMES[i]}: js=${v} py=${s.features[i]}`));
  }
});

test("predictIncorrectProba ตรงกับ sklearn predict_proba", () => {
  for (const s of fixture) {
    assert.ok(close(predictIncorrectProba(model, s.features), s.p_incorrect, 1e-5));
    assert.ok(close(predictIncorrectProba(model, repFeatureVector(s.frames)), s.p_incorrect, 1e-5));
  }
});

test("validateModel ปฏิเสธไฟล์โมเดลที่คุณลักษณะไม่ตรง", () => {
  assert.doesNotThrow(() => validateModel(model));
  assert.throws(() => validateModel({ ...model, feature_names: ["x"] }));
  assert.throws(() => validateModel({ ...model, trees: [] }));
});

test("repFeatureVector ปฏิเสธครั้งที่ไม่มีเฟรม", () => {
  assert.throws(() => repFeatureVector([]));
});
