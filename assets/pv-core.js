/* pv-core.js — núcleo PontoView (sem framework) */
(function () {
  const DEFAULTS = {
    apiBase: "https://SEU-WORKER.workers.dev", // << TROQUE
    refreshMs: 60_000,
    rotateMs: 9_000,
    items: 6,
    timeoutMs: 8_000
  };

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function nowIso(){
    const d = new Date();
    return d.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"medium" });
  }

  async function fetchWithTimeout(url, timeoutMs){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try{
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  // cache simples no navegador (offline)
  function lsGet(key){
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  }
  function lsSet(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  async function getJSONCached(url, opts){
    const key = "pv_cache:" + url;
    const cached = lsGet(key);

    try{
      const res = await fetchWithTimeout(url, opts.timeoutMs);
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      lsSet(key, { ts: Date.now(), data });
      return { data, fromCache:false };
    } catch (e){
      if (cached?.data) return { data: cached.data, fromCache:true, error:String(e) };
      throw e;
    }
  }

  function el(sel){ return document.querySelector(sel); }

  function renderItems(listEl, items){
    listEl.innerHTML = "";
    items.forEach(it => {
      const div = document.createElement("div");
      div.className = "pvItem";
      div.innerHTML = `
        <div class="pvItemTitle">${escapeHtml(it.title || "")}</div>
        <div class="pvItemSub">
          ${it.badge ? `<span class="pvBadgeMini">${escapeHtml(it.badge)}</span>` : ""}
          ${it.source ? `<span class="pvSmall">${escapeHtml(it.source)}</span>` : ""}
          ${it.when ? `<span class="pvSmall">• ${escapeHtml(it.when)}</span>` : ""}
        </div>
        ${it.desc ? `<div class="pvSmall">${escapeHtml(it.desc)}</div>` : ""}
      `;
      listEl.appendChild(div);
    });
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  async function startPanel(cfg){
    const C = { ...DEFAULTS, ...cfg };
    const titleEl = el("#pvTitle");
    const subEl = el("#pvSub");
    const chipEl = el("#pvChip");
    const listEl = el("#pvList");
    const statusEl = el("#pvStatus");

    if(titleEl) titleEl.textContent = C.title || "Painel";
    if(subEl) subEl.textContent = C.subtitle || "Atualização automática";
    if(chipEl) chipEl.textContent = C.chip || "PontoView";

    let current = [];
    let rotateIdx = 0;

    async function load(){
      const url = `${C.apiBase}${C.endpoint}?limit=${encodeURIComponent(C.items)}`;
      try{
        const r = await getJSONCached(url, C);
        const payload = r.data;
        const items = Array.isArray(payload.items) ? payload.items : [];
        current = items.slice(0, C.items);
        rotateIdx = 0;

        renderItems(listEl, current);

        const src = payload.meta?.sourceLabel || C.chip || "PontoView";
        const when = payload.meta?.updatedAt || nowIso();
        const mode = r.fromCache ? "OFFLINE" : "ONLINE";
        if(statusEl){
          statusEl.textContent = `${mode} • ${src} • ${when}`;
        }
      } catch (e){
        if(statusEl){
          statusEl.textContent = `Sem dados (ainda) • ${nowIso()}`;
        }
      }
    }

    // Rotação suave: re-render com “janela” dos itens
    async function rotateLoop(){
      while(true){
        await sleep(C.rotateMs);
        if(!current.length) continue;
        rotateIdx = (rotateIdx + 1) % current.length;

        const windowItems = [];
        for(let i=0;i<Math.min(C.items, current.length);i++){
          windowItems.push(current[(rotateIdx + i) % current.length]);
        }
        renderItems(listEl, windowItems);
      }
    }

    await load();
    setInterval(load, C.refreshMs);
    rotateLoop();
  }

  function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  }

  window.PV = {
    startPanel,
    registerSW
  };
})();
