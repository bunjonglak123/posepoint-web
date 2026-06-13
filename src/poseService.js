// ห่อ MediaPipe Tasks Web (Pose Landmarker) — on-device ในเบราว์เซอร์ (WASM/GPU)
import { FilesetResolver, PoseLandmarker }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

let landmarker = null;

export async function initPose() {
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      // โมเดล lite = เบาสุด เหมาะ real-time มือถือ
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1
  });
  return landmarker;
}

// videoEl: <video>, timestampMs: number -> array ของ 33 landmark {x,y,z,visibility} หรือ null
export function detect(videoEl, timestampMs) {
  if (!landmarker) return null;
  const res = landmarker.detectForVideo(videoEl, timestampMs);
  if (!res.landmarks || res.landmarks.length === 0) return null;
  // ใช้ worldLandmarks ไม่ได้สำหรับมุมภาพ 2D — ใช้ normalized landmarks (x,y in 0..1)
  return res.landmarks[0];
}
