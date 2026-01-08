const CACHE_NAME = "pv-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/sources.json",
  "/assets/pv.css",
  "/assets/pv-core.js",
  "/assets/pv-footer.js",
  "/assets/logo-pontoview.png",
  "/panels/noticias.html",
  "/panels/esporte.html",
  "/panels/cinema.html",
  "/panels/curiosidades.html",
  "/panels/charadas.html",
  "/panels/nostalgia.html",
  "/panels/cotacao.html",
  "/panels/loterias.html",
  "/panels/humor.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first para estáticos, network-first para /api com fallback no cache
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // APIs do Worker (cache runtime)
  if (url.pathname.startsWith("/api/") || url.host.endsWith("workers.dev")) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if(cached) return cached;
  const res = await fetch(req);
  cache.put(req, res.clone());
  return res;
}

async function networkFirst(req){
  const cache = await caches.open(CACHE_NAME);
  try{
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  }catch{
    const cached = await cache.match(req);
    if(cached) return cached;
    return new Response(JSON.stringify({ items:[], meta:{ offline:true } }), {
      headers: { "Content-Type":"application/json" }
    });
  }
}
