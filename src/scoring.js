// ให้คะแนน — พอร์ตตรงจาก Python scoring.py
export function repScore(result, perFault = 25) {
  return Math.max(0, 100 - perFault * result.failed.length);
}

export function sessionScore(results) {
  if (!results.length) return 0;
  return results.reduce((s, r) => s + repScore(r), 0) / results.length;
}
