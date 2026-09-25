// ด่าน "เข้าท่าเตรียม" ก่อนเริ่มนับ
//
// ปัญหา: หลังกด "เริ่มกล้อง" ผู้ใช้ยังต้องวางมือถือ เดินไป แล้วลงไปที่พื้น ท่าระหว่างนั้น
// (ก้มตัว คุกเข่า เอามือยันพื้น) ทำให้ศอกงอ/เหยียดพร้อมไหล่เลื่อนขึ้นลง ตัวนับแบบรอบจึงนับเป็นครั้ง
// แก้: ตัวนับยังไม่รับเฟรมจนกว่าจะเห็นท่าบนของวิดพื้นต่อเนื่อง READY_MS
//   - แขนเหยียด: ศอก >= READY_ELBOW
//   - ลำตัวตรง: มุมไหล่–สะโพก–เข่า >= READY_BACK (ตอนก้มวาง/นั่งคุกเข่า สะโพกหักพับ ~90°)
//     ตรวจเฉพาะเมื่อเห็นช่วงล่าง ไม่งั้นข้าม (ผู้ใช้ที่ถ่ายแค่ท่อนบนยังใช้งานได้)
//   - (ตัวเลือก) ไหล่นิ่ง: READY_STILL × ความยาวแขน — null = ไม่ตรวจ
//     ข้อมูลจริงพบว่าคนส่วนใหญ่เริ่มวิดทันทีโดยไม่ค้างท่าบน การบังคับให้นิ่งทำให้ด่านเปิดตอนท้ายคลิป
// ถ้าคนหายจากภาพ (ไม่มีท่าวิดพื้นในเฟรม) นานเกิน READY_RESET_MS -> ต้องเข้าท่าเตรียมใหม่
// ลำตัวแนวนอนตรวจแล้วที่ขั้นเลือกคน (posePick, MIN_BODY_FLAT) — เฟรมที่ยืนอยู่จะมาเป็น miss()

const frames = (ms, fps) => Math.max(1, Math.ceil((ms / 1000) * fps));

export class ReadyGate {
  constructor(cfg, fps) {
    this.cfg = cfg;
    this.need = frames(cfg.READY_MS, fps);
    this.resetAfter = frames(cfg.READY_RESET_MS, fps);
    this.armed = false;
    this.run = [];          // ไหล่ (shoulderY) ของเฟรมท่าบนที่ต่อเนื่องกัน
    this.misses = 0;
  }

  // เฟรมที่ไม่มีคนอยู่ในท่าวิดพื้น (ไม่เจอคน / ลำตัวตั้ง / มองไม่เห็นแขน)
  miss() {
    this.misses += 1;
    this.run = [];
    if (this.armed && this.misses >= this.resetAfter) this.armed = false;
  }

  // เฟรมนี้เป็นท่าบนของวิดพื้นหรือไม่
  isTop(f) {
    const { READY_ELBOW, READY_BACK, MIN_VISIBILITY } = this.cfg;
    if (f.elbowAngle < READY_ELBOW) return false;
    if (READY_BACK != null && f.lowerVis >= MIN_VISIBILITY && f.backAngle < READY_BACK) return false;
    return true;
  }

  // คืน true = ส่งเฟรมนี้เข้าตัวนับได้. ตอนเพิ่งผ่านด่าน จะล้างสถานะรอบของตัวนับ
  // เพื่อไม่ให้เฟรมช่วงเตรียมตัวค้างอยู่ในครั้งแรก
  push(f, counter) {
    this.misses = 0;
    if (this.armed) return true;
    if (!this.isTop(f)) { this.run = []; return false; }
    this.run.push(f.shoulderY);
    if (this.run.length > this.need) this.run.shift();
    if (this.run.length < this.need) return false;
    const still = this.cfg.READY_STILL;
    if (still != null && Math.max(...this.run) - Math.min(...this.run) > still * f.armLen) return false;
    this.armed = true;
    this.run = [];
    if (counter && counter.resetCycle) counter.resetCycle();
    return true;
  }
}
