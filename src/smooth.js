// กรองค่าที่กระโดดผิดปกติด้วยค่ามัธยฐานของเฟรมล่าสุด ก่อนส่งเข้าตัวนับ
// ตัวตรวจจับท่าทางบางเฟรมคืนจุดผิด (เช่น มุมศอก 169° → 6° → 162° ในเฟรมติดกัน)
// ค่าเดียวที่โผล่ผิดปกติทำให้ตัวนับคิดว่า "ลงแล้ว-ขึ้นแล้ว" = นับครั้งปลอม
// มัธยฐานตัดค่าโดดแบบนี้ทิ้งได้ โดยไม่ทำให้การเคลื่อนไหวจริงเพี้ยน (หน่วงราวครึ่งหน้าต่าง)
// หน้าต่างกำหนดเป็นเวลา (ms) แล้วแปลงเป็นจำนวนเฟรมตาม fps — กว้างเกินจะกลบจังหวะลงต่ำสุดของครั้งจริงไปด้วย
const KEYS = ["elbowAngle", "backAngle", "kneeAngle", "wsd", "lowerVis", "shoulderY", "armLen"];

function median(a) {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// จำนวนเฟรมของหน้าต่าง (เลขคี่ อย่างน้อย 1) จากความยาวเป็นมิลลิวินาทีและ fps
export function windowFrames(ms, fps) {
  const n = Math.max(1, Math.round((ms / 1000) * fps));
  return n % 2 ? n : n + 1;
}

export class FeatureSmoother {
  constructor(window = 5) { this.setWindow(window); }

  setWindow(n) { this.window = Math.max(1, n | 0); this.buf = []; }

  reset() { this.buf = []; }

  // f: ฟีเจอร์ต่อเฟรมจาก computeFeatures() -> ฟีเจอร์ที่กรองแล้ว (ฟิลด์อื่นเช่น t, lm ใช้ของเฟรมล่าสุด)
  push(f) {
    this.buf.push(f);
    if (this.buf.length > this.window) this.buf.shift();
    if (this.window === 1) return { ...f };
    const out = { ...f };
    for (const k of KEYS) out[k] = median(this.buf.map(x => x[k]));
    return out;
  }
}
