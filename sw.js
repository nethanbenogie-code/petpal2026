/* PetPal Service Worker — cache-first for full offline support.

   BUMP `CACHE` whenever this asset list or the shape of the app changes.
   Fetches are cache-first and `activate` only deletes caches whose name
   DIFFERS from CACHE, so leaving the name alone pins whatever is already
   stored. After the split into ES modules, every existing install would
   otherwise have gone on serving the old monolithic index.html forever and
   never fetched js/main.js at all. */
const CACHE = "petpal-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./games.html",
  "./battle.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./js/main.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/economy.js",
  "./js/scene.js",
  "./js/petmove.js",
  "./js/media.js",
  "./js/actions.js",
  "./js/chat.js",
  "./js/tricks.js",
  "./js/shop.js",
  "./js/minigames.js",
  "./js/journal.js",
  "./js/shooter.js",
  "./js/menu.js",
  "./js/pet3d.js",
  "./js/rpg.js",
  "./js/battle.js",
  "./js/monsters.js",
  "./js/encounters.js",
  "./js/battleui.js",
  "./js/weapons.js",
  "./js/joystick.js",
  "./js/calendar.js",
  // ~2.1 MB unminified. Precached so the 3D pet survives going offline; if that
  // is too heavy for your hosting, drop these two and three.js will simply fail
  // to load offline, which start() already handles by falling back to the SVG.
  "./vendor/three.module.js",
  "./vendor/three.core.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy).catch(() => {}));
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));
    })
  );
});
