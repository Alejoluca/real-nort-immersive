/* NORT OS — Full ops panel (GitHub Pages / localStorage) */
(function () {
  "use strict";

  var STATE_KEY = "nort_os_v1";
  var EVENTS_KEY = "nort_os_events_v1";
  var SESSION_KEY = "nort_os_session_v1";
  var chartInstances = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 10); }
  function now() { return Date.now(); }
  function daysAgo(n) { return now() - n * 864e5; }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return String(ts); }
  }
  function fmtDay(ts) {
    try {
      return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
    } catch (e) { return ""; }
  }
  function hash(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function defaultState() {
    return {
      version: 2,
      users: [{
        id: "admin",
        username: "admin",
        email: "alejolucatelli@gmail.com",
        name: "Alejo Lucatelli",
        phone: "+52 984 323 7592",
        role: "admin",
        pass: hash("RealNort2026!"),
        active: true,
        notify: true
      }],
      props: {},
      notes: {},
      settings: { clickThreshold: 10 }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s.users || !s.users.length) return defaultState();
      if (!s.users.some(function (u) { return u.role === "admin"; })) {
        s.users.unshift(defaultState().users[0]);
      }
      s.props = s.props || {};
      s.notes = s.notes || {};
      return s;
    } catch (e) { return defaultState(); }
  }
  function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveEvents(list) {
    if (list.length > 8000) list = list.slice(-8000);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  }
  function pushEvent(evt) {
    var list = loadEvents();
    list.push(evt);
    saveEvents(list);
    return evt;
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
  function propById(id) {
    return catalog.find(function (p) { return p.id === id; });
  }
  function ownerName(id) {
    if (!id) return "—";
    var u = state.users.find(function (x) { return x.id === id; });
    return u ? (u.name || u.username) : "—";
  }

  function metricsFor(propertyId, days) {
    days = days || 7;
    var since = daysAgo(days);
    var ev = loadEvents().filter(function (e) {
      if (propertyId && e.propertyId !== propertyId) return false;
      return e.ts >= since;
    });
    function count(t) { return ev.filter(function (e) { return e.type === t; }).length; }
    var views = count("detail_view");
    var card = count("card_click");
    var map = count("map_pin_click");
    var wa = count("whatsapp_click");
    var email = count("email_click");
    var visits = count("visit_scheduled");
    var rented = count("rented");
    var clicks = card + map;
    var intent = wa + email;
    var score = Math.min(100, Math.round(views * 3 + clicks * 2 + intent * 12 + visits * 20));
    var label = score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
    return {
      views: views, card: card, map: map, clicks: clicks,
      wa: wa, email: email, intent: intent, visits: visits, rented: rented,
      score: score, label: label, events: ev
    };
  }

  function seriesByDay(propertyId, days) {
    days = days || 14;
    var buckets = {};
    var labels = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(daysAgo(i));
      var key = d.toISOString().slice(0, 10);
      labels.push(key);
      buckets[key] = { views: 0, intent: 0, visits: 0 };
    }
    loadEvents().forEach(function (e) {
      if (propertyId && e.propertyId !== propertyId) return;
      var key = new Date(e.ts).toISOString().slice(0, 10);
      if (!buckets[key]) return;
      if (e.type === "detail_view" || e.type === "card_click" || e.type === "map_pin_click") buckets[key].views++;
      if (e.type === "whatsapp_click" || e.type === "email_click") buckets[key].intent++;
      if (e.type === "visit_scheduled") buckets[key].visits++;
    });
    return {
      labels: labels.map(function (k) { return fmtDay(k); }),
      views: labels.map(function (k) { return buckets[k].views; }),
      intent: labels.map(function (k) { return buckets[k].intent; }),
      visits: labels.map(function (k) { return buckets[k].visits; })
    };
  }

  function destroyCharts() {
    chartInstances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = [];
  }

  function drawLineChart(canvasId, series) {
    if (typeof Chart === "undefined") return;
    var el = document.getElementById(canvasId);
    if (!el) return;
    var ctx = el.getContext("2d");
    var ch = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          { label: "Interés", data: series.views, borderColor: "#c9a87c", backgroundColor: "rgba(201,168,124,.15)", tension: 0.35, fill: true },
          { label: "Consultas", data: series.intent, borderColor: "#3dd68c", backgroundColor: "transparent", tension: 0.35 },
          { label: "Visitas", data: series.visits, borderColor: "#7aa2ff", backgroundColor: "transparent", tension: 0.35 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "rgba(245,245,247,.7)", boxWidth: 12 } } },
        scales: {
          x: { ticks: { color: "rgba(245,245,247,.45)", maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { color: "rgba(255,255,255,.04)" } },
          y: { beginAtZero: true, ticks: { color: "rgba(245,245,247,.45)", precision: 0 }, grid: { color: "rgba(255,255,255,.06)" } }
        }
      }
    });
    chartInstances.push(ch);
  }

  function drawDoughnut(canvasId, m) {
    if (typeof Chart === "undefined") return;
    var el = document.getElementById(canvasId);
    if (!el) return;
    var ch = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Fichas", "Cards/Mapa", "WhatsApp", "Email", "Visitas"],
        datasets: [{
          data: [m.views, m.clicks, m.wa, m.email, m.visits],
          backgroundColor: ["#c9a87c", "#8b7355", "#3dd68c", "#7aa2ff", "#f5a524"]
        }]
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: "rgba(245,245,247,.7)", boxWidth: 10, font: { size: 11 } } } }
      }
    });
    chartInstances.push(ch);
  }

  async function loadCatalog() {
    var map = {};
    function addList(list) {
      (list || []).forEach(function (p) { if (p && p.id) map[p.id] = p; });
    }
    for (var i = 1; i <= 3; i++) {
      try {
        var res = await fetch("../data" + i + ".js?t=" + Date.now());
        if (!res.ok) continue;
        var text = await res.text();
        var marker = "window.__RN_P" + i + "=";
        var idx = text.indexOf(marker);
        if (idx < 0) continue;
        var jsonPart = text.slice(idx + marker.length);
        var cut = jsonPart.search(/;[\s\n]*window\.|;[\s\n]*var |;[\s\n]*if\(/);
        if (cut > 0) jsonPart = jsonPart.slice(0, cut);
        jsonPart = jsonPart.replace(/;+\s*$/, "");
        addList(JSON.parse(jsonPart));
      } catch (e) {}
    }
    if (Object.keys(map).length < 10) {
      var paths = ["../catalog-a.json", "../catalog-b.json", "../catalog-c.json", "../catalog.json"];
      for (var j = 0; j < paths.length; j++) {
        try {
          var r2 = await fetch(paths[j] + "?t=" + Date.now());
          if (!r2.ok) continue;
          var data = await r2.json();
          addList(data.featured);
          addList(data.allProperties);
        } catch (e) {}
      }
    }
    catalog = Object.keys(map).map(function (k) { return map[k]; });
    catalog.sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
    catalog.forEach(function (p) { ensureProp(p.id); });
    saveState();
  }

  function go(r, param) {
    route = r;
    routeParam = param || null;
    destroyCharts();
    renderNav();
    render();
  }

  function showLogin() {
    destroyCharts();
    $("boot").hidden = true;
    $("appView").hidden = true;
    $("loginView").hidden = false;
  }
  function showApp() {
    $("boot").hidden = true;
    $("loginView").hidden = true;
    $("appView").hidden = false;
    user = currentUser();
    $("roleBadge").textContent = user.role === "admin" ? "Admin" : "Propietario";
    $("userLabel").textContent = user.name || user.username;
    renderNav();
    render();
  }

  function renderNav() {
    var items = user.role === "admin"
      ? [["home", "General"], ["inventory", "Inventario"], ["owners", "Propietarios"], ["activity", "Actividad"], ["export", "Exportar"]]
      : [["home", "Resumen"], ["myprops", "Mis propiedades"], ["activity", "Actividad"]];
    $("nav").innerHTML = items.map(function (it) {
      var active = route === it[0] || (route === "detail" && it[0] === (user.role === "admin" ? "inventory" : "myprops"));
      return '<button type="button" data-route="' + it[0] + '" class="' + (active ? "active" : "") + '">' + it[1] + "</button>";
    }).join("");
    $("nav").querySelectorAll("button").forEach(function (btn) {
      btn.onclick = function () { go(btn.getAttribute("data-route")); };
    });
  }

  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div>' +
      (sub ? '<div class="s">' + esc(sub) + "</div>" : "") + "</div>";
  }
  function statusClass(st) { return "status " + (st || "published"); }

  function statusCounts() {
    var c = { published: 0, paused: 0, reserved: 0, rented: 0, draft: 0 };
    catalog.forEach(function (p) {
      var s = ensureProp(p.id).status || "published";
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }

  function visibleCatalog() {
    if (user.role === "admin") return catalog.slice();
    return catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id; });
  }

  /* ——— ADMIN / OWNER HOME ——— */
  function renderHome() {
    var scope = visibleCatalog();
    var m7 = metricsFor(null, 7);
    var m30 = metricsFor(null, 30);
    // if owner, filter events by their props
    if (user.role !== "admin") {
      var ids = {};
      scope.forEach(function (p) { ids[p.id] = true; });
      m7 = aggregateScoped(ids, 7);
      m30 = aggregateScoped(ids, 30);
    }
    var sc = statusCounts();
    if (user.role !== "admin") {
      sc = { published: 0, paused: 0, reserved: 0, rented: 0 };
      scope.forEach(function (p) {
        var s = ensureProp(p.id).status || "published";
        sc[s] = (sc[s] || 0) + 1;
      });
    }

    var ranked = scope.map(function (p) {
      return { p: p, m: metricsFor(p.id, 7) };
    }).sort(function (a, b) { return b.m.score - a.m.score; });

    var html = "";
    html += '<p class="section-title">' + (user.role === "admin" ? "Vista empresa · 7 días" : "Tu demanda · 7 días") + "</p>";
    html += '<div class="kpi-row">';
    html += kpi("Fichas", m7.views, "Inmersiones");
    html += kpi("Clicks", m7.clicks, "Card + mapa");
    html += kpi("Consultas", m7.intent, "WA " + m7.wa + " · Mail " + m7.email);
    html += kpi("Visitas", m7.visits, "Coordinadas");
    html += "</div>";
    html += '<div class="kpi-row">';
    html += kpi("Props", scope.length, "En alcance");
    html += kpi("Publicadas", sc.published || 0, "");
    html += kpi("Pausadas", sc.paused || 0, "");
    html += kpi("Rentadas", sc.rented || 0, "");
    html += "</div>";

    html += '<div class="charts-row">';
    html += '<div class="panel-block chart-card"><h2>Tendencia 14 días</h2><div class="chart-wrap"><canvas id="chartTrend"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Mix de interés 7d</h2><div class="chart-wrap sm"><canvas id="chartMix"></canvas></div></div>';
    html += "</div>";

    html += '<p class="section-title">Ranking por Pulse</p><div class="grid-cards">';
    ranked.slice(0, 12).forEach(function (row) {
      html += propCard(row.p, row.m);
    });
    html += "</div>";
    html += '<p class="note">30 días: ' + m30.views + ' fichas · ' + m30.intent + ' consultas · ' + m30.visits + ' visitas</p>';
    $("main").innerHTML = html;

    var series;
    if (user.role === "admin") series = seriesByDay(null, 14);
    else {
      // merge series for owner props
      series = seriesByDay(null, 14);
      // zero then recount scoped
      var ids = {};
      scope.forEach(function (p) { ids[p.id] = true; });
      series = scopedSeries(ids, 14);
    }
    setTimeout(function () {
      drawLineChart("chartTrend", series);
      drawDoughnut("chartMix", m7);
    }, 40);
    bindCardClicks();
  }

  function aggregateScoped(ids, days) {
    var since = daysAgo(days);
    var ev = loadEvents().filter(function (e) { return ids[e.propertyId] && e.ts >= since; });
    function count(t) { return ev.filter(function (e) { return e.type === t; }).length; }
    var views = count("detail_view"), card = count("card_click"), map = count("map_pin_click");
    var wa = count("whatsapp_click"), email = count("email_click"), visits = count("visit_scheduled");
    return { views: views, clicks: card + map, wa: wa, email: email, intent: wa + email, visits: visits };
  }
  function scopedSeries(ids, days) {
    var base = seriesByDay(null, days);
    // rebuild from scoped events
    var buckets = {};
    var labels = [];
    for (var i = days - 1; i >= 0; i--) {
      var key = new Date(daysAgo(i)).toISOString().slice(0, 10);
      labels.push(key);
      buckets[key] = { views: 0, intent: 0, visits: 0 };
    }
    loadEvents().forEach(function (e) {
      if (!ids[e.propertyId]) return;
      var key = new Date(e.ts).toISOString().slice(0, 10);
      if (!buckets[key]) return;
      if (e.type === "detail_view" || e.type === "card_click" || e.type === "map_pin_click") buckets[key].views++;
      if (e.type === "whatsapp_click" || e.type === "email_click") buckets[key].intent++;
      if (e.type === "visit_scheduled") buckets[key].visits++;
    });
    return {
      labels: labels.map(function (k) { return fmtDay(k); }),
      views: labels.map(function (k) { return buckets[k].views; }),
      intent: labels.map(function (k) { return buckets[k].intent; }),
      visits: labels.map(function (k) { return buckets[k].visits; })
    };
  }

  function propCard(p, m) {
    m = m || metricsFor(p.id, 7);
    var meta = ensureProp(p.id);
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w600") : "";
    return '<article class="pcard" data-open="' + esc(p.id) + '">' +
      '<div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div>' +
      '<div class="pcard-body">' +
      '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>" +
      '<div class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + "</div>" +
      '<div class="pulse-row"><div class="pulse-ring" style="--p:' + m.score + '"><span>' + m.score + "</span></div>" +
      '<div class="pulse-label">' + esc(m.label) + "<br/>" + m.views + " fichas · " + m.intent + " consultas · " + m.visits + " visitas</div></div>" +
      (user.role === "admin" ? '<div class="meta">Owner: ' + esc(ownerName(meta.ownerId)) + "</div>" : "") +
      '<button type="button" class="btn ghost sm" data-open="' + esc(p.id) + '">Ver detalle</button>' +
      "</div></article>";
  }

  function bindCardClicks() {
    $("main").querySelectorAll("[data-open]").forEach(function (el) {
      el.onclick = function (ev) {
        ev.preventDefault();
        go("detail", el.getAttribute("data-open"));
      };
    });
  }

  /* ——— DETAIL ——— */
  function renderDetail() {
    var p = propById(routeParam);
    if (!p) {
      $("main").innerHTML = '<div class="empty">Propiedad no encontrada. <button class="btn ghost sm" id="backBtn">Volver</button></div>';
      $("backBtn").onclick = function () { go(user.role === "admin" ? "inventory" : "myprops"); };
      return;
    }
    if (user.role !== "admin" && ensureProp(p.id).ownerId !== user.id) {
      $("main").innerHTML = '<div class="empty">Sin acceso a esta propiedad.</div>';
      return;
    }
    var meta = ensureProp(p.id);
    var m7 = metricsFor(p.id, 7);
    var m30 = metricsFor(p.id, 30);
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w900") : "";
    var nImg = (p.images && p.images.length) || 0;

    var html = '<button type="button" class="btn ghost sm" id="backBtn">← Volver</button>';
    html += '<div class="detail-hero" style="background-image:url(\'' + esc(img) + '\')"></div>';
    html += '<div class="detail-head"><h1>' + esc(p.name) + '</h1>';
    html += '<span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
    html += '<p class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + " · " + esc(p.price || "") + " · " + nImg + " fotos</p>";
    html += '<p class="meta">Owner: <strong>' + esc(ownerName(meta.ownerId)) + "</strong></p>";

    html += '<div class="kpi-row">';
    html += kpi("Pulse", m7.score, m7.label);
    html += kpi("Fichas 7d", m7.views, "30d: " + m30.views);
    html += kpi("Consultas 7d", m7.intent, "WA " + m7.wa + " · Mail " + m7.email);
    html += kpi("Visitas 7d", m7.visits, "30d: " + m30.visits);
    html += "</div>";

    html += '<div class="charts-row">';
    html += '<div class="panel-block chart-card"><h2>Actividad 14 días</h2><div class="chart-wrap"><canvas id="chartProp"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Embudo</h2><div class="funnel">';
    html += funnelRow("Clicks card/mapa", m7.clicks, m7.clicks);
    html += funnelRow("Ficha abierta", m7.views, Math.max(m7.clicks, m7.views, 1));
    html += funnelRow("Consulta", m7.intent, Math.max(m7.clicks, m7.views, 1));
    html += funnelRow("Visita", m7.visits, Math.max(m7.clicks, m7.views, 1));
    html += "</div></div></div>";

    if (user.role === "admin") {
      html += '<div class="panel-block"><h2>Gestión</h2><div class="form-row">';
      html += '<label>Status<select id="dStatus">';
      ["published", "paused", "reserved", "rented", "draft"].forEach(function (st) {
        html += '<option value="' + st + '"' + (meta.status === st ? " selected" : "") + ">" + st + "</option>";
      });
      html += "</select></label>";
      html += '<label>Propietario<select id="dOwner"><option value="">— Sin dueño —</option>';
      state.users.filter(function (u) { return u.role === "owner" && u.active !== false; }).forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (meta.ownerId === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
      });
      html += "</select></label></div>";
      html += '<div class="pcard-actions">';
      html += '<button type="button" class="btn gold sm" id="dSave">Guardar</button>';
      html += '<button type="button" class="btn ghost sm" id="dVisit">+ Visita</button>';
      html += '<button type="button" class="btn ghost sm" id="dRent">Marcar rentado</button>';
      html += '<a class="btn ghost sm" target="_blank" rel="noopener" href="../index.html">Abrir sitio</a>';
      html += "</div>";
      html += '<label class="field" style="margin-top:12px"><span>Nota interna</span>';
      html += '<input id="dNote" type="text" value="' + esc(meta.note || "") + '" placeholder="Ej. dueño pide pausa en agosto"/></label>';
      html += "</div>";
    }

    html += '<div class="panel-block"><h2>Timeline</h2><div class="feed">';
    var timeline = loadEvents().filter(function (e) { return e.propertyId === p.id; }).reverse().slice(0, 25);
    if (!timeline.length) html += '<div class="empty">Sin eventos aún en esta propiedad.</div>';
    var labels = {
      detail_view: "Abrió la ficha", card_click: "Click en catálogo", map_pin_click: "Click en mapa",
      whatsapp_click: "Consulta WhatsApp", email_click: "Consulta email",
      visit_scheduled: "Visita coordinada", rented: "Marcada rentada", status_changed: "Cambio de estado"
    };
    timeline.forEach(function (e) {
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time>" + esc(labels[e.type] || e.type) + "</div>";
    });
    html += "</div></div>";

    $("main").innerHTML = html;
    $("backBtn").onclick = function () { go(user.role === "admin" ? "inventory" : "myprops"); };
    setTimeout(function () { drawLineChart("chartProp", seriesByDay(p.id, 14)); }, 40);

    if (user.role === "admin") {
      $("dSave").onclick = function () {
        meta.status = $("dStatus").value;
        meta.ownerId = $("dOwner").value || null;
        meta.note = $("dNote").value.trim();
        saveState();
        pushEvent({ id: uid("ev"), type: "status_changed", propertyId: p.id, ts: now(), meta: { status: meta.status } });
        alert("Guardado");
        renderDetail();
      };
      $("dVisit").onclick = function () {
        pushEvent({ id: uid("ev"), type: "visit_scheduled", propertyId: p.id, ts: now() });
        alert("Visita registrada");
        renderDetail();
      };
      $("dRent").onclick = function () {
        meta.status = "rented";
        saveState();
        pushEvent({ id: uid("ev"), type: "rented", propertyId: p.id, ts: now() });
        renderDetail();
      };
    }
  }

  function funnelRow(label, val, max) {
    var pct = max ? Math.round((val / max) * 100) : 0;
    return '<div class="funnel-row"><span>' + esc(label) + '</span><div class="funnel-bar"><i style="width:' + pct + '%"></i></div><b>' + val + "</b></div>";
  }

  /* ——— INVENTORY ——— */
  function renderInventory() {
    var owners = state.users.filter(function (u) { return u.role === "owner" && u.active !== false; });
    var q = (window.__invQ || "").toLowerCase();
    var stf = window.__invSt || "all";
    var list = catalog.filter(function (p) {
      var meta = ensureProp(p.id);
      if (stf !== "all" && meta.status !== stf) return false;
      if (!q) return true;
      var hay = (p.name + " " + p.id + " " + (p.loc || "") + " " + (p.beds || "")).toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    var html = '<p class="section-title">Inventario ' + list.length + " / " + catalog.length + "</p>";
    html += '<div class="form-row">';
    html += '<label style="flex:2">Buscar<input id="invSearch" type="search" value="' + esc(window.__invQ || "") + '" placeholder="Nombre, zona…"/></label>';
    html += '<label>Status<select id="invSt"><option value="all">Todos</option>';
    ["published", "paused", "reserved", "rented", "draft"].forEach(function (st) {
      html += '<option value="' + st + '"' + (stf === st ? " selected" : "") + ">" + st + "</option>";
    });
    html += "</select></label></div>";
    html += '<div class="grid-cards">';
    list.forEach(function (p) {
      html += propCard(p, metricsFor(p.id, 7));
    });
    html += "</div>";
    $("main").innerHTML = html;
    $("invSearch").oninput = function () { window.__invQ = this.value; renderInventory(); };
    $("invSt").onchange = function () { window.__invSt = this.value; renderInventory(); };
    bindCardClicks();
  }

  function renderMyProps() {
    var list = visibleCatalog();
    var html = '<p class="section-title">Mis propiedades (' + list.length + ")</p>";
    if (!list.length) {
      html += '<div class="empty">Real Nort aún no te asignó unidades. Solo lectura cuando estén vinculadas.</div>';
    } else {
      html += '<div class="grid-cards">';
      list.forEach(function (p) { html += propCard(p, metricsFor(p.id, 7)); });
      html += "</div>";
    }
    $("main").innerHTML = html;
    bindCardClicks();
  }

  /* ——— OWNERS ——— */
  function renderOwners() {
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    var html = '<div class="panel-block"><h2>Crear propietario</h2>';
    html += '<p class="note">Solo admin crea cuentas y asigna props. El dueño no edita el anuncio.</p>';
    html += '<div class="form-row">';
    html += '<label>Nombre<input id="oName" type="text"/></label>';
    html += '<label>Usuario<input id="oUser" type="text"/></label>';
    html += '<label>Email avisos<input id="oEmail" type="email"/></label>';
    html += '<label>Teléfono<input id="oPhone" type="text"/></label>';
    html += '<label>Contraseña<input id="oPass" type="text" placeholder="mín. 6"/></label>';
    html += '</div><button type="button" class="btn gold" id="oCreate">Crear y mostrar acceso</button>';
    html += '<pre id="oCreds" class="note" style="display:none;white-space:pre-wrap"></pre></div>';

    html += '<p class="section-title">Propietarios (' + owners.length + ")</p>";
    html += '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Contacto</th><th>Props</th><th>Activo</th><th></th></tr></thead><tbody>';
    owners.forEach(function (o) {
      var n = catalog.filter(function (p) { return ensureProp(p.id).ownerId === o.id; }).length;
      html += "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.username) + "</td><td>" + esc(o.email || "") + "<div class='meta'>" + esc(o.phone || "") + "</div></td>";
      html += "<td>" + n + "</td><td>" + (o.active !== false ? "Sí" : "No") + "</td>";
      html += '<td><button type="button" class="btn danger sm" data-off="' + esc(o.id) + '">Desactivar</button></td></tr>';
    });
    html += "</tbody></table></div>";
    $("main").innerHTML = html;

    $("oCreate").onclick = function () {
      var username = $("oUser").value.trim().toLowerCase();
      var pass = $("oPass").value;
      if (!username || pass.length < 6) { alert("Usuario y contraseña (mín. 6) requeridos"); return; }
      if (state.users.some(function (u) { return u.username === username; })) { alert("Usuario ya existe"); return; }
      state.users.push({
        id: uid("own"), username: username, email: $("oEmail").value.trim(),
        phone: $("oPhone").value.trim(), name: $("oName").value.trim() || username,
        role: "owner", pass: hash(pass), active: true, notify: true
      });
      saveState();
      var box = $("oCreds");
      box.style.display = "block";
      box.textContent = "Pasale al propietario:\n\nUsuario: " + username + "\nContraseña: " + pass +
        "\nPanel: " + location.origin + location.pathname + "\n\nSolo verá métricas de sus props.";
      renderOwners();
    };
    $("main").querySelectorAll("[data-off]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-off");
        var u = state.users.find(function (x) { return x.id === id; });
        if (u) u.active = false;
        Object.keys(state.props).forEach(function (pid) {
          if (state.props[pid].ownerId === id) state.props[pid].ownerId = null;
        });
        saveState();
        renderOwners();
      };
    });
  }

  /* ——— ACTIVITY ——— */
  function renderActivity() {
    var ids = null;
    if (user.role !== "admin") {
      ids = {};
      visibleCatalog().forEach(function (p) { ids[p.id] = true; });
    }
    var events = loadEvents().filter(function (e) {
      return !ids || ids[e.propertyId];
    }).reverse().slice(0, 80);

    var labels = {
      detail_view: "Ficha", card_click: "Card", map_pin_click: "Mapa",
      whatsapp_click: "WhatsApp", email_click: "Email",
      visit_scheduled: "Visita", rented: "Rentado", status_changed: "Status"
    };
    var html = '<p class="section-title">Actividad reciente</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin eventos. Navegá el sitio público en este navegador para generar demanda.</div>';
    events.forEach(function (e) {
      var p = propById(e.propertyId);
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time><strong>" +
        esc(labels[e.type] || e.type) + "</strong> · " + esc(p ? p.name : e.propertyId || "—");
      if (p) html += ' <button type="button" class="btn ghost sm" data-open="' + esc(p.id) + '">Ver</button>';
      html += "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
    bindCardClicks();
  }

  /* ——— EXPORT ——— */
  function renderExport() {
    var lines = ["id,name,status,owner,views_7d,intent_7d,visits_7d,pulse"];
    catalog.forEach(function (p) {
      var meta = ensureProp(p.id);
      var m = metricsFor(p.id, 7);
      lines.push([
        p.id,
        JSON.stringify(p.name || ""),
        meta.status,
        JSON.stringify(ownerName(meta.ownerId)),
        m.views, m.intent, m.visits, m.score
      ].join(","));
    });
    var csv = lines.join("\n");
    var html = '<div class="panel-block"><h2>Exportar CSV</h2>';
    html += '<p class="note">Descarga métricas 7d de las ' + catalog.length + ' propiedades (este dispositivo).</p>';
    html += '<button type="button" class="btn gold" id="dlCsv">Descargar CSV</button>';
    html += '<button type="button" class="btn ghost" id="copyJson" style="margin-left:8px">Copiar JSON estado</button>';
    html += "</div>";
    $("main").innerHTML = html;
    $("dlCsv").onclick = function () {
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "nort-os-metricas.csv";
      a.click();
    };
    $("copyJson").onclick = function () {
      var payload = { state: state, events: loadEvents().slice(-500), exportedAt: new Date().toISOString() };
      navigator.clipboard.writeText(JSON.stringify(payload)).then(function () {
        alert("JSON copiado al portapapeles");
      });
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
      if (route === "export") return renderExport();
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
      $("loginErr").hidden = false;
      $("loginErr").textContent = "Credenciales incorrectas";
      return;
    }
    setSession(u);
    user = u;
    route = "home";
    showApp();
  }

  $("loginBtn").onclick = tryLogin;
  $("loginPass").addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  $("logoutBtn").onclick = function () { setSession(null); user = null; showLogin(); };

  (async function boot() {
    await loadCatalog();
    console.log("[NORT OS] catalog", catalog.length);
    $("boot").hidden = true;
    if (currentUser()) showApp();
    else showLogin();
  })();
})();
