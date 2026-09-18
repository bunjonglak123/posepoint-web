// ให้คะแนน — พอร์ตตรงจาก Python scoring.py
// ถ้าครั้งนั้นตัดสินด้วยโมเดล ML จะมี result.score (0–100 จากความน่าจะเป็น) ให้ใช้ค่านั้นแทน
export function repScore(result, perFault = 25) {
  if (typeof result.score === "number") return result.score;
  return Math.max(0, 100 - perFault * result.failed.length);
}

export function sessionScore(results) {
  if (!results.length) return 0;
  return results.reduce((s, r) => s + repScore(r), 0) / results.length;
}
