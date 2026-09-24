import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPoseIndex, horizontalness } from "../src/posePick.js";

// สร้างคน 33 จุดจากตำแหน่งไหล่/สะโพก/ข้อเท้า (จุดอื่นไม่ใช้ในการเลือก)
function person({ sh, hip, ank }) {
  const p = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 1 }));
  for (const i of [11, 12]) p[i] = { x: sh[0], y: sh[1], visibility: 1 };
  for (const i of [23, 24]) p[i] = { x: hip[0], y: hip[1], visibility: 1 };
  for (const i of [27, 28]) p[i] = { x: ank[0], y: ank[1], visibility: 1 };
  return p;
}
const pushup = person({ sh: [0.25, 0.55], hip: [0.45, 0.58], ank: [0.7, 0.62] });   // ลำตัวแนวนอน
const standing = person({ sh: [0.35, 0.15], hip: [0.36, 0.4], ank: [0.37, 0.7] });  // คนยืนด้านหลัง

test("เลือกคนที่ลำตัวแนวนอน ไม่ใช่คนที่ยืน", () => {
  assert.equal(pickPoseIndex([standing, pushup], 16 / 9), 1);
  assert.equal(pickPoseIndex([pushup, standing], 16 / 9), 0);
});

test("มีคนเดียว -> ใช้คนนั้นเสมอ (พฤติกรรมเดิม)", () => {
  assert.equal(pickPoseIndex([standing], 16 / 9), 0);
  assert.equal(pickPoseIndex([], 16 / 9), -1);
});

test("สองคนแนวนอนเหมือนกัน -> เลือกคนที่อยู่ใกล้ตำแหน่งเดิม", () => {
  const other = person({ sh: [0.05, 0.3], hip: [0.2, 0.32], ank: [0.4, 0.35] });
  assert.equal(pickPoseIndex([other, pushup], 16 / 9, { x: 0.45, y: 0.58 }), 1);
  assert.equal(pickPoseIndex([pushup, other], 16 / 9, { x: 0.2, y: 0.32 }), 1);
});

test("เห็นแต่คนยืน -> ไม่เลือกใครเลย (ทิ้งเฟรม ไม่ให้นับครั้งปลอม)", () => {
  assert.equal(pickPoseIndex([standing], 16 / 9, null, 0.5), -1);
  assert.equal(pickPoseIndex([standing, pushup], 16 / 9, null, 0.5), 1);
  assert.equal(pickPoseIndex([pushup], 16 / 9, null, 0.5), 0);
});

test("ไม่เห็นข้อเท้า -> ดูแนวลำตัวจากไหล่ถึงสะโพกแทน", () => {
  const upper = person({ sh: [0.3, 0.5], hip: [0.6, 0.55], ank: [0.5, 0.99] });
  for (const i of [27, 28]) upper[i].visibility = 0.1;          // ข้อเท้าหลุดกรอบ
  assert.ok(horizontalness(upper, 16 / 9) > 0.8);
});

test("คิดสัดส่วนภาพ: ภาพแนวนอนทำให้ลำตัวดูเอียงน้อยลง", () => {
  const tilted = person({ sh: [0.3, 0.4], hip: [0.4, 0.5], ank: [0.5, 0.6] });
  assert.ok(horizontalness(tilted, 16 / 9) > horizontalness(tilted, 9 / 16));
});
