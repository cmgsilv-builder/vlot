"use strict";
/* Vlot service worker — cache the app shell so it opens offline.
   Bump CACHE when you change any shell file. */
const CACHE = "vlot-shell-v21";
const SHELL = [
  ".",
  "index.html",
  "css/app.css",
  "js/fsrs.js",
  "js/curriculum.js",
  "js/inburgering.js",
  "js/db.js",
  "js/tts.js",
  "js/images.js",
  "js/speech.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon.svg",
];

self.addEventListener("install", (e) => {
  // cache:"reload" so we never seed the cache from a stale HTTP-cached copy
  const reqs = SHELL.map((u) => new Request(u, { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(reqs)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch cross-origin calls (image search / speech) — straight to network.
  if (url.origin !== self.location.origin) return;
  // Network-first: always get the newest code when online; cache it as we go.
  // cache:"reload" bypasses the browser's HTTP cache so a dev server with no
  // Cache-Control headers can't feed us a stale file. Fall back to our cache
  // (then index.html) only when offline.
  e.respondWith(
    fetch(new Request(req.url, { cache: "reload" }))
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
