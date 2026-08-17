(async function(){
const WA = "529843237592";
const metrics = {
  events: [],
  track(name, data) {
    const e = { name, t: Date.now(), ...data };
    this.events.push(e);
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "rn_" + name, ...data }); } catch (_) {}
    try {
      if (typeof gtag === "function" && window.RN_GA4_ID && window.RN_GA4_ID.indexOf("XXXX") === -1) {
        gtag("event", name, Object.assign({ event_category: "real_nort", send_to: window.RN_GA4_ID }, data || {}));
      }
    } catch (_) {}
  },
  summary() { const c = {}; this.events.forEach(e => { c[e.name] = (c[e.name] || 0) + 1; }); return c; }
};
window.__RN_METRICS = metrics;
function waMsg(p, extra) {
  let t = "Hola, vi la web de *Real Nort México* y me interesa esta propiedad:\n\n";
  t += "🏠 *" + (p.name || "Propiedad") + "*\n";
  if (p.loc) t += "📍 " + p.loc + "\n";
  if (p.beds) t += "🛏 " + p.beds + "\n";
  if (p.price) t += "💰 " + p.price + "\n";
  t += "\n¿Me puedes dar más información y disponibilidad?";
  if (extra) t += "\n\n" + extra;
  return "https://wa.me/" + WA + "?text=" + encodeURIComponent(t);
}
const gallery = document.getElementById("gallery");
const progressRail = document.getElementById("progressRail");
let currentIndex = 0, wheelLock = false, currentFilter = "all", currentDetail = null, detailIdx = 0;
let gridImgObs = null, detailImgs = [];
function safeImg(p, i) {
  if (p && p.images && p.images.length) return p.images[Math.min(i || 0, p.images.length - 1)] || p.images[0];
  return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop";
}
function lazyBg(el, url, fallback) {
  if (!el || el.classList.contains("loaded") || el.dataset.loading === "1") return;
  el.dataset.loading = "1";
  const img = new Image();
  img.decoding = "async";
  img.onload = () => { el.style.backgroundImage = "url('" + url + "')"; el.classList.add("loaded"); el.dataset.loading = "0"; };
  img.onerror = () => { el.style.backgroundImage = "url('" + (fallback || safeImg(null,0)) + "')"; el.classList.add("loaded"); el.dataset.loading = "0"; };
  img.src = url;
}
function buildGallery() {
  if (!window.featured || !featured.length) {
    gallery.innerHTML = '<section class="slide active"><div class="slide-content" style="padding:4rem 2rem"><h1 class="slide-title">Cargando catálogo…</h1><p class="slide-desc">Inventario desde Google Drive</p></div></section>';
    return;
  }
  metrics.track("page_view", { featured: featured.length, all: (allProperties || []).length });
  let html = "";
  html += `<section class="slide active" data-index="0"><div class="slide-bg loaded" style="background-image:url('${safeImg(featured[0],0)}')"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">Tulum · Riviera Maya</span><h1 class="slide-title">Todas las propiedades.<br>Una experiencia.</h1><p class="slide-desc">Recorre una selección destacada con fotos reales del inventario. Abre el catálogo completo (${(allProperties||[]).length || featured.length} propiedades) y consulta por WhatsApp.</p><div class="slide-actions"><button type="button" class="cta gold" id="btnAllIntro">Ver todas</button></div></div><div class="scroll-hint">Desliza</div></section>`;
  featured.forEach((p, i) => {
    html += `<section class="slide" data-index="${i+1}" data-id="${p.id}"><div class="slide-bg" data-bg="${safeImg(p,0)}"></div><div class="slide-overlay"></div><div class="slide-content"><span class="slide-tag">${p.tag || (p.loc + " · " + p.beds)}</span><h2 class="slide-title">${p.name}</h2><p class="slide-location">${p.loc || "Tulum"}</p><p class="slide-desc">${p.desc || ""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds || "—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price || "Consultar"}</span></div></div><div class="slide-actions"><button type="button" class="cta" data-open="${p.id}">Ver más imágenes (${(p.images||[]).length})</button><a class="cta gold" data-wa="${p.id}" href="${waMsg(p)}" target="_blank" rel="noopener">Consultar por WhatsApp</a></div></div></section>`;
  });
  const lastIdx = featured.length + 1;
  html += `<section class="slide" data-index="${lastIdx}" data-final="true"><div class="slide-bg" data-bg="${safeImg(featured[0],1)}"></div><div class="slide-overlay"></div><div class="slide-content" style="max-width:480px"><span class="slide-tag">Final · Contacto</span><h2 class="slide-title">Hablemos de tu próxima propiedad.</h2><p class="slide-location">Real Nort México · Tulum</p><p class="slide-desc">Inventario completo desde Drive. Déjanos tus datos o escríbenos.</p><form class="contact-form" id="contactForm" novalidate><div class="form-row"><input type="text" name="name" placeholder="Tu nombre" required autocomplete="name"/><input type="tel" name="phone" placeholder="Teléfono / WhatsApp" required autocomplete="tel"/></div><input type="email" name="email" placeholder="Email (opcional)" autocomplete="email"/><select name="interest"><option value="">¿Qué te interesa?</option><option value="Renta">Renta</option><option value="Compra">Compra / Venta</option><option value="Estudio">Estudio / Loft</option><option value="1 Recámara">1 Recámara</option><option value="2 Recámaras">2 Recámaras</option><option value="Villa">Villa</option></select><textarea name="message" placeholder="Zona, presupuesto, fechas..." rows="2"></textarea><button type="submit" class="form-submit">Enviar por WhatsApp</button><p class="form-note">+52 984 323 7592</p></form><div class="slide-actions" style="margin-top:1.2rem"><button type="button" class="cta" id="btnAllEnd">Ver todas las propiedades</button></div></div></section>`;
  gallery.innerHTML = html;
  setupAfterBuild();
}
function setupAfterBuild() {
  const slides = () => Array.from(gallery.querySelectorAll(".slide"));
  progressRail.innerHTML = "";
  slides().forEach((_, i) => {
    const d = document.createElement("button"); d.type = "button"; d.className = "progress-dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", () => slides()[i].scrollIntoView({ behavior: "smooth", block: "start" })); progressRail.appendChild(d);
  });
  const bgObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (!e.isIntersecting) return; const el = e.target; const url = el.getAttribute("data-bg"); if (url) lazyBg(el, url, safeImg(featured[0], 0)); });
  }, { root: gallery, rootMargin: "120% 0px", threshold: 0.01 });
  gallery.querySelectorAll(".slide-bg[data-bg]").forEach(el => bgObs.observe(el));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
      const slide = entry.target; const index = parseInt(slide.dataset.index, 10);
      slides().forEach(s => s.classList.remove("active")); slide.classList.add("active"); currentIndex = index;
      Array.from(progressRail.children).forEach((d, i) => d.classList.toggle("active", i === index));
      if (slide.dataset.id) metrics.track("slide_view", { id: slide.dataset.id, index });
      if (slide.dataset.final) metrics.track("reach_contact");
    });
  }, { threshold: [0.5] });
  slides().forEach(s => io.observe(s));
  gallery.addEventListener("wheel", (e) => {
    if (wheelLock) { e.preventDefault(); return; } if (Math.abs(e.deltaY) < 12) return; e.preventDefault();
    const list = slides(); const dir = e.deltaY > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(list.length - 1, currentIndex + dir)); if (next === currentIndex) return;
    wheelLock = true; list[next].scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => { wheelLock = false; }, 700);
  }, { passive: false });
  document.getElementById("logoHome").addEventListener("click", (e) => { e.preventDefault(); gallery.scrollTo({ top: 0, behavior: "smooth" }); });
  document.getElementById("btnAll").addEventListener("click", () => { metrics.track("open_grid", { source: "header" }); openAll(); });
  document.getElementById("allClose").addEventListener("click", closeAll);
  document.addEventListener("click", (e) => {
    if (e.target && (e.target.id === "btnAllIntro" || e.target.id === "btnAllEnd")) { metrics.track("open_grid", { source: e.target.id }); openAll(); }
    const btn = e.target.closest("[data-open]"); if (btn) { const id = btn.getAttribute("data-open"); metrics.track("open_detail", { id, source: "slide" }); const p = findProp(id); if (p) openDetail(p); }
    const wa = e.target.closest("[data-wa]"); if (wa) metrics.track("wa_click", { id: wa.getAttribute("data-wa"), source: "slide" });
  });
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailBack").addEventListener("click", closeDetail);
  document.getElementById("detailPrev").addEventListener("click", () => detailNav(-1));
  document.getElementById("detailNext").addEventListener("click", () => detailNav(1));
  document.addEventListener("keydown", (e) => {
    if (document.getElementById("detail").classList.contains("open")) { if (e.key === "Escape") closeDetail(); if (e.key === "ArrowLeft") detailNav(-1); if (e.key === "ArrowRight") detailNav(1); return; }
    if (document.getElementById("allOverlay").classList.contains("open")) { if (e.key === "Escape") closeAll(); return; }
    const list = slides();
    if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); const n = Math.min(currentIndex + 1, list.length - 1); if (n !== currentIndex) list[n].scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); const n = Math.max(currentIndex - 1, 0); if (n !== currentIndex) list[n].scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "contactForm") return; e.preventDefault();
    const f = e.target; const name = f.querySelector('[name="name"]'); const phone = f.querySelector('[name="phone"]'); const email = f.querySelector('[name="email"]');
    const interest = f.querySelector('[name="interest"]'); const message = f.querySelector('[name="message"]');
    f.querySelectorAll(".field-error").forEach(el => el.remove()); [name, phone, email].forEach(el => el && el.classList.remove("invalid"));
    let ok = true; const show = (input, msg) => { input.classList.add("invalid"); const err = document.createElement("div"); err.className = "field-error show"; err.textContent = msg; input.parentNode.insertBefore(err, input.nextSibling); ok = false; };
    if (!name.value.trim()) show(name, "Ingresa tu nombre"); if ((phone.value || "").replace(/\D/g, "").length < 10) show(phone, "Mín. 10 dígitos");
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) show(email, "Email inválido");
    if (!ok) { metrics.track("form_error"); return; }
    metrics.track("form_submit", { interest: interest.value || "" });
    let t = "Hola, soy *" + name.value.trim() + "*\nTel: " + phone.value.trim() + "\n"; if (email.value.trim()) t += "Email: " + email.value.trim() + "\n"; if (interest.value) t += "Interés: " + interest.value + "\n";
    t += "\n" + (message.value.trim() || "Quiero información sobre propiedades en Tulum.") + "\n\n_(Mensaje desde la web Real Nort)_";
    window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(t), "_blank", "noopener");
  });
}
function findProp(id) { return (allProperties || []).find(p => p.id === id) || (featured || []).find(p => p.id === id); }
function openDetail(p) {
  if (!p) return; currentDetail = p; detailIdx = 0; detailImgs = (p.images && p.images.length) ? p.images : [safeImg(p, 0)];
  const slidesEl = document.getElementById("detailSlides"); const nav = document.getElementById("detailNav"); const info = document.getElementById("detailInfo");
  slidesEl.innerHTML = detailImgs.map((src, i) => i === 0 ? `<div class="detail-slide loaded" style="background-image:url('${src}')" data-src="${src}"></div>` : `<div class="detail-slide" data-src="${src}"></div>`).join("");
  slidesEl.style.transform = "translateX(0)";
  nav.innerHTML = detailImgs.map((_, i) => `<button type="button" class="detail-dot${i===0?" active":""}" data-i="${i}"></button>`).join("");
  nav.querySelectorAll(".detail-dot").forEach(d => d.addEventListener("click", () => goDetail(parseInt(d.dataset.i, 10))));
  info.innerHTML = `<span class="slide-tag">${p.tag || ((p.loc||"Tulum") + " · " + (p.beds||""))}</span><h2 class="slide-title" style="font-size:clamp(1.5rem,3.5vw,2.4rem)">${p.name}</h2><p class="slide-location">${p.loc||"Tulum"}</p><p class="slide-desc">${p.desc||""}</p><div class="slide-meta"><div class="meta-item"><span class="meta-label">Tipo</span><span class="meta-value">${p.beds||"—"}</span></div><div class="meta-item"><span class="meta-label">Precio</span><span class="meta-value price">${p.price||"Consultar"}</span></div></div><div class="slide-actions"><a class="cta gold" data-wa="${p.id}" href="${waMsg(p)}" target="_blank" rel="noopener">Consultar esta propiedad</a></div>`;
  document.getElementById("detail").classList.add("open"); document.body.style.overflow = "hidden"; metrics.track("detail_view", { id: p.id });
}
function loadDetailImg(i) { const slides = document.querySelectorAll("#detailSlides .detail-slide"); const el = slides[i]; if (!el || el.classList.contains("loaded")) return; const src = el.getAttribute("data-src"); if (src) lazyBg(el, src, safeImg(currentDetail, 0)); }
function goDetail(i) { if (!currentDetail) return; const n = detailImgs.length || 1; detailIdx = ((i % n) + n) % n; document.getElementById("detailSlides").style.transform = "translateX(-" + (detailIdx * 100) + "%)"; document.getElementById("detailNav").querySelectorAll(".detail-dot").forEach((d, idx) => d.classList.toggle("active", idx === detailIdx)); loadDetailImg(detailIdx); loadDetailImg(detailIdx + 1); loadDetailImg(detailIdx - 1); metrics.track("detail_image", { id: currentDetail.id, index: detailIdx }); }
function detailNav(dir) { if (!currentDetail) return; goDetail(detailIdx + dir); }
function closeDetail() { document.getElementById("detail").classList.remove("open"); document.body.style.overflow = ""; currentDetail = null; }
function openAll() { currentFilter = "all"; renderGrid(); document.getElementById("allOverlay").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeAll() { document.getElementById("allOverlay").classList.remove("open"); document.body.style.overflow = ""; if (gridImgObs) { gridImgObs.disconnect(); gridImgObs = null; } }
function renderGrid() {
  const filters = [{ key: "all", label: "Todas" }, { key: "studio", label: "Estudios / Loft" }, { key: "1", label: "1 Recámara" }, { key: "2", label: "2 Recámaras" }, { key: "3", label: "3 Recámaras" }];
  const source = (allProperties && allProperties.length) ? allProperties : featured;
  const filtered = currentFilter === "all" ? source : source.filter(p => p.bedsKey === currentFilter);
  metrics.track("filter", { key: currentFilter, count: filtered.length });
  document.getElementById("filterBar").innerHTML = filters.map(f => `<button type="button" class="filter-btn${currentFilter===f.key?" active":""}" data-f="${f.key}">${f.label}</button>`).join("") + `<span class="filter-count">${filtered.length} propiedades</span>`;
  document.getElementById("filterBar").querySelectorAll(".filter-btn").forEach(b => { b.addEventListener("click", () => { currentFilter = b.dataset.f; renderGrid(); }); });
  const grid = document.getElementById("propGrid");
  grid.innerHTML = filtered.map(p => `<div class="card" data-id="${p.id}"><div class="card-img" data-bg="${safeImg(p,0)}"></div><div class="card-body"><div class="card-tag">${p.loc||"Tulum"}</div><div class="card-name">${p.name}</div><div class="card-meta">${p.beds||""}</div><div class="card-price">${p.price||"Consultar"}</div></div></div>`).join("");
  if (gridImgObs) gridImgObs.disconnect();
  gridImgObs = new IntersectionObserver((entries) => { entries.forEach(e => { if (!e.isIntersecting) return; const el = e.target; const url = el.getAttribute("data-bg"); if (url) lazyBg(el, url, safeImg(null, 0)); gridImgObs.unobserve(el); }); }, { root: grid, rootMargin: "200px 0px", threshold: 0.01 });
  grid.querySelectorAll(".card-img[data-bg]").forEach(el => gridImgObs.observe(el));
  grid.querySelectorAll(".card").forEach(card => { card.addEventListener("click", () => { const p = findProp(card.dataset.id); if (p) { metrics.track("open_detail", { id: p.id, source: "grid" }); closeAll(); openDetail(p); } }); });
}
function tryBuild() { if (typeof featured !== "undefined" && featured.length) { buildGallery(); return true; } return false; }
if (!tryBuild()) {
  window.__RN_ON_DATA = function() { tryBuild(); };
  setTimeout(function(){ if (!tryBuild()) buildGallery(); }, 2500);
}
})();
