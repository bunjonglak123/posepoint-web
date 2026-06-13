// MediaPipe Pose (BlazePose) 33-landmark index — เหมือน Python mediapipe.solutions.pose
export const LEFT  = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
export const RIGHT = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };
const NAMES = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];

// raw: array ของ {x,y,(z),visibility} ความยาว 33 (จาก PoseLandmarker)
// คืน { landmarks: {shoulder:{x,y,visibility},...}, side: "left"|"right" }
export function selectSide(raw) {
  const visL = Object.values(LEFT).reduce((s, i) => s + (raw[i]?.visibility ?? 0), 0);
  const visR = Object.values(RIGHT).reduce((s, i) => s + (raw[i]?.visibility ?? 0), 0);
  const [side, table] = visR >= visL ? ["right", RIGHT] : ["left", LEFT];
  const landmarks = {};
  for (const nm of NAMES) {
    const p = raw[table[nm]];
    landmarks[nm] = { x: p.x, y: p.y, visibility: p.visibility ?? 1 };
  }
  return { landmarks, side };
}
