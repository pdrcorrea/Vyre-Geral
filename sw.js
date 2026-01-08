const CACHE = "pv-panels-v1";

const STATIC = [
  "/",
  "/assets/pv.css",
  "/assets/pv.js",
  "/assets/logo-pontoview.png",

  "/panels/dicas.html",
  "/panels/noticias.html",
  "/panels/esporte.html",
  "/panels/curiosidades.html",
  "/panels/charadas.html",
  "/panels/cotacao.html",
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(self.clients.claim());
});

// static: cache-first / api: network-first com fallback cache
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  const url = new URL(req.url);

  const isApi = url.pathname.startsWith("/api/") || url.hostname.endsWith("workers.dev");
  if(isApi){
    e.respondWith(networkFirst(req));
  }else{
    e.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req){
  const c = await caches.open(CACHE);
  const cached = await c.match(req);
  if(cached) return cached;
  const res = await fetch(req);
  c.put(req, res.clone());
  return res;
}

async function networkFirst(req){
  const c = await caches.open(CACHE);
  try{
    const res = await fetch(req);
    c.put(req, res.clone());
    return res;
  }catch{
    const cached = await c.match(req);
    if(cached) return cached;
    return new Response(JSON.stringify({ items:[], meta:{ offline:true } }), {
      headers:{ "Content-Type":"application/json" }
    });
  }
}
