/* ความแม่นยำการนับของค่าตั้งที่แอปใช้จริง (CONFIG) เทียบจำนวนที่คนนับด้วยตา -> JSON ทาง stdout
 * เทียบกับแบบเดิม (คนแรกที่ตรวจเจอ · ศอก <90 แล้ว >150 · ไม่กรอง) บนคลิปชุดเดียวกัน
 * usage: node tools/count_eval.mjs <rep_counts.json> <web_raw.json ...>
 */
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { replayClip, countScore, DEFAULTS } from "./replay.mjs";

const [truthPath, ...raws] = process.argv.slice(2);
const truth = JSON.parse(readFileSync(truthPath, "utf8"));
const clips = raws.flatMap(p => {
  const tag = basename(dirname(dirname(p)));
  return JSON.parse(readFileSync(p, "utf8")).map(c => ({ key: `${tag}|${c.clip}`, c })).filter(x => x.key in truth);
});
const OLD = { ...DEFAULTS, mode: "abs", countDown: 90, travel: 0.4, single: true, smoothMs: 0 };
const rows = st => clips.map(({ key, c }) => ({ key, got: replayClip(c, st).length, want: truth[key].n }));
const dep = rows(DEFAULTS);
console.log(JSON.stringify({ setting: DEFAULTS, deployed: countScore(dep), old: countScore(rows(OLD)), rows: dep }));
