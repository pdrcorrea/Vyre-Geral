(function(){
  const $ = (s)=>document.querySelector(s);

  const PV = {
    cfg: {
      apiBase: "https://pv-content-worker.pedrhc258.workers.dev/", // TROQUE
      refreshMs: 120000,
      rotateMs: 9000,
      timeoutMs: 8000,
      items: 6
    },
    state: {
      items: [],
      idx: 0,
      lastOnline: true
    }
  };

  function pad(n){ return String(n).padStart(2,"0"); }

  function clockTick(){
    const d = new Date();
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const el = $("#pvClock");
    if(el) el.textContent = `${hh}:${mm}`;
  }

  function setStatus(online){
    const dot = $("#pvDot");
    const label = $("#pvStatusLabel");
    if(!dot || !label) return;

    if(online){
      dot.style.background = "#24c46b";
      dot.style.boxShadow = "0 0 0 4px rgba(36,196,107,.14)";
      label.textContent = "ONLINE";
    }else{
      dot.style.background = "#ffb020";
      dot.style.boxShadow = "0 0 0 4px rgba(255,176,32,.16)";
      label.textContent = "OFFLINE";
    }
  }

  async function fetchWithTimeout(url, timeoutMs){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      const res = await fetch(url, { signal: ctrl.signal, cache:"no-store" });
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  function cacheGet(key){
    try{ return JSON.parse(localStorage.getItem(key)||"null"); }catch{ return null; }
  }
  function cacheSet(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
  }

  async function getData(endpoint){
    const url = PV.cfg.apiBase + endpoint + `?limit=${PV.cfg.items}`;
    const key = "pv_cache:" + url;
    const cached = cacheGet(key);

    try{
      const res = await fetchWithTimeout(url, PV.cfg.timeoutMs);
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      cacheSet(key, { ts: Date.now(), data });
      PV.state.lastOnline = true;
      return { data, fromCache:false };
    }catch(e){
      PV.state.lastOnline = false;
      if(cached?.data) return { data: cached.data, fromCache:true };
      return { data:{ items:[], meta:{} }, fromCache:true };
    }
  }

  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  /* ====== RENDER MODES (só muda o conteúdo do card) ====== */

  function renderHero(text){
    const body = $("#pvCardBody");
    body.innerHTML = `
      <div class="pvHero">
        <div class="pvHeroText">${escapeHtml(text)}</div>
        <div class="pvProgress"><div id="pvProgFill"></div></div>
      </div>
    `;
  }

  function renderList(items){
    const body = $("#pvCardBody");
    const html = items.map(it=>{
      return `
        <div class="pvItem">
          <div class="pvItemTitle">${escapeHtml(it.title || "")}</div>
          <div class="pvItemMeta">
            ${it.badge ? `<span class="pvPill">${escapeHtml(it.badge)}</span>` : ""}
            ${it.source ? `<span class="pvMetaSmall">${escapeHtml(it.source)}</span>` : ""}
            ${it.when ? `<span class="pvMetaSmall">• ${escapeHtml(it.when)}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
    body.innerHTML = `<div class="pvList" id="pvList">${html}</div>`;
  }

  function rotateProgress(){
    const fill = $("#pvProgFill");
    if(!fill) return;
    const total = PV.cfg.rotateMs;
    const step = 80;
    let elapsed = 0;
    const id = setInterval(()=>{
      elapsed += step;
      const pct = Math.max(0, Math.min(100, (elapsed/total)*100));
      fill.style.width = pct + "%";
      if(elapsed >= total) clearInterval(id);
    }, step);
  }

  async function loadAndRender(panel){
    const sub = $("#pvSubText");
    const title = $("#pvHeaderTitle");
    if(title) title.textContent = (panel.headerTitle||"PAINEL").toUpperCase();
    if(sub) sub.textContent = (panel.subbarLeft||"HOJE • ATUALIZAÇÕES").toUpperCase();

    const result = await getData(panel.endpoint || "/api/empty");
    setStatus(PV.state.lastOnline);

    const items = Array.isArray(result.data.items) ? result.data.items : [];
    PV.state.items = items;
    PV.state.idx = 0;

    if(panel.mode === "hero"){
      const text = items[0]?.title || panel.fallback || "Sem conteúdo no momento.";
      renderHero(text);
      rotateProgress();
    }else{
      renderList(items.slice(0, PV.cfg.items));
    }

    // rodapé
    const foot = $("#pvFooterLeft");
    const upd = result.data.meta?.updatedAt || new Date().toLocaleString("pt-BR");
    if(foot) foot.textContent = panel.footerLeft || (`Atualizado: ${upd}`);

    // se for hero, rotaciona frases
    if(panel.mode === "hero"){
      setInterval(()=>{
        if(!PV.state.items.length) return;
        PV.state.idx = (PV.state.idx + 1) % PV.state.items.length;
        const text = PV.state.items[PV.state.idx]?.title || panel.fallback || "…";
        renderHero(text);
        rotateProgress();
      }, PV.cfg.rotateMs);
    }
  }

  function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  }

  // API pública
  window.PV = {
    init(panelConfig){
      registerSW();
      clockTick();
      setInterval(clockTick, 1000);

      // configurações por painel (sem mexer no template)
      PV.cfg.apiBase = panelConfig.apiBase || PV.cfg.apiBase;
      PV.cfg.refreshMs = panelConfig.refreshMs || PV.cfg.refreshMs;
      PV.cfg.rotateMs  = panelConfig.rotateMs  || PV.cfg.rotateMs;
      PV.cfg.items     = panelConfig.items     || PV.cfg.items;

      loadAndRender(panelConfig);
      setInterval(()=>loadAndRender(panelConfig), PV.cfg.refreshMs);
    }
  };
})();
