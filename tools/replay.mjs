/* เล่นซ้ำผลตรวจจับดิบแบบออฟไลน์ ด้วยโมดูลชุดเดียวกับแอป (เลือกคน -> กรอง -> นับ -> เกณฑ์)
 *
 * ทำไม: รันตัวตรวจจับในเบราว์เซอร์ใช้เวลาเป็นชั่วโมง แต่ขั้นหลังจากนั้นเป็นโค้ด JS ล้วน
 * จึงเก็บผลตรวจจับดิบครั้งเดียว (extract_web.mjs --raw) แล้วลองค่าตั้งต่าง ๆ ที่นี่ได้ในไม่กี่วินาที
 * ผลที่ได้ตรงกับที่แอปจริงจะให้ เพราะเรียกฟังก์ชันเดียวกันตามลำดับเดียวกับ processFrame ใน app.js
 *
 * usage:
 *   node tools/replay.mjs <web_raw.json ...> [--smooth-ms 200] [--min-flat 0.5] [--count-down 90] [--single]
 *        [--truth rep_counts.json] [--grid] [--out-dir <dir>]
 *   --single      จำลองพฤติกรรมเดิม (ใช้คนแรกที่ตรวจเจอ ไม่เลือกคน ไม่กรองท่ายืน)
 *   --count-down  มุมศอกที่ถือว่า "ลงแล้ว" สำหรับการนับเท่านั้น (เกณฑ์ตัดสินท่ายังใช้ ELBOW_DOWN เดิม)
 *   --truth       จำนวนครั้งที่คนนับด้วยตา {"<ชุด>|<คลิป>": {n}} -> รายงานความแม่นยำการนับ
 *   --grid        ค้นหาค่าตั้งที่นับตรงที่สุด พร้อมประเมินแบบ leave-one-clip-out (กันเลือกค่าเข้าข้างตัวเอง)
 *   --out-dir     เขียน web_seqs.json (รูปแบบเดียวกับ extract_web.mjs) ของแต่ละชุดลงโฟลเดอร์ results ของชุดนั้น
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { selectSide } from "../src/landmarks.js";
import { pickPoseIndex, hipOf } from "../src/posePick.js";
import { FeatureSmoother, windowFrames } from "../src/smooth.js";
import { computeFeatures } from "../src/features.js";
import { RepCounter, CycleCounter } from "../src/counter.js";
import { evaluateRep } from "../src/criteria.js";
import { ReadyGate } from "../src/readyGate.js";
import { CONFIG } from "../src/config.js";

const expand = compact => {           // {index: [x, y, vis]} -> array 33 จุดแบบที่ MediaPipe คืนมา
  const p = new Array(33);
  for (const [i, [x, y, v]] of Object.entries(compact)) p[+i] = { x, y, visibility: v };
  return p;
};

export const DEFAULTS = { smoothMs: CONFIG.SMOOTH_MS, minFlat: CONFIG.MIN_BODY_FLAT, countDown: CONFIG.ELBOW_DOWN, single: false,
                          mode: CONFIG.COUNT_MODE || "abs", delta: CONFIG.CYCLE_DELTA ?? 25, travel: CONFIG.MIN_TRAVEL_RATIO,
                          ready: true };   // ready = ด่านท่าเตรียมก่อนเริ่มนับ (เหมือนแอป)

export function replayClip(clip, s = DEFAULTS) {
  const aspect = clip.width / clip.height || 1;
  const smoother = new FeatureSmoother(windowFrames(s.smoothMs, clip.fps));
  const cfg = { ...CONFIG, ELBOW_DOWN: s.countDown, CYCLE_DELTA: s.delta, MIN_TRAVEL_RATIO: s.travel };
  const counter = s.mode === "cycle" ? new CycleCounter(cfg) : new RepCounter(cfg);
  const gate = s.ready ? new ReadyGate(cfg, clip.fps) : null;
  let prevHip = null;
  const reps = [];
  for (const fr of clip.raw) {
    const poses = fr.poses.map(expand);
    // ลำดับเดียวกับ processFrame ใน app.js
    const pick = s.single ? (poses.length ? 0 : -1) : pickPoseIndex(poses, aspect, prevHip, s.minFlat);
    if (pick < 0) { if (gate) gate.miss(); continue; }
    const raw = poses[pick];
    prevHip = hipOf(raw);
    const { landmarks } = selectSide(raw);
    const core = Math.min(landmarks.shoulder.visibility, landmarks.elbow.visibility, landmarks.wrist.visibility);
    if (core < CONFIG.MIN_VISIBILITY) { if (gate) gate.miss(); continue; }
    const f = smoother.push(computeFeatures(landmarks));
    f.t = fr.t;
    f.lm = Object.fromEntries(Object.entries(landmarks).map(([k, p]) => [k, [p.x, p.y, p.visibility]]));
    if (gate && !gate.push(f, counter)) continue;
    const m = counter.update(f);
    if (m) {
      const res = evaluateRep(m, CONFIG);          // ตัดสินด้วยเกณฑ์เดิมเสมอ ไม่ขึ้นกับค่าตั้งการนับ
      reps.push({ rule: res.verdict, failed: res.failed, seq: m.frames });
    }
  }
  return reps;
}

// ความแม่นยำการนับเทียบเฉลย: MAE, ตรงเป๊ะ, ผิดไม่เกิน 1, นับได้กี่ % ของครั้งจริง, นับเกินกี่ %
export function countScore(rows) {
  const err = rows.map(r => r.got - r.want);
  const want = rows.reduce((s, r) => s + r.want, 0);
  return {
    clips: rows.length,
    mae: err.reduce((s, e) => s + Math.abs(e), 0) / rows.length,
    exact: err.filter(e => e === 0).length,
    within1: err.filter(e => Math.abs(e) <= 1).length,
    recall: rows.reduce((s, r) => s + Math.min(r.got, r.want), 0) / want,
    overcount: rows.reduce((s, r) => s + Math.max(0, r.got - r.want), 0) / want
  };
}

const settingName = s => s.single ? "แบบเดิม (คนแรกที่เจอ)" : `เลือกคน · กรอง ${s.smoothMs}ms · ` +
  (s.mode === "cycle" ? `นับตามรอบ Δ${s.delta}°` : `มุมคงที่ ลง<${s.countDown}° ขึ้น>${CONFIG.ELBOW_UP}°`) + ` · ไหล่≥${s.travel}×แขน`;

if (process.argv[1] && process.argv[1].endsWith("replay.mjs")) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const flag = k => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
  const s = { smoothMs: +opt("--smooth-ms", DEFAULTS.smoothMs), minFlat: +opt("--min-flat", DEFAULTS.minFlat),
              countDown: +opt("--count-down", DEFAULTS.countDown), mode: opt("--mode", DEFAULTS.mode),
              delta: +opt("--delta", DEFAULTS.delta), travel: +opt("--travel", DEFAULTS.travel), single: flag("--single"),
              ready: !flag("--no-ready") };
  const TRUTH = opt("--truth", null), OUT_DIR = flag("--out-dir"), GRID = flag("--grid");
  const sets = args.map(p => ({ path: p, tag: basename(dirname(dirname(p))), clips: JSON.parse(readFileSync(p, "utf8")) }));
  const truth = TRUTH ? JSON.parse(readFileSync(TRUTH, "utf8")) : {};
  const truthClips = sets.flatMap(d => d.clips.filter(c => `${d.tag}|${c.clip}` in truth)
    .map(c => ({ key: `${d.tag}|${c.clip}`, clip: c, want: truth[`${d.tag}|${c.clip}`].n })));

  const evalSetting = st => truthClips.map(t => ({ key: t.key, got: replayClip(t.clip, st).length, want: t.want }));

  if (GRID) {
    const base = { ...DEFAULTS, minFlat: 0.5, single: false };
    const grid = [{ ...DEFAULTS, mode: "abs", countDown: 90, travel: 0.4, single: true, smoothMs: 0 }];
    for (const smoothMs of [0, 100, 200]) for (const travel of [0.2, 0.3, 0.4]) {
      for (const countDown of [90, 110, 120, 130, 140]) grid.push({ ...base, mode: "abs", smoothMs, travel, countDown });
      for (const delta of [15, 20, 25, 30, 40]) grid.push({ ...base, mode: "cycle", smoothMs, travel, delta });
    }
    const table = grid.map(st => ({ st, rows: evalSetting(st) }));
    table.forEach(t => (t.score = countScore(t.rows)));
    table.sort((a, b) => a.score.mae - b.score.mae);
    console.log(`เฉลย ${truthClips.length} คลิป · ค่าตั้ง ${grid.length} แบบ · 8 อันดับแรก (MAE ต่ำ = นับตรง):`);
    for (const t of table.slice(0, 8)) console.log(`  MAE ${t.score.mae.toFixed(2)} · ตรง ${t.score.exact} · ±1 ${t.score.within1} · นับได้ ${(t.score.recall * 100).toFixed(0)}% · เกิน ${(t.score.overcount * 100).toFixed(0)}%  ${settingName(t.st)}`);
    const old = table.find(t => t.st.single);
    console.log(`  (แบบเดิม: MAE ${old.score.mae.toFixed(2)} · นับได้ ${(old.score.recall * 100).toFixed(0)}% · เกิน ${(old.score.overcount * 100).toFixed(0)}%)`);
    // leave-one-clip-out: เลือกค่าตั้งจากคลิปอื่น แล้ววัดกับคลิปที่กันไว้ — ตัวเลขที่รายงานได้อย่างซื่อตรง
    const loo = truthClips.map((_, i) => {
      const best = table.filter(t => !t.st.single).map(t => ({ t, mae: t.rows.filter((_, j) => j !== i).reduce((s, r) => s + Math.abs(r.got - r.want), 0) }))
        .sort((a, b) => a.mae - b.mae)[0].t;
      return best.rows[i];
    });
    const ls = countScore(loo);
    console.log(`leave-one-clip-out (ค่าที่รายงานได้): MAE ${ls.mae.toFixed(2)} · ตรง ${ls.exact}/${ls.clips} · ±1 ${ls.within1}/${ls.clips} · นับได้ ${(ls.recall * 100).toFixed(0)}% · เกิน ${(ls.overcount * 100).toFixed(0)}%`);
    writeFileSync(join(dirname(TRUTH), "count_grid.json"), JSON.stringify({
      truth_clips: truthClips.length, best: { setting: table[0].st, score: table[0].score, rows: table[0].rows },
      old: { score: old.score, rows: old.rows }, loo: ls,
      top: table.slice(0, 10).map(t => ({ setting: t.st, score: t.score }))
    }, null, 1));
  } else {
    console.log(`ตั้งค่า: ${settingName(s)}`);
    for (const d of sets) {
      const out = d.clips.map(c => ({ clip: c.clip, truth: c.truth, duration: c.duration, fps: c.fps, reps: replayClip(c, s) }));
      const total = out.reduce((a, c) => a + c.reps.length, 0);
      console.log(`${d.tag}: คลิป ${out.length} · ครั้งที่นับได้ ${total} · คลิปที่ไม่มีครั้ง ${out.filter(c => !c.reps.length).length}`);
      if (OUT_DIR) { const p = join(dirname(d.path), "web_seqs.json"); writeFileSync(p, JSON.stringify(out)); console.log("  เขียน", p); }
    }
    if (truthClips.length) {
      const rows = evalSetting(s), sc = countScore(rows);
      console.log(`เทียบเฉลย ${sc.clips} คลิป: MAE ${sc.mae.toFixed(2)} · ตรง ${sc.exact} · ±1 ${sc.within1} · นับได้ ${(sc.recall * 100).toFixed(0)}% · เกิน ${(sc.overcount * 100).toFixed(0)}%`);
      for (const r of rows) console.log(`  ${r.got - r.want >= 0 ? "+" : ""}${r.got - r.want}  ได้ ${r.got} / จริง ${r.want}  ${r.key}`);
    }
  }
}
