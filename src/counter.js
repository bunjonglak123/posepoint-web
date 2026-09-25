// ตัวนับครั้งวิดพื้น — สองแบบ ใช้ตัวสรุปค่ารายครั้งร่วมกัน
//
// RepCounter  (แบบเดิม, พอร์ตจาก Python counter.py): นับเมื่อศอก < ELBOW_DOWN แล้ว > ELBOW_UP
//   นับเฉพาะครั้งที่ "ลงลึกและเหยียดสุด" — ครั้งที่ลงไม่สุด/ขึ้นไม่สุดจะหายไปเลย ไม่ถูกประเมิน
// CycleCounter (แบบรอบการเคลื่อนไหว): นับทุกรอบที่ศอกงอลงจากจุดสูงสุดล่าสุดเกิน Δ
//   แล้วเหยียดกลับขึ้นจากจุดต่ำสุดเกิน Δ — ครั้งที่ลงไม่สุดก็ถูกนับ แล้วให้เกณฑ์/โมเดลบอกว่าผิด
// ทั้งสองแบบยังต้องมีไหล่เลื่อนแนวดิ่งจริง (กันงอแขนอยู่กับที่)

export class RepCounter {
  constructor(cfg) {
    this.cfg = cfg;
    this.state = "up";
    this.count = 0;
    this._buf = [];
  }

  // f: ฟีเจอร์ต่อเฟรม. คืน RepMetrics เมื่อจบ rep, ไม่งั้นคืน null
  update(f) {
    this._buf.push(f);
    if (this.state === "up" && f.elbowAngle < this.cfg.ELBOW_DOWN) {
      this.state = "down";
    } else if (this.state === "down" && f.elbowAngle > this.cfg.ELBOW_UP) {
      this.state = "up";
      return this._close();
    }
    return null;
  }

  // เริ่มรอบใหม่ (ไม่ล้างจำนวนครั้ง) — ใช้ตอนเพิ่งผ่านด่านท่าเตรียม
  resetCycle() {
    this.state = "up";
    this._buf = [];
  }

  _close() {
    const m = repMetrics(this._buf, this.cfg, this.count);
    const frames = this._buf;
    this._buf = [];
    // แนบเฟรมของครั้งนี้ให้โมเดล ML สกัดคุณลักษณะ
    if (m.valid) { this.count += 1; m.index = this.count; m.frames = frames; return m; }
    return null;   // ไหล่ไม่ขยับ = งอแขนหลอก ไม่ใช่ push-up จริง -> ไม่นับ
  }
}

export class CycleCounter extends RepCounter {
  constructor(cfg) {
    super(cfg);
    this.peak = -Infinity;          // มุมศอกสูงสุดตั้งแต่จบครั้งก่อน (ท่าบน)
    this.valley = Infinity;         // มุมศอกต่ำสุดของครั้งนี้ (ท่าล่าง)
  }

  resetCycle() {
    super.resetCycle();
    this.peak = -Infinity;
    this.valley = Infinity;
  }

  update(f) {
    this._buf.push(f);
    const e = f.elbowAngle, d = this.cfg.CYCLE_DELTA;
    if (this.state === "up") {
      this.peak = Math.max(this.peak, e);
      if (e < this.peak - d) { this.state = "down"; this.valley = e; }
    } else {
      this.valley = Math.min(this.valley, e);
      if (e > this.valley + d) {
        this.state = "up"; this.peak = e;
        return this._close();
      }
    }
    return null;
  }
}

// เลือกตัวนับตามค่าตั้ง
export const makeCounter = cfg => (cfg.COUNT_MODE === "cycle" ? new CycleCounter(cfg) : new RepCounter(cfg));

// สรุปค่าของหนึ่งครั้งจากเฟรมในช่วงนั้น (ใช้ร่วมกันทั้งสองแบบของตัวนับ)
function repMetrics(buf, cfg, count) {
  const el = buf.map(x => x.elbowAngle);
  const ws = buf.map(x => x.wsd);
  const sy = buf.map(x => x.shoulderY);
  const arm = Math.max(...buf.map(x => x.armLen));
  const travel = Math.max(...sy) - Math.min(...sy);
  const valid = arm > 0 && travel >= cfg.MIN_TRAVEL_RATIO * arm;
  // C4/C5 ใช้ข้อต่อล่าง — รวมเฉพาะเฟรมที่ lowerVis เพียงพอ
  const lower = buf.filter(x => x.lowerVis >= cfg.MIN_VISIBILITY);
  const backMin = lower.length ? Math.min(...lower.map(x => x.backAngle)) : null;
  const kneeMin = lower.length ? Math.min(...lower.map(x => x.kneeAngle)) : null;
  return {
    index: count, valid,
    travelRatio: arm > 0 ? travel / arm : 0,   // ไหล่เลื่อนแนวดิ่ง / ความยาวแขน (ใช้ในเกณฑ์ "ลงไม่สุด")
    elbowMin: Math.min(...el), elbowMax: Math.max(...el),
    wsdMin: Math.min(...ws), wsdMax: Math.max(...ws),
    backMin, kneeMin
  };
}
