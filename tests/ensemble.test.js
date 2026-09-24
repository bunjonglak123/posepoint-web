import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repFeatureVector } from "../src/repFeatures.js";
import { predictIncorrectProba, validateModel } from "../src/mlModel.js";
import { repSequence, seqProbas } from "../src/seqModel.js";
import { judgeRep } from "../src/judge.js";
import { CONFIG } from "../src/config.js";

const model = JSON.parse(readFileSync(new URL("../model/pushup_ensemble.json", import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL("./fixtures/ensemble_parity.json", import.meta.url)));
const close = (a, b, tol) => Math.abs(a - b) <= tol;

test("ไฟล์โมเดลรวมผ่านการตรวจ และมีครบสามโมเดล", () => {
  assert.doesNotThrow(() => validateModel(model));
  assert.deepEqual(model.members, ["rf", "lstm", "cnn"]);
  assert.throws(() => validateModel({ ...model, seq: { ...model.seq, mu: [0] } }));
  assert.throws(() => validateModel({ ...model, lstm: { ...model.lstm, hidden: 7 } }));
});

test("repSequence ตรงกับ rep_sequence ของ Python", () => {
  for (const s of fixture) {
    const seq = repSequence(s.frames, model.seq.len);
    assert.equal(seq.length, s.seq.length);
    seq.forEach((row, t) => row.forEach((v, c) =>
      assert.ok(close(v, s.seq[t][c], 1e-9), `t=${t} c=${c}: js=${v} py=${s.seq[t][c]}`)));
  }
});

test("RF ในไฟล์รวมตรงกับ sklearn", () => {
  for (const s of fixture) {
    assert.ok(close(predictIncorrectProba(model, repFeatureVector(s.frames)), s.p.rf, 1e-5));
  }
});

test("LSTM และ CNN ตรงกับ PyTorch", () => {
  for (const s of fixture) {
    const p = seqProbas(model, s.frames);
    assert.ok(close(p.lstm, s.p.lstm, 1e-4), `lstm js=${p.lstm} torch=${s.p.lstm}`);
    assert.ok(close(p.cnn, s.p.cnn, 1e-4), `cnn js=${p.cnn} torch=${s.p.cnn}`);
  }
});

test("judgeRep ใช้ค่าเฉลี่ยของสามโมเดล", () => {
  for (const s of fixture) {
    const lowerVis = s.frames.reduce((a, f) => a + f.lowerVis, 0) / s.frames.length;
    if (lowerVis < CONFIG.MIN_VISIBILITY) continue;              // ครั้งที่เห็นขาไม่ชัดใช้เกณฑ์เชิงกฎแทน
    const els = s.frames.map(f => f.elbowAngle), wsd = s.frames.map(f => f.wsd);
    const m = { index: 1, valid: true, elbowMin: Math.min(...els), elbowMax: Math.max(...els),
                wsdMin: Math.min(...wsd), wsdMax: Math.max(...wsd), backMin: 170, kneeMin: 170, frames: s.frames };
    const res = judgeRep(m, CONFIG, model, true);
    assert.equal(res.judge, "ml");
    assert.deepEqual(Object.keys(res.members), ["rf", "lstm", "cnn"]);
    assert.ok(close(res.pIncorrect, s.p.mean, 1e-4), `mean js=${res.pIncorrect} py=${s.p.mean}`);
    assert.equal(res.verdict, s.p.mean >= model.threshold ? "INCORRECT" : "CORRECT");
  }
});

test("repSequence รับครั้งที่มีเฟรมเดียว และปฏิเสธครั้งที่ไม่มีเฟรม", () => {
  const f = { elbowAngle: 90, backAngle: 180, kneeAngle: 180, wsd: 0.1, lowerVis: 1, armLen: 0.2 };
  const seq = repSequence([f], 4);
  assert.equal(seq.length, 4);
  assert.deepEqual(seq[0], seq[3]);
  assert.throws(() => repSequence([], 4));
});
