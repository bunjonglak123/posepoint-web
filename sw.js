// service worker ขั้นต่ำ — cache app shell ให้ทำงานออฟไลน์ (PWA)
const CACHE = "posepoint-v30";
const SHELL = [
  "./", "index.html", "model.html", "manifest.webmanifest", "icon.svg",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "src/app.js", "src/i18n.js", "src/config.js", "src/geometry.js", "src/landmarks.js",
  "src/features.js", "src/counter.js", "src/criteria.js", "src/scoring.js",
  "src/leaderboard.js", "src/poseService.js", "src/posePick.js", "src/smooth.js", "src/store.js",
  "src/auth.js", "src/firebase-config.js",
  "src/repFeatures.js", "src/mlModel.js", "src/seqModel.js", "src/judge.js", "model/pushup_ensemble.json", "model/human_eval.json",
  "charts/chart_web_models.png", "charts/chart_web_models_mendeley.png", "charts/chart_threshold.png", "charts/chart_human_counting.png", "charts/chart_human_judging.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // โมเดล/wasm จาก CDN: ไป network ตรง (อย่า cache shell)
  if (url.origin !== location.origin) return;
  // ignoreSearch: หน้าเว็บโหลด app.js?v=11 / i18n.js?v=11 แต่ cache เก็บชื่อไม่มี query
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
