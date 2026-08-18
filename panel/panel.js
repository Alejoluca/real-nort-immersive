/* NORT OS — precision control panel (GitHub Pages) */
(function () {
  "use strict";

  var STATE_KEY = "nort_os_v1";
  var EVENTS_KEY = "nort_os_events_v1";
  var SESSION_KEY = "nort_os_session_v1";
  var charts = [];
  var periodDays = 7;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 10); }
  function now() { return Date.now(); }
  function daysAgo(n) { return now() - n * 864e5; }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return String(ts); }
  }
  function fmtDay(ts) {
    try { return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }); }
    catch (e) { return ""; }
  }
  function pct(a, b) { return !b ? 0 : Math.round((a / b) * 1000) / 10; }
  function hash(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  function defaultState() {
    return {
      version: 3,
      users: [{
        id: "admin", username: "admin", email: "alejolucatelli@gmail.com",
        name: "Alejo Lucatelli", phone: "+52 984 323 7592", role: "admin",
        pass: hash("RealNort2026!"), active: true, notify: true
      }],
      props: {},
      settings: { company: "Real Nort México" }
    };
  }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (!s || !s.users || !s.users.length) return defaultState();
      if (!s.users.some(function (u) { return u.role === "admin"; })) s.users.unshift(defaultState().users[0]);
      s.props = s.props || {};
      return s;
    } catch (e) { return defaultState(); }
  }
  function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveEvents(list) {
    if (list.length > 10000) list = list.slice(-10000);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  }
  function pushEvent(evt) {
    var list = loadEvents(); list.push(evt); saveEvents(list); return evt;
  }

  var state = loadState();
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}
  function setSession(u) {
    session = u ? { id: u.id, role: u.role, name: u.name, username: u.username } : null;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }
  function currentUser() {
    if (!session) return null;
    return state.users.find(function (u) { return u.id === session.id && u.active !== false; }) || null;
  }

  var catalog = [];
  var route = "home";
  var routeParam = null;
  var user = null;

  function ensureProp(id) {
    if (!state.props[id]) state.props[id] = { status: "published", ownerId: null, note: "" };
    return state.props[id];
  }
  function propById(id) { return catalog.find(function (p) { return p.id === id; }); }
  function ownerName(id) {
    if (!id) return "Sin dueño";
    var u = state.users.find(function (x) { return x.id === id; });
    return u ? (u.name || u.username) : "—";
  }
  function ownerOf(p) { return ensureProp(p.id).ownerId; }

  function metricsFor(propertyId, days) {
    days = days == null ? periodDays : days;
    var since = daysAgo(days);
    var ev = loadEvents().filter(function (e) {
      if (propertyId && e.propertyId !== propertyId) return false;
      return e.ts >= since;
    });
    function c(t) { return ev.filter(function (e) { return e.type === t; }).length; }
    var views = c("detail_view"), card = c("card_click"), map = c("map_pin_click");
    var wa = c("whatsapp_click"), email = c("email_click"), visits = c("visit_scheduled"), rented = c("rented");
    var clicks = card + map, intent = wa + email;
    var score = Math.min(100, Math.round(views * 3 + clicks * 2 + intent * 12 + visits * 20));
    var label = score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
    return {
      views: views, card: card, map: map, clicks: clicks, wa: wa, email: email, intent: intent,
      visits: visits, rented: rented, score: score, label: label, events: ev,
      convView: pct(views, clicks || views), convIntent: pct(intent, views || clicks), convVisit: pct(visits, intent || views)
    };
  }

  function seriesByDay(filterIds, days) {
    days = days || 14;
    var labels = [], buckets = {};
    for (var i = days - 1; i >= 0; i--) {
      var key = new Date(daysAgo(i)).toISOString().slice(0, 10);
      labels.push(key); buckets[key] = { views: 0, intent: 0, visits: 0 };
    }
    loadEvents().forEach(function (e) {
      if (filterIds && !filterIds[e.propertyId]) return;
      var key = new Date(e.ts).toISOString().slice(0, 10);
      if (!buckets[key]) return;
      if (e.type === "detail_view" || e.type === "card_click" || e.type === "map_pin_click") buckets[key].views++;
      if (e.type === "whatsapp_click" || e.type === "email_click") buckets[key].intent++;
      if (e.type === "visit_scheduled") buckets[key].visits++;
    });
    return {
      labels: labels.map(fmtDay),
      views: labels.map(function (k) { return buckets[k].views; }),
      intent: labels.map(function (k) { return buckets[k].intent; }),
      visits: labels.map(function (k) { return buckets[k].visits; })
    };
  }

  function destroyCharts() {
    charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    charts = [];
  }
  function chartLine(id, series) {
    if (typeof Chart === "undefined") return;
    var el = document.getElementById(id); if (!el) return;
    charts.push(new Chart(el.getContext("2d"), {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          { label: "Interés", data: series.views, borderColor: "#c9a87c", backgroundColor: "rgba(201,168,124,.12)", tension: 0.35, fill: true, pointRadius: 0 },
          { label: "Consultas", data: series.intent, borderColor: "#3dd68c", tension: 0.35, pointRadius: 0 },
          { label: "Visitas", data: series.visits, borderColor: "#7aa2ff", tension: 0.35, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "rgba(245,245,247,.65)", boxWidth: 10, font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: "rgba(245,245,247,.4)", maxTicksLimit: 7 }, grid: { color: "rgba(255,255,255,.04)" } },
          y: { beginAtZero: true, ticks: { color: "rgba(245,245,247,.4)", precision: 0 }, grid: { color: "rgba(255,255,255,.05)" } }
        }
      }
    }));
  }
  function chartDonut(id, m) {
    if (typeof Chart === "undefined") return;
    var el = document.getElementById(id); if (!el) return;
    charts.push(new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Fichas", "Clicks", "WhatsApp", "Email", "Visitas"],
        datasets: [{ data: [m.views, m.clicks, m.wa, m.email, m.visits], backgroundColor: ["#c9a87c", "#8b7355", "#3dd68c", "#7aa2ff", "#f5a524"], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: "bottom", labels: { color: "rgba(245,245,247,.65)", boxWidth: 10, font: { size: 11 } } } }, cutout: "62%" }
    }));
  }

  async function loadCatalog() {
    var map = {};
    function add(list) { (list || []).forEach(function (p) { if (p && p.id) map[p.id] = p; }); }
    for (var i = 1; i <= 3; i++) {
      try {
        var res = await fetch("../data" + i + ".js?t=" + Date.now());
        if (!res.ok) continue;
        var text = await res.text();
        var marker = "window.__RN_P" + i + "=";
        var idx = text.indexOf(marker);
        if (idx < 0) continue;
        var part = text.slice(idx + marker.length);
        var cut = part.search(/;[\s\n]*window\.|;[\s\n]*var |;[\s\n]*if\(/);
        if (cut > 0) part = part.slice(0, cut);
        add(JSON.parse(part.replace(/;+\s*$/, "")));
      } catch (e) {}
    }
    if (Object.keys(map).length < 10) {
      for (var j = 0; j < 4; j++) {
        var paths = ["../catalog-a.json", "../catalog-b.json", "../catalog-c.json", "../catalog.json"];
        try {
          var r = await fetch(paths[j] + "?t=" + Date.now());
          if (!r.ok) continue;
          var d = await r.json();
          add(d.featured); add(d.allProperties);
        } catch (e) {}
      }
    }
    catalog = Object.keys(map).map(function (k) { return map[k]; });
    catalog.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "es"); });
    catalog.forEach(function (p) { ensureProp(p.id); });
    saveState();
  }

  function go(r, param) { route = r; routeParam = param || null; destroyCharts(); renderNav(); render(); }

  function showLogin() {
    destroyCharts(); $("boot").hidden = true; $("appView").hidden = true; $("loginView").hidden = false;
  }
  function showApp() {
    $("boot").hidden = true; $("loginView").hidden = true; $("appView").hidden = false;
    user = currentUser();
    $("roleBadge").textContent = user.role === "admin" ? "Admin" : "Propietario";
    $("userLabel").textContent = user.name || user.username;
    renderNav(); render();
  }

  function renderNav() {
    var items = user.role === "admin"
      ? [["home", "General"], ["inventory", "Inventario"], ["owners", "Propietarios"], ["activity", "Actividad"], ["tools", "Herramientas"]]
      : [["home", "Resumen"], ["myprops", "Mis propiedades"], ["activity", "Actividad"]];
    $("nav").innerHTML = items.map(function (it) {
      var active = route === it[0] || (route === "detail" && (it[0] === "inventory" || it[0] === "myprops"));
      return '<button type="button" data-route="' + it[0] + '" class="' + (active ? "active" : "") + '">' + it[1] + "</button>";
    }).join("");
    $("nav").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { go(b.getAttribute("data-route")); };
    });
  }

  function kpi(l, v, s) {
    return '<div class="kpi"><div class="k">' + esc(l) + '</div><div class="v">' + esc(v) + '</div>' + (s ? '<div class="s">' + esc(s) + "</div>" : "") + "</div>";
  }
  function statusClass(st) { return "status " + (st || "published"); }
  function visibleCatalog() {
    if (user.role === "admin") return catalog.slice();
    return catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id; });
  }
  function idSet(list) {
    var o = {}; list.forEach(function (p) { o[p.id] = true; }); return o;
  }
  function periodTabs() {
    return '<div class="period-tabs">' +
      [7, 30, 90].map(function (d) {
        return '<button type="button" data-p="' + d + '" class="' + (periodDays === d ? "active" : "") + '">' + d + "d</button>";
      }).join("") + "</div>";
  }
  function bindPeriod() {
    $("main").querySelectorAll(".period-tabs button").forEach(function (b) {
      b.onclick = function () { periodDays = Number(b.getAttribute("data-p")); render(); };
    });
  }

  function propCard(p, m) {
    m = m || metricsFor(p.id);
    var meta = ensureProp(p.id);
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w700") : "";
    return '<article class="pcard" data-open="' + esc(p.id) + '">' +
      '<div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div><div class="pcard-body">' +
      '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>" +
      '<div class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + "</div>" +
      '<div class="pulse-row"><div class="pulse-ring" style="--p:' + m.score + '"><span>' + m.score + "</span></div>" +
      '<div class="pulse-label">' + esc(m.label) + "<br/>" + m.views + " fichas · " + m.intent + " consultas · " + m.visits + " visitas</div></div>" +
      (user.role === "admin" ? '<div class="meta">Owner: ' + esc(ownerName(meta.ownerId)) + "</div>" : "") +
      '<button type="button" class="btn ghost sm" data-open="' + esc(p.id) + '">Ficha completa</button></div></article>';
  }
  function bindOpen() {
    $("main").querySelectorAll("[data-open]").forEach(function (el) {
      el.onclick = function (e) { e.preventDefault(); go("detail", el.getAttribute("data-open")); };
    });
  }

  function scopeMetrics(ids) {
    var since = daysAgo(periodDays);
    var ev = loadEvents().filter(function (e) { return (!ids || ids[e.propertyId]) && e.ts >= since; });
    function c(t) { return ev.filter(function (e) { return e.type === t; }).length; }
    var views = c("detail_view"), clicks = c("card_click") + c("map_pin_click");
    var wa = c("whatsapp_click"), email = c("email_click"), visits = c("visit_scheduled");
    return { views: views, clicks: clicks, wa: wa, email: email, intent: wa + email, visits: visits };
  }

  /* HOME */
  function renderHome() {
    var scope = visibleCatalog();
    var ids = user.role === "admin" ? null : idSet(scope);
    var m = scopeMetrics(ids);
    var unassigned = catalog.filter(function (p) { return !ensureProp(p.id).ownerId; }).length;
    var paused = scope.filter(function (p) { return ensureProp(p.id).status === "paused"; }).length;
    var rented = scope.filter(function (p) { return ensureProp(p.id).status === "rented"; }).length;
    var published = scope.filter(function (p) { var s = ensureProp(p.id).status; return s === "published" || s === "reserved"; }).length;

    var ranked = scope.map(function (p) { return { p: p, m: metricsFor(p.id) }; })
      .sort(function (a, b) { return b.m.score - a.m.score; });

    var html = periodTabs();
    html += '<div class="alert-strip">';
    html += '<span class="alert-chip ok">' + scope.length + " propiedades</span>";
    if (user.role === "admin" && unassigned) html += '<span class="alert-chip warn">' + unassigned + " sin dueño</span>";
    if (paused) html += '<span class="alert-chip warn">' + paused + " pausadas</span>";
    html += '<span class="alert-chip">' + published + " visibles</span>";
    html += '<span class="alert-chip">' + rented + " rentadas</span></div>";

    html += '<div class="kpi-row">';
    html += kpi("Fichas", m.views, "Inmersiones " + periodDays + "d");
    html += kpi("Clicks", m.clicks, "Card + mapa");
    html += kpi("Consultas", m.intent, "WA " + m.wa + " · Mail " + m.email);
    html += kpi("Visitas", m.visits, "Coordinadas");
    html += "</div>";
    html += '<div class="kpi-row">';
    html += kpi("Conv. ficha", pct(m.views, m.clicks || m.views) + "%", "Click → ficha");
    html += kpi("Conv. consulta", pct(m.intent, m.views || 1) + "%", "Ficha → WA/mail");
    html += kpi("Conv. visita", pct(m.visits, m.intent || 1) + "%", "Consulta → visita");
    html += kpi("Owners", state.users.filter(function (u) { return u.role === "owner" && u.active !== false; }).length, "Activos");
    html += "</div>";

    html += '<div class="charts-row"><div class="panel-block chart-card"><h2>Tendencia 14 días</h2><div class="chart-wrap"><canvas id="cTrend"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Mix de demanda</h2><div class="chart-wrap sm"><canvas id="cMix"></canvas></div></div></div>';

    html += '<p class="section-title">Ranking Pulse</p><div class="grid-cards">';
    ranked.slice(0, 15).forEach(function (r) { html += propCard(r.p, r.m); });
    html += "</div>";
    $("main").innerHTML = html;
    bindPeriod(); bindOpen();
    setTimeout(function () {
      chartLine("cTrend", seriesByDay(ids, 14));
      chartDonut("cMix", m);
    }, 30);
  }

  /* DETAIL */
  function renderDetail() {
    var p = propById(routeParam);
    if (!p) {
      $("main").innerHTML = '<div class="empty">No encontrada.<br/><button class="btn ghost sm" id="backBtn">Volver</button></div>';
      $("backBtn").onclick = function () { go(user.role === "admin" ? "inventory" : "myprops"); };
      return;
    }
    if (user.role !== "admin" && ensureProp(p.id).ownerId !== user.id) {
      $("main").innerHTML = '<div class="empty">Sin acceso.</div>'; return;
    }
    var meta = ensureProp(p.id);
    var m = metricsFor(p.id);
    var m30 = metricsFor(p.id, 30);
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w1200") : "";

    var html = '<button type="button" class="btn ghost sm" id="backBtn">← Volver</button>';
    html += periodTabs();
    html += '<div class="detail-hero" style="background-image:url(\'' + esc(img) + '\')"></div>';
    if (p.images && p.images.length) {
      html += '<div class="thumbs">' + p.images.slice(0, 8).map(function (u) {
        return "<i style=\"background-image:url('" + esc(String(u).replace(/=w\\d+/, "=w200")) + "')\"></i>";
      }).join("") + "</div>";
    }
    html += '<div class="detail-head"><h1>' + esc(p.name) + '</h1><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
    html += '<p class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + " · " + esc(p.price || "") + " · " + ((p.images && p.images.length) || 0) + " fotos</p>";
    html += '<p class="meta">Owner: <strong>' + esc(ownerName(meta.ownerId)) + "</strong>" + (meta.note ? " · Nota: " + esc(meta.note) : "") + "</p>";

    html += '<div class="kpi-row">';
    html += kpi("Pulse", m.score, m.label);
    html += kpi("Fichas", m.views, "30d: " + m30.views);
    html += kpi("Consultas", m.intent, "WA " + m.wa + " · Mail " + m.email);
    html += kpi("Visitas", m.visits, "30d: " + m30.visits);
    html += "</div>";
    html += '<p class="conv">Conversión · ficha <strong>' + m.convView + "%</strong> · consulta <strong>" + m.convIntent + "%</strong> · visita <strong>" + m.convVisit + "%</strong></p>";

    html += '<div class="charts-row"><div class="panel-block chart-card"><h2>14 días</h2><div class="chart-wrap"><canvas id="cProp"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Embudo</h2><div class="funnel">';
    var base = Math.max(m.clicks, m.views, 1);
    html += funnel("Clicks", m.clicks, base);
    html += funnel("Ficha", m.views, base);
    html += funnel("Consulta", m.intent, base);
    html += funnel("Visita", m.visits, base);
    html += "</div></div></div>";

    if (user.role === "admin") {
      html += '<div class="panel-block"><h2>Control operativo</h2><div class="form-row">';
      html += '<label>Status<select id="dStatus">';
      ["published", "paused", "reserved", "rented", "draft"].forEach(function (st) {
        html += '<option value="' + st + '"' + (meta.status === st ? " selected" : "") + ">" + st + "</option>";
      });
      html += '</select></label><label>Propietario<select id="dOwner"><option value="">— Sin dueño —</option>';
      state.users.filter(function (u) { return u.role === "owner" && u.active !== false; }).forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (meta.ownerId === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
      });
      html += '</select></label></div>';
      html += '<label class="field"><span>Nota interna</span><input id="dNote" type="text" value="' + esc(meta.note || "") + '"/></label>';
      html += '<div class="pcard-actions" style="margin-top:12px">';
      html += '<button type="button" class="btn gold sm" id="dSave">Guardar</button>';
      html += '<button type="button" class="btn ghost sm" id="dVisit">+ Visita</button>';
      html += '<button type="button" class="btn ghost sm" id="dRent">Rentado</button>';
      html += '<button type="button" class="btn ghost sm" id="dPause">Pausar</button>';
      html += '<a class="btn ghost sm" href="../index.html" target="_blank" rel="noopener">Ver en sitio</a></div></div>';
    }

    html += '<div class="panel-block"><h2>Timeline</h2><div class="feed">';
    var labels = { detail_view: "Ficha", card_click: "Card", map_pin_click: "Mapa", whatsapp_click: "WhatsApp", email_click: "Email", visit_scheduled: "Visita", rented: "Rentado", status_changed: "Status" };
    var tl = loadEvents().filter(function (e) { return e.propertyId === p.id; }).reverse().slice(0, 40);
    if (!tl.length) html += '<div class="empty">Sin eventos en esta unidad.</div>';
    tl.forEach(function (e) {
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time>" + esc(labels[e.type] || e.type) + "</div>";
    });
    html += "</div></div>";

    $("main").innerHTML = html;
    $("backBtn").onclick = function () { go(user.role === "admin" ? "inventory" : "myprops"); };
    bindPeriod();
    setTimeout(function () { chartLine("cProp", seriesByDay({ [p.id]: true }, 14)); }, 30);

    if (user.role === "admin") {
      $("dSave").onclick = function () {
        meta.status = $("dStatus").value;
        meta.ownerId = $("dOwner").value || null;
        meta.note = $("dNote").value.trim();
        saveState();
        pushEvent({ id: uid("ev"), type: "status_changed", propertyId: p.id, ts: now(), meta: { status: meta.status } });
        renderDetail();
      };
      $("dVisit").onclick = function () {
        pushEvent({ id: uid("ev"), type: "visit_scheduled", propertyId: p.id, ts: now() });
        renderDetail();
      };
      $("dRent").onclick = function () {
        meta.status = "rented"; saveState();
        pushEvent({ id: uid("ev"), type: "rented", propertyId: p.id, ts: now() });
        renderDetail();
      };
      $("dPause").onclick = function () {
        meta.status = "paused"; saveState();
        pushEvent({ id: uid("ev"), type: "status_changed", propertyId: p.id, ts: now(), meta: { status: "paused" } });
        renderDetail();
      };
    }
  }
  function funnel(label, val, max) {
    var p = max ? Math.round((val / max) * 100) : 0;
    return '<div class="funnel-row"><span>' + esc(label) + '</span><div class="funnel-bar"><i style="width:' + p + '%"></i></div><b>' + val + "</b></div>";
  }

  /* INVENTORY */
  function renderInventory() {
    var q = (window.__invQ || "").toLowerCase();
    var stf = window.__invSt || "all";
    var own = window.__invOwn || "all";
    var list = catalog.filter(function (p) {
      var meta = ensureProp(p.id);
      if (stf !== "all" && meta.status !== stf) return false;
      if (own === "none" && meta.ownerId) return false;
      if (own === "yes" && !meta.ownerId) return false;
      if (!q) return true;
      return (p.name + " " + p.id + " " + (p.loc || "") + " " + (p.beds || "")).toLowerCase().indexOf(q) >= 0;
    });
    list.sort(function (a, b) { return metricsFor(b.id).score - metricsFor(a.id).score; });

    var html = '<p class="section-title">Inventario ' + list.length + " / " + catalog.length + "</p>";
    html += periodTabs();
    html += '<div class="form-row">';
    html += '<label style="flex:2">Buscar<input id="invSearch" type="search" value="' + esc(window.__invQ || "") + '"/></label>';
    html += '<label>Status<select id="invSt"><option value="all">Todos</option>';
    ["published", "paused", "reserved", "rented", "draft"].forEach(function (st) {
      html += '<option value="' + st + '"' + (stf === st ? " selected" : "") + ">" + st + "</option>";
    });
    html += '</select></label><label>Owner<select id="invOwn">';
    html += '<option value="all"' + (own === "all" ? " selected" : "") + ">Todos</option>";
    html += '<option value="none"' + (own === "none" ? " selected" : "") + ">Sin dueño</option>";
    html += '<option value="yes"' + (own === "yes" ? " selected" : "") + ">Con dueño</option></select></label></div>";
    html += '<div class="grid-cards">';
    list.forEach(function (p) { html += propCard(p); });
    html += "</div>";
    $("main").innerHTML = html;
    bindPeriod();
    $("invSearch").oninput = function () { window.__invQ = this.value; renderInventory(); };
    $("invSt").onchange = function () { window.__invSt = this.value; renderInventory(); };
    $("invOwn").onchange = function () { window.__invOwn = this.value; renderInventory(); };
    bindOpen();
  }

  function renderMyProps() {
    var list = visibleCatalog();
    var html = periodTabs() + '<p class="section-title">Mis propiedades (' + list.length + ")</p>";
    if (!list.length) html += '<div class="empty">Aún no tenés unidades asignadas.</div>';
    else {
      html += '<div class="grid-cards">';
      list.forEach(function (p) { html += propCard(p); });
      html += "</div>";
    }
    $("main").innerHTML = html;
    bindPeriod(); bindOpen();
  }

  function renderOwners() {
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    var html = '<div class="panel-block"><h2>Alta de propietario</h2>';
    html += '<p class="note">Vos creás usuario y contraseña y se los transmitís. Ellos solo consultan métricas.</p>';
    html += '<div class="form-row">';
    html += '<label>Nombre<input id="oName"/></label><label>Usuario<input id="oUser"/></label>';
    html += '<label>Email<input id="oEmail" type="email"/></label><label>Teléfono<input id="oPhone"/></label>';
    html += '<label>Contraseña<input id="oPass" type="text" placeholder="mín. 6"/></label></div>';
    html += '<button type="button" class="btn gold" id="oCreate">Crear y mostrar acceso</button>';
    html += '<pre id="oCreds" class="note" style="display:none;white-space:pre-wrap;margin-top:12px"></pre></div>';
    html += '<p class="section-title">Directorio (' + owners.length + ")</p>";
    html += '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Contacto</th><th>Props</th><th>Pulse medio</th><th></th></tr></thead><tbody>';
    owners.forEach(function (o) {
      var props = catalog.filter(function (p) { return ensureProp(p.id).ownerId === o.id; });
      var avg = props.length ? Math.round(props.reduce(function (s, p) { return s + metricsFor(p.id).score; }, 0) / props.length) : 0;
      html += "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.username) + "</td><td>" + esc(o.email || "") + "<div class='meta'>" + esc(o.phone || "") + "</div></td>";
      html += "<td>" + props.length + "</td><td>" + avg + "</td>";
      html += '<td><button class="btn danger sm" data-off="' + esc(o.id) + '">Off</button></td></tr>';
    });
    html += "</tbody></table></div>";
    $("main").innerHTML = html;
    $("oCreate").onclick = function () {
      var username = $("oUser").value.trim().toLowerCase();
      var pass = $("oPass").value;
      if (!username || pass.length < 6) return alert("Usuario y contraseña (mín. 6)");
      if (state.users.some(function (u) { return u.username === username; })) return alert("Usuario existente");
      state.users.push({
        id: uid("own"), username: username, email: $("oEmail").value.trim(), phone: $("oPhone").value.trim(),
        name: $("oName").value.trim() || username, role: "owner", pass: hash(pass), active: true, notify: true
      });
      saveState();
      var box = $("oCreds"); box.style.display = "block";
      box.textContent = "Entregar al propietario:\n\nUsuario: " + username + "\nContraseña: " + pass +
        "\nURL: " + location.origin + location.pathname + "\n\nSolo lectura de sus propiedades.";
      renderOwners();
    };
    $("main").querySelectorAll("[data-off]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-off");
        var u = state.users.find(function (x) { return x.id === id; });
        if (u) u.active = false;
        Object.keys(state.props).forEach(function (pid) { if (state.props[pid].ownerId === id) state.props[pid].ownerId = null; });
        saveState(); renderOwners();
      };
    });
  }

  function renderActivity() {
    var ids = user.role === "admin" ? null : idSet(visibleCatalog());
    var labels = { detail_view: "Ficha", card_click: "Card", map_pin_click: "Mapa", whatsapp_click: "WhatsApp", email_click: "Email", visit_scheduled: "Visita", rented: "Rentado", status_changed: "Status" };
    var events = loadEvents().filter(function (e) { return !ids || ids[e.propertyId]; }).reverse().slice(0, 100);
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin eventos. Usá el sitio público en este navegador o registrá visitas.</div>';
    events.forEach(function (e) {
      var p = propById(e.propertyId);
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time><strong>" + esc(labels[e.type] || e.type) + "</strong> · " + esc(p ? p.name : e.propertyId || "—");
      if (p) html += ' <button type="button" class="btn ghost sm" data-open="' + esc(p.id) + '">Ver</button>';
      html += "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html; bindOpen();
  }

  function renderTools() {
    var html = '<div class="panel-block"><h2>Exportar</h2><p class="note">CSV con métricas del periodo actual (' + periodDays + "d) y respaldo JSON.</p>";
    html += '<div class="toolbar"><button class="btn gold sm" id="dlCsv">CSV métricas</button>';
    html += '<button class="btn ghost sm" id="dlJson">JSON respaldo</button>';
    html += '<button class="btn ghost sm" id="impJson">Importar JSON</button>';
    html += '<input id="impFile" type="file" accept="application/json" hidden/></div></div>';

    html += '<div class="panel-block"><h2>Simular demanda (prueba)</h2><p class="note">Genera eventos de ejemplo en este dispositivo para validar gráficos.</p>';
    html += '<button class="btn ghost sm" id="seedEv">Cargar demo 7 días</button>';
    html += '<button class="btn danger sm" id="clrEv">Vaciar eventos</button></div>';

    html += '<div class="panel-block"><h2>Seguridad local</h2><div class="form-row">';
    html += '<label>Nueva pass admin<input id="newPass" type="text" placeholder="mín. 6"/></label></div>';
    html += '<button class="btn gold sm" id="savePass">Cambiar contraseña admin</button></div>';

    html += '<p class="note">GitHub Pages · datos en este navegador · contacto real por WhatsApp/email del sitio.</p>';
    $("main").innerHTML = html;

    $("dlCsv").onclick = function () {
      var lines = ["id,name,loc,beds,status,owner,views,clicks,wa,email,visits,pulse"];
      catalog.forEach(function (p) {
        var meta = ensureProp(p.id); var m = metricsFor(p.id);
        lines.push([p.id, JSON.stringify(p.name || ""), JSON.stringify(p.loc || ""), JSON.stringify(p.beds || ""),
          meta.status, JSON.stringify(ownerName(meta.ownerId)), m.views, m.clicks, m.wa, m.email, m.visits, m.score].join(","));
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = "nort-os-" + periodDays + "d.csv"; a.click();
    };
    $("dlJson").onclick = function () {
      var payload = { exportedAt: new Date().toISOString(), state: state, events: loadEvents() };
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      a.download = "nort-os-backup.json"; a.click();
    };
    $("impJson").onclick = function () { $("impFile").click(); };
    $("impFile").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (data.state) { state = data.state; saveState(); }
          if (data.events) saveEvents(data.events);
          alert("Importado"); location.reload();
        } catch (e) { alert("JSON inválido"); }
      };
      reader.readAsText(f);
    };
    $("seedEv").onclick = function () {
      var types = ["card_click", "detail_view", "detail_view", "whatsapp_click", "map_pin_click", "email_click"];
      for (var d = 0; d < 7; d++) {
        for (var k = 0; k < 8; k++) {
          var p = catalog[Math.floor(Math.random() * catalog.length)];
          if (!p) continue;
          pushEvent({
            id: uid("ev"), type: types[Math.floor(Math.random() * types.length)],
            propertyId: p.id, ts: daysAgo(d) + Math.floor(Math.random() * 864e5), source: "demo"
          });
        }
      }
      alert("Demo cargada"); go("home");
    };
    $("clrEv").onclick = function () {
      if (confirm("¿Borrar todos los eventos locales?")) { saveEvents([]); alert("Listo"); }
    };
    $("savePass").onclick = function () {
      var pass = $("newPass").value;
      if (pass.length < 6) return alert("Mínimo 6 caracteres");
      var admin = state.users.find(function (u) { return u.role === "admin"; });
      if (admin) { admin.pass = hash(pass); saveState(); alert("Contraseña admin actualizada"); }
    };
  }

  function render() {
    user = currentUser();
    if (!user) return showLogin();
    destroyCharts();
    if (route === "detail") return renderDetail();
    if (user.role === "admin") {
      if (route === "inventory") return renderInventory();
      if (route === "owners") return renderOwners();
      if (route === "activity") return renderActivity();
      if (route === "tools") return renderTools();
      return renderHome();
    }
    if (route === "myprops") return renderMyProps();
    if (route === "activity") return renderActivity();
    return renderHome();
  }

  function tryLogin() {
    var username = $("loginUser").value.trim().toLowerCase();
    var pass = $("loginPass").value;
    $("loginErr").hidden = true;
    var u = state.users.find(function (x) {
      return x.active !== false && (x.username === username || (x.email && x.email.toLowerCase() === username));
    });
    if (!u || u.pass !== hash(pass)) {
      $("loginErr").hidden = false; $("loginErr").textContent = "Credenciales incorrectas"; return;
    }
    setSession(u); user = u; route = "home"; showApp();
  }

  $("loginBtn").onclick = tryLogin;
  $("loginPass").addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  $("logoutBtn").onclick = function () { setSession(null); user = null; showLogin(); };

  (async function boot() {
    await loadCatalog();
    console.log("[NORT OS] props", catalog.length);
    $("boot").hidden = true;
    if (currentUser()) showApp(); else showLogin();
  })();
})();
