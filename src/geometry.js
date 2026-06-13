// คณิตเรขา — พอร์ตตรงจาก Python geometry.py
export function angle3pt(a, b, c) {
  // มุม (องศา) ที่จุด b ระหว่างเวกเตอร์ b->a และ b->c
  const bax = a.x - b.x, bay = a.y - b.y;
  const bcx = c.x - b.x, bcy = c.y - b.y;
  const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (mag === 0) return 0;
  let cos = (bax * bcx + bay * bcy) / mag;
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function verticalDistance(a, b) {
  return Math.abs(a.y - b.y);
}
