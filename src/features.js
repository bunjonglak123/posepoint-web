import { angle3pt, verticalDistance, distance } from "./geometry.js";

// landmarks: {shoulder,elbow,wrist,hip,knee,ankle} แต่ละตัว {x,y,visibility}
// คืน { elbowAngle, backAngle, kneeAngle, wsd, lowerVis, shoulderY, armLen }
export function computeFeatures(lm) {
  return {
    elbowAngle: angle3pt(lm.shoulder, lm.elbow, lm.wrist),
    backAngle: angle3pt(lm.shoulder, lm.hip, lm.knee),
    kneeAngle: angle3pt(lm.hip, lm.knee, lm.ankle),
    wsd: verticalDistance(lm.wrist, lm.shoulder),
    lowerVis: Math.min(lm.hip.visibility, lm.knee.visibility, lm.ankle.visibility),
    shoulderY: lm.shoulder.y,                  // ตำแหน่งแนวดิ่งของไหล่ (ดูว่าลำตัวขยับจริง)
    armLen: distance(lm.shoulder, lm.elbow)    // สเกลตัว (ความยาวต้นแขน) เพื่อทำ ratio
  };
}
