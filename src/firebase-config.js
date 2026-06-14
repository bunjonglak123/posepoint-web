// ใส่ค่าจาก Firebase Console → Project settings → Your apps → Web app (SDK config)
// ถ้าเว้นว่างไว้ แอปทำงานแบบ local ปกติ (ไม่มี account/cloud) — auth จะถูกปิดอัตโนมัติ
export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

export function isConfigured() {
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
