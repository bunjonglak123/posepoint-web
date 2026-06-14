// service worker ขั้นต่ำ — cache app shell ให้ทำงานออฟไลน์ (PWA)
const CACHE = "posepoint-v2";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "icon.svg",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "src/app.js", "src/config.js", "src/geometry.js", "src/landmarks.js",
  "src/features.js", "src/counter.js", "src/criteria.js", "src/scoring.js",
  "src/leaderboard.js", "src/poseService.js", "src/store.js"
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
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
