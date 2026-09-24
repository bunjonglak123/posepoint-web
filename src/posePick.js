// เลือก "คนที่กำลังวิดพื้น" เมื่อกล้องเห็นหลายคน (เช่น ในฟิตเนสมีคนยืนอยู่ด้านหลัง)
// ถ้าเลือกคนแรกที่ตัวตรวจจับคืนมาเฉย ๆ ระบบจะกระโดดไปจับคนที่ยืน แล้วนับเป็นครั้งปลอม
//
// คะแนนของแต่ละคน:
//   1) ลำตัวแนวนอน — วิดพื้นลำตัวขนานพื้น คนยืนลำตัวตั้งฉาก (น้ำหนักมากสุด)
//   2) ความต่อเนื่อง — อยู่ใกล้ตำแหน่งสะโพกของคนที่เลือกไว้ในเฟรมก่อน (กันสลับไปมา)
//   3) ขนาดตัว — คนที่ใกล้กล้อง (ตัวใหญ่) มักเป็นผู้ใช้
const SH = [11, 12], HIP = [23, 24], ANK = [27, 28];

const mid = (pose, [a, b]) => ({ x: (pose[a].x + pose[b].x) / 2, y: (pose[a].y + pose[b].y) / 2 });

// ปลายลำตัว: ใช้ข้อเท้าถ้ามองเห็น ไม่งั้นใช้สะโพก (กรณีกล้องเห็นแค่ท่อนบน)
const vis = (pose, idx) => Math.min(...idx.map(i => pose[i].visibility ?? 1));
const bodyEnd = pose => (vis(pose, ANK) >= 0.5 ? mid(pose, ANK) : mid(pose, HIP));

// aspect = กว้าง/สูง ของภาพ — พิกัดเป็นสัดส่วน 0..1 ต้องแปลงกลับเป็นสัดส่วนพิกเซลก่อนดูมุม
export function horizontalness(pose, aspect = 1) {
  const s = mid(pose, SH), a = bodyEnd(pose);
  const dx = Math.abs(a.x - s.x) * aspect, dy = Math.abs(a.y - s.y);
  return dx + dy > 0 ? dx / (dx + dy) : 0;      // 1 = แนวนอน, 0 = แนวตั้ง
}

export function bodySize(pose, aspect = 1) {
  const s = mid(pose, SH), a = mid(pose, ANK);
  return Math.hypot((a.x - s.x) * aspect, a.y - s.y);
}

export function hipOf(pose) { return mid(pose, HIP); }

// poses: array ของคน (แต่ละคน 33 จุด), prevHip: {x,y} ของคนที่เลือกเฟรมก่อน (หรือ null)
// minFlat: ลำตัวต้องเอียงเข้าใกล้แนวนอนอย่างน้อยเท่านี้ ไม่งั้นไม่ใช่ท่าวิดพื้น
//   (เฟรมที่ตัวตรวจจับเจอแต่คนยืน ต้องทิ้ง ไม่งั้นจะนับเป็นครั้งปลอม)
// คืน index ของคนที่เลือก (-1 ถ้าไม่มีใครอยู่ในท่าวิดพื้น)
export function pickPoseIndex(poses, aspect = 1, prevHip = null, minFlat = 0, w = { flat: 2, near: 3, size: 1 }) {
  if (!poses || !poses.length) return -1;
  let best = -1, bestScore = -Infinity;
  poses.forEach((p, i) => {
    if (horizontalness(p, aspect) < minFlat) return;
    let score = w.flat * horizontalness(p, aspect) + w.size * bodySize(p, aspect);
    if (prevHip) {
      const h = hipOf(p);
      score -= w.near * Math.hypot((h.x - prevHip.x) * aspect, h.y - prevHip.y);
    }
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}
