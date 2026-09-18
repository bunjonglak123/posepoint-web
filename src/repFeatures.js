// คุณลักษณะต่อหนึ่งครั้ง (26 ค่า) สำหรับโมเดล ML — ต้องตรงกับ Python rep_features.py (มีเทสต์ parity)
// frames: ฟีเจอร์รายเฟรมจาก computeFeatures() ของครั้งนั้น (RepCounter แนบมาใน m.frames)
const SERIES = ["elbow", "back", "knee", "depth"];
const STATS = ["min", "max", "mean", "std", "p10", "p90"];
export const FEATURE_NAMES = [...SERIES.flatMap(s => STATS.map(st => `${s}_${st}`)), "shoulder_travel", "lower_vis_mean"];

// percentile แบบ numpy (linear interpolation)
function percentile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function stats(v) {
  const n = v.length;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n);   // ddof=0 เหมือน numpy
  const sorted = [...v].sort((a, b) => a - b);
  return [sorted[0], sorted[n - 1], mean, std, percentile(sorted, 0.1), percentile(sorted, 0.9)];
}

export function repFeatureVector(frames) {
  if (!frames || !frames.length) throw new Error("rep ต้องมีอย่างน้อย 1 เฟรม");
  const col = k => frames.map(f => f[k]);
  const arm = percentile([...col("armLen")].sort((a, b) => a - b), 0.5) || 1e-6;
  const series = {
    elbow: col("elbowAngle"), back: col("backAngle"), knee: col("kneeAngle"),
    depth: col("wsd").map(w => w / arm)
  };
  const x = SERIES.flatMap(s => stats(series[s]));
  const sy = col("shoulderY");
  x.push((Math.max(...sy) - Math.min(...sy)) / arm);
  x.push(col("lowerVis").reduce((s, v) => s + v, 0) / frames.length);
  return x;
}
