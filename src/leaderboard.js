// จัดอันดับ — พอร์ตตรงจาก Python leaderboard.py
export function rank(sessions) {
  const ordered = [...sessions].sort(
    (a, b) => (b.avgScore - a.avgScore) || (b.repsCompleted - a.repsCompleted)
  );
  ordered.forEach((s, i) => { s.rank = i + 1; });
  return ordered;
}

export function top(sessions, n) {
  return rank(sessions).slice(0, n);
}
