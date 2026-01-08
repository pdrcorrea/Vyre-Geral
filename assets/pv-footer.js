(function(){
  window.PV = window.PV || {};

  PV.renderFooter = function({ leftText = "", rightLogo = "" } = {}){
    const footer = document.getElementById("pvFooter");
    if(!footer) return;

    footer.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        gap:12px; color: rgba(255,255,255,.78);
        font-weight:800; font-size:12px;
      ">
        <div>${leftText ? escapeHtml(leftText) : ""}</div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div id="pvFooterClock"></div>
          ${rightLogo ? `<img src="${rightLogo}" alt="PontoView" style="height:18px; opacity:.95">` : ""}
        </div>
      </div>
    `;

    function tick(){
      const el = document.getElementById("pvFooterClock");
      if(!el) return;
      const d = new Date();
      el.textContent = d.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"medium" });
    }
    tick();
    setInterval(tick, 1000);
  };

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
