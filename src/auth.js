// ห่อ Firebase Auth + Firestore (lazy CDN import). local-first: ถ้าไม่ตั้งค่า config = no-op
import { FIREBASE_CONFIG, isConfigured } from "./firebase-config.js";

const V = "10.12.2";
let auth = null, db = null, m = null, inited = false;

export { isConfigured };

export async function init() {
  if (inited || !isConfigured()) return inited;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);
  m = { ...authMod, ...fsMod };
  inited = true;
  return true;
}

export function onAuth(cb) { if (inited) m.onAuthStateChanged(auth, cb); }
export async function signUp(email, pass) { await init(); return m.createUserWithEmailAndPassword(auth, email, pass); }
export async function signIn(email, pass) { await init(); return m.signInWithEmailAndPassword(auth, email, pass); }
export async function signOutUser() { if (inited) return m.signOut(auth); }
export function currentUser() { return inited && auth ? auth.currentUser : null; }

// เก็บสถิติที่ดีที่สุดของผู้ใช้ลง Firestore (doc = uid) — เลี่ยง composite index
export async function pushLeaderboard(entry) {
  if (!inited || !auth.currentUser) return;
  const u = auth.currentUser;
  await m.setDoc(m.doc(db, "leaderboard", u.uid),
    { user: u.email, ...entry, updatedAt: Date.now() }, { merge: true });
}

export async function fetchLeaderboard() {
  if (!inited) return [];
  const snap = await m.getDocs(m.collection(db, "leaderboard"));
  return snap.docs.map(d => d.data());
}
