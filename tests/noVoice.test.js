import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// ผู้ใช้ไม่ต้องการเสียงพูดสังเคราะห์ (ฟังไม่เป็นธรรมชาติ) — แจ้งเตือนด้วยแบนเนอร์บนจอ + เสียงบี๊บเท่านั้น
test("the app never uses speech synthesis", () => {
  const src = new URL("../src/", import.meta.url);
  for (const f of readdirSync(src).filter(n => n.endsWith(".js"))) {
    const code = readFileSync(new URL(f, src), "utf8");
    assert.ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(code), `${f} ยังเรียกใช้เสียงพูด`);
  }
});
