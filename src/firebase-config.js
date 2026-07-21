// ค่า Firebase (public client config — ปลอดภัยที่จะอยู่ใน repo).
// auth.js จะ initializeApp เอง — ที่นี่ export แค่ config + ตัวเช็คว่าตั้งค่าแล้ว
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAN93ray-KFgoPXV1NDLC85xeBLBupN830",
  authDomain: "posepoint.firebaseapp.com",
  projectId: "posepoint",
  storageBucket: "posepoint.firebasestorage.app",
  messagingSenderId: "1021637377342",
  appId: "1:1021637377342:web:080bf3f4847f6446dc406f",
  measurementId: "G-HSB00W3ZWZ"
};

// เปิดฟีเจอร์ account/cloud เมื่อกรอกคีย์จริง (ไม่ใช่ placeholder)
export function isConfigured() {
  const k = FIREBASE_CONFIG.apiKey;
  return !!k && !k.startsWith("REPLACE") && !k.startsWith("YOUR_");
}
