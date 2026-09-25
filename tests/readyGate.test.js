import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadyGate } from "../src/readyGate.js";
import { CycleCounter } from "../src/counter.js";
import { CONFIG } from "../src/config.js";

const FPS = 24;
// ฟีเจอร์ต่อเฟรม: มุมศอก, ตำแหน่งไหล่แนวดิ่ง, ความยาวต้นแขน 0.1
const f = (elbow, sy) => ({ elbowAngle: elbow, wsd: 0.5, backAngle: 170, kneeAngle: 170, lowerVis: 1, shoulderY: sy, armLen: 0.1 });
const hold = (n, elbow = 165, sy = 0.40) => Array.from({ length: n }, () => f(elbow, sy));
// หนึ่งครั้งวิดพื้นจริง: ลง (ศอก 165 -> 80, ไหล่ 0.40 -> 0.55) แล้วขึ้น
const rep = () => [...[165, 140, 110, 80].map((e, i) => f(e, 0.40 + i * 0.05)), ...[110, 140, 165].map((e, i) => f(e, 0.50 - i * 0.05))];
// ช่วงเตรียมตัว: ลงไปที่พื้น — ศอกงอ/เหยียดขึ้นลงพร้อมไหล่เลื่อนมาก แต่ไม่เคยค้างนิ่ง
const setup = () => [165, 120, 90, 130, 170, 100, 150].map((e, i) => f(e, 0.20 + i * 0.06));

// จำลอง processFrame: เฟรมที่ไม่มีคน (null) -> gate.miss(), ไม่งั้นผ่าน gate แล้วค่อยเข้าตัวนับ
function session(frames) {
  const gate = new ReadyGate(CONFIG, FPS), counter = new CycleCounter(CONFIG);
  for (const x of frames) {
    if (x === null) { gate.miss(); continue; }
    if (gate.push(x, counter)) counter.update(x);
  }
  return { gate, counter };
}

test("movement while getting into position is not counted", () => {
  const { counter, gate } = session([...setup(), ...setup()]);
  assert.equal(gate.armed, false);
  assert.equal(counter.count, 0);
});

test("holding the top position still arms the gate, then reps count", () => {
  const { counter, gate } = session([...setup(), ...hold(14), ...rep(), ...rep(), ...rep()]);
  assert.equal(gate.armed, true);
  assert.equal(counter.count, 3);
});

test("setup frames before the hold do not leak into the first rep", () => {
  // ถ้าเฟรมช่วงเตรียมตัวค้างในบัฟเฟอร์ของตัวนับ ครั้งแรกจะเพี้ยน/นับเกิน
  const { counter } = session([...setup(), ...hold(14), ...rep()]);
  assert.equal(counter.count, 1);
});

test("brief straight-arm moments while getting down do not arm", () => {
  // แขนเหยียดสั้นกว่า READY_MS สลับกับงอ (มือแตะพื้นแล้วขยับตัว)
  const short = Math.max(1, Math.ceil((CONFIG.READY_MS / 1000) * FPS) - 1);
  const frames = [];
  for (let k = 0; k < 6; k++) frames.push(...hold(short, 165, 0.3 + k * 0.03), ...hold(3, 100, 0.35 + k * 0.03));
  assert.equal(session(frames).gate.armed, false);
});

test("optional stillness check blocks arming while the body keeps moving", () => {
  const gate = new ReadyGate({ ...CONFIG, READY_STILL: 0.25 }, FPS);
  for (let i = 0; i < 30; i++) gate.push(f(165, 0.30 + (i % 6) * 0.04));
  assert.equal(gate.armed, false);
});

test("optional back-angle check blocks a bent-over body with straight arms", () => {
  const gate = new ReadyGate({ ...CONFIG, READY_BACK: 130 }, FPS);
  for (let i = 0; i < 30; i++) gate.push({ ...f(165, 0.40), backAngle: 90 });
  assert.equal(gate.armed, false);
});

test("bent elbows held still do not arm", () => {
  const { gate } = session(hold(30, 100));
  assert.equal(gate.armed, false);
});

test("losing the person for a while disarms; must hold again before counting", () => {
  const lost = Array.from({ length: Math.ceil((CONFIG.READY_RESET_MS / 1000) * FPS) + 1 }, () => null);
  const { counter, gate } = session([...hold(14), ...rep(), ...lost, ...setup()]);
  assert.equal(counter.count, 1);
  assert.equal(gate.armed, false);
});

test("a short dropout mid-set keeps counting", () => {
  const { counter } = session([...hold(14), ...rep(), null, null, ...rep()]);
  assert.equal(counter.count, 2);
});
