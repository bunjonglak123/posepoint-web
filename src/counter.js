// state machine นับ rep — พอร์ตตรงจาก Python counter.py
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
      const m = this._finalize();
      this._buf = [];
      if (m.valid) { this.count += 1; m.index = this.count; return m; }
      return null;   // ไหล่ไม่ขยับ = งอแขนหลอก ไม่ใช่ push-up จริง -> ไม่นับ
    }
    return null;
  }

  _finalize() {
    const el = this._buf.map(x => x.elbowAngle);
    const ws = this._buf.map(x => x.wsd);
    const sy = this._buf.map(x => x.shoulderY);
    const arm = Math.max(...this._buf.map(x => x.armLen));
    const travel = Math.max(...sy) - Math.min(...sy);
    const valid = arm > 0 && travel >= this.cfg.MIN_TRAVEL_RATIO * arm;
    // C4/C5 ใช้ข้อต่อล่าง — รวมเฉพาะเฟรมที่ lowerVis เพียงพอ
    const lower = this._buf.filter(x => x.lowerVis >= this.cfg.MIN_VISIBILITY);
    const backMin = lower.length ? Math.min(...lower.map(x => x.backAngle)) : null;
    const kneeMin = lower.length ? Math.min(...lower.map(x => x.kneeAngle)) : null;
    return {
      index: this.count, valid,
      elbowMin: Math.min(...el), elbowMax: Math.max(...el),
      wsdMin: Math.min(...ws), wsdMax: Math.max(...ws),
      backMin, kneeMin
    };
  }
}
