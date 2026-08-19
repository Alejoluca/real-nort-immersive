/* NORT OS — CMS + control de precisión (GitHub Pages) */
(function () {
  "use strict";

  var STATE_KEY = "nort_os_v1";
  var EVENTS_KEY = "nort_os_events_v1";
  var SESSION_KEY = "nort_os_session_v1";
  var CONTENT_KEY = "nort_os_content_v1";
  var GH_TOKEN_KEY = "nort_gh_token";
  function getGhToken(){ return sessionStorage.getItem(GH_TOKEN_KEY) || localStorage.getItem(GH_TOKEN_KEY) || ""; }
  function setGhToken(t){ if(t){ localStorage.setItem(GH_TOKEN_KEY,t); sessionStorage.setItem(GH_TOKEN_KEY,t);} }

  var GDRIVE_KEY = "nort_gdrive_key";
  function getDriveKey(){ return localStorage.getItem(GDRIVE_KEY) || sessionStorage.getItem(GDRIVE_KEY) || ""; }
  function setDriveKey(k){ if(k){ localStorage.setItem(GDRIVE_KEY,k); sessionStorage.setItem(GDRIVE_KEY,k);} }

  function extractDriveFolderId(input) {
    var s = String(input || "").trim();
    if (!s) return null;
    var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    return null;
  }

  function parseDriveFolderInputs(text) {
    return String(text || "").split(/[\n,;]+/).map(function (x) { return x.trim(); }).filter(Boolean)
      .map(extractDriveFolderId).filter(Boolean)
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function driveImgUrl(fileId, w) {
    return "https://lh3.googleusercontent.com/d/" + fileId + "=w" + (w || 1600);
  }

  function isDriveImage(f) {
    var mt = (f.mimeType || "").toLowerCase();
    var n = (f.name || "").toLowerCase();
    if (mt.indexOf("image/") === 0 && mt.indexOf("heic") < 0 && mt.indexOf("heif") < 0) return true;
    return /\.(jpe?g|png|webp|gif)$/i.test(n);
  }

  async function driveFetchFolderMeta(folderId, key) {
    var url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(folderId) +
      "?fields=id,name,mimeType&key=" + encodeURIComponent(key);
    var res = await fetch(url);
    if (!res.ok) throw new Error("Carpeta " + folderId.slice(0, 8) + "… HTTP " + res.status + " (¿pública + API Key?)");
    return res.json();
  }

  async function driveListImages(folderId, key) {
    var files = [];
    var pageToken = null;
    do {
      var q = encodeURIComponent("'" + folderId + "' in parents and trashed=false");
      var url = "https://www.googleapis.com/drive/v3/files?q=" + q +
        "&fields=nextPageToken,files(id,name,mimeType)" +
        "&pageSize=200&orderBy=name_natural&key=" + encodeURIComponent(key);
      if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
      var res = await fetch(url);
      if (!res.ok) {
        var body = await res.text();
        throw new Error("Listado Drive HTTP " + res.status + " " + body.slice(0, 140));
      }
      var data = await res.json();
      (data.files || []).forEach(function (f) {
        if (isDriveImage(f)) files.push(f);
      });
      pageToken = data.nextPageToken || null;
    } while (pageToken);
    return files;
  }

  async function driveListSubfolders(folderId, key) {
    var q = encodeURIComponent("'" + folderId + "' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'");
    var url = "https://www.googleapis.com/drive/v3/files?q=" + q +
      "&fields=files(id,name)&pageSize=200&orderBy=name_natural&key=" + encodeURIComponent(key);
    var res = await fetch(url);
    if (!res.ok) return [];
    var data = await res.json();
    return data.files || [];
  }

  function propFromDriveFolder(folder, images) {
    var name = folder.name || "Propiedad Drive";
    var id = slugify(name);
    var base = id;
    var n = 2;
    while (catalog.some(function (p) { return p.id === id; }) || (content.custom || []).some(function (p) { return p.id === id; })) {
      id = base + "-" + n;
      n++;
    }
    var beds = "2 Recámaras";
    var bk = bedsKeyFrom(name);
    if (/estudio|loft|studio/i.test(name)) beds = "Estudio / Loft";
    else if (/\b1\s*rec/i.test(name)) beds = "1 Recámara";
    else if (/\b3\s*rec/i.test(name)) beds = "3 Recámaras";
    else if (/\b4/i.test(name)) beds = "4+ Recámaras";
    else if (/\b2\s*rec/i.test(name)) beds = "2 Recámaras";
    return {
      id: id,
      name: name,
      loc: "Tulum",
      beds: beds,
      bedsKey: bk,
      price: "Precio negociable",
      pricePin: "·",
      priceNight: "",
      tag: "Tulum · " + beds,
      desc: name + " — galería importada desde Google Drive. Consultá por WhatsApp.",
      images: images.map(function (f) { return driveImgUrl(f.id, 1600); }),
      lat: 20.211,
      lng: -87.465,
      regionKey: "tulum",
      status: "published",
      rentalType: "long",
      minNights: 2,
      blockedRanges: [],
      driveFolderId: folder.id,
      source: "drive-import"
    };
  }

  async function importDriveFolders(folderIds, opts) {
    opts = opts || {};
    var key = getDriveKey();
    if (!key) throw new Error("Falta Google API Key (Drive API habilitada)");
    var report = [];
    for (var i = 0; i < folderIds.length; i++) {
      var fid = folderIds[i];
      var meta = await driveFetchFolderMeta(fid, key);
      var images = await driveListImages(fid, key);
      if (!images.length && opts.subfolders !== false) {
        var subs = await driveListSubfolders(fid, key);
        if (subs.length) {
          for (var s = 0; s < subs.length; s++) {
            var subImgs = await driveListImages(subs[s].id, key);
            if (!subImgs.length) {
              report.push({ id: subs[s].id, name: subs[s].name, ok: false, reason: "sin imágenes" });
              continue;
            }
            var prop = propFromDriveFolder(subs[s], subImgs);
            content.custom = (content.custom || []).filter(function (c) { return c.driveFolderId !== subs[s].id; });
            content.custom.push(prop);
            content.deleted = (content.deleted || []).filter(function (id) { return id !== prop.id; });
            ensureProp(prop.id);
            report.push({ id: prop.id, name: prop.name, ok: true, images: subImgs.length });
          }
          continue;
        }
      }
      if (!images.length) {
        report.push({ id: fid, name: meta.name, ok: false, reason: "sin imágenes" });
        continue;
      }
      var prop2 = propFromDriveFolder(meta, images);
      content.custom = (content.custom || []).filter(function (c) { return c.driveFolderId !== meta.id; });
      content.custom.push(prop2);
      content.deleted = (content.deleted || []).filter(function (id) { return id !== prop2.id; });
      ensureProp(prop2.id);
      report.push({ id: prop2.id, name: prop2.name, ok: true, images: images.length });
    }
    saveContent();
    rebuildCatalog();
    return report;
  }


  var charts = [];
  var periodDays = 7;


  function toast(msg, kind) {
    var host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = String(msg || "");
    host.appendChild(el);
    setTimeout(function () {
      try { el.remove(); } catch (e) {}
    }, 3200);
  }

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
  function slugify(s) {
    return String(s || "prop").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "prop";
  }
  function bedsKeyFrom(beds) {
    var m = String(beds || "").match(/(\d+)/);
    if (m) return m[1];
    if (/estudio/i.test(beds || "")) return "1";
    return "2";
  }
  function pricePinFrom(price) {
    var m = String(price || "").replace(/,/g, "").match(/(\d+)/);
    if (!m) return "·";
    var n = Number(m[1]);
    if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
    return "$" + n;
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

  function defaultContent() {
    return { version: 1, updatedAt: null, deleted: [], props: {}, custom: [], livePreview: true };
  }
  function loadContent() {
    try {
      var c = JSON.parse(localStorage.getItem(CONTENT_KEY) || "null");
      if (!c) return defaultContent();
      c.props = c.props || {}; c.custom = c.custom || []; c.deleted = c.deleted || [];
      return c;
    } catch (e) { return defaultContent(); }
  }
  function saveContent() {
    content.updatedAt = new Date().toISOString();
    localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
  }

  var state = loadState();
  var content = loadContent();
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

  var baseCatalog = [];
  var catalog = [];
  var route = "home";
  var routeParam = null;
  var user = null;


  function assignPropsToOwner(ownerId, propIds) {
    propIds = propIds || [];
    var set = {};
    propIds.forEach(function (id) { set[id] = true; });
    // clear previous ownership for this owner on catalog props, then set selected
    catalog.forEach(function (p) {
      var meta = ensureProp(p.id);
      if (meta.ownerId === ownerId && !set[p.id]) {
        meta.ownerId = null;
        content.props[p.id] = Object.assign({}, content.props[p.id] || {}, { ownerId: null });
      }
    });
    propIds.forEach(function (pid) {
      var meta = ensureProp(pid);
      meta.ownerId = ownerId;
      content.props[pid] = Object.assign({}, content.props[pid] || {}, { ownerId: ownerId });
      // also on custom entries
      (content.custom || []).forEach(function (c) {
        if (c.id === pid) c.ownerId = ownerId;
      });
    });
    saveState();
    saveContent();
    rebuildCatalog();
  }

  function syncUsersFromContent() {
    if (!content.users || !content.users.length) return;
    var byUser = {};
    state.users.forEach(function (u) { byUser[u.username] = u; });
    content.users.forEach(function (u) {
      if (!u || !u.username) return;
      var existing = state.users.find(function (x) { return x.id === u.id || x.username === u.username; });
      if (existing) {
        existing.name = u.name || existing.name;
        existing.email = u.email || existing.email;
        existing.phone = u.phone || existing.phone;
        existing.role = u.role || existing.role;
        existing.active = u.active !== false;
        if (u.pass) existing.pass = u.pass;
        if (u.id) existing.id = u.id;
      } else if (u.role === "owner") {
        state.users.push({
          id: u.id || uid("own"),
          username: u.username,
          email: u.email || "",
          phone: u.phone || "",
          name: u.name || u.username,
          role: "owner",
          pass: u.pass || hash("changeme"),
          active: u.active !== false
        });
      }
    });
    // apply ownerIds from content.props into state
    Object.keys(content.props || {}).forEach(function (pid) {
      var o = content.props[pid];
      if (!o) return;
      var meta = ensureProp(pid);
      if (o.ownerId !== undefined) meta.ownerId = o.ownerId;
      if (o.status) meta.status = o.status;
      if (o.note !== undefined) meta.note = o.note;
    });
    saveState();
  }

  function publishableUsers() {
    return state.users
      .filter(function (u) { return u.role === "owner" || u.role === "admin"; })
      .map(function (u) {
        return {
          id: u.id,
          username: u.username,
          email: u.email || "",
          phone: u.phone || "",
          name: u.name || u.username,
          role: u.role,
          pass: u.pass,
          active: u.active !== false
        };
      });
  }


  function ensureProp(id) {
    if (!state.props[id]) state.props[id] = { status: "published", ownerId: null, note: "" };
    return state.props[id];
  }

  function getPatch(id) {
    return (content.props && content.props[id]) || null;
  }

  function resolvedProp(base) {
    if (!base || !base.id) return null;
    if ((content.deleted || []).indexOf(base.id) >= 0) return null;
    var patch = getPatch(base.id) || {};
    var meta = ensureProp(base.id);
    var m = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) m[k] = base[k];
    for (var j in patch) {
      if (patch[j] === undefined) continue;
      if (patch[j] === null && j !== "ownerId") continue;
      m[j] = patch[j];
    }
    if (!m.status) m.status = meta.status || "published";
    if (m.ownerId == null && meta.ownerId) m.ownerId = meta.ownerId;
    if (meta.note && !m.note) m.note = meta.note;
    return m;
  }

  function rebuildCatalog() {
    var map = {};
    baseCatalog.forEach(function (p) {
      var r = resolvedProp(p);
      if (r) map[r.id] = r;
    });
    (content.custom || []).forEach(function (p) {
      if (!p || !p.id) return;
      if ((content.deleted || []).indexOf(p.id) >= 0) return;
      map[p.id] = p;
    });
    catalog = Object.keys(map).map(function (k) { return map[k]; });
    catalog.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "es"); });
    catalog.forEach(function (p) { ensureProp(p.id); });
  }

  function propById(id) { return catalog.find(function (p) { return p.id === id; }); }
  function ownerName(id) {
    if (!id) return "Sin dueño";
    var u = state.users.find(function (x) { return x.id === id; });
    return u ? (u.name || u.username) : "—";
  }

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
      visits: visits, rented: rented, score: score, label: label,
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
    baseCatalog = Object.keys(map).map(function (k) { return map[k]; });
    rebuildCatalog();
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
      ? [["home", "General"], ["inventory", "Inventario"], ["owners", "Owners"], ["activity", "Actividad"], ["tools", "Publicar"]]
      : [["home", "Resumen"], ["myprops", "Mis props"], ["activity", "Actividad"]];
    $("nav").innerHTML = items.map(function (it) {
      var active = route === it[0] || (route === "edit" && it[0] === "inventory") || (route === "detail" && (it[0] === "inventory" || it[0] === "myprops"));
      return '<button type="button" data-route="' + it[0] + '"' +
        (active ? ' class="active" aria-current="page"' : "") +
        ' aria-label="' + it[1] + '">' + it[1] + "</button>";
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
    return catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id || p.ownerId === user.id; });
  }
  function idSet(list) {
    var o = {}; list.forEach(function (p) { o[p.id] = true; }); return o;
  }
  function periodTabs() {
    return '<div class="period-tabs">' + [7, 30, 90].map(function (d) {
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
    var st = p.status || meta.status || "published";
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w700") : "";
    return '<article class="pcard">' +
      '<div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')" data-open="' + esc(p.id) + '"></div><div class="pcard-body">' +
      '<div class="pcard-top"><h3 data-open="' + esc(p.id) + '">' + esc(p.name) + '</h3><span class="' + statusClass(st) + '">' + esc(st) + "</span></div>" +
      '<div class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + "</div>" +
      '<div class="meta" style="color:#e8d5b5;font-weight:500">' + esc(p.price || "Precio negociable") + "</div>" +
      '<div class="pulse-row"><div class="pulse-ring" style="--p:' + m.score + '"><span>' + m.score + "</span></div>" +
      '<div class="pulse-label">' + esc(m.label) + "<br/>" + m.views + " · " + m.intent + " · " + m.visits + "</div></div>" +
      (user.role === "admin" ? '<div class="meta">Owner: ' + esc(ownerName(meta.ownerId || p.ownerId)) + "</div>" : "") +
      '<div class="pcard-actions">' +
      '<button type="button" class="btn ghost sm" data-open="' + esc(p.id) + '">Métricas</button>' +
      (user.role === "admin" ? '<button type="button" class="btn gold sm" data-edit="' + esc(p.id) + '">Editar</button>' : "") +
      "</div></div></article>";
  }
  function bindCards() {
    $("main").querySelectorAll("[data-open]").forEach(function (el) {
      el.onclick = function (e) { e.preventDefault(); e.stopPropagation(); go("detail", el.getAttribute("data-open")); };
    });
    $("main").querySelectorAll("[data-edit]").forEach(function (el) {
      el.onclick = function (e) { e.preventDefault(); e.stopPropagation(); go("edit", el.getAttribute("data-edit")); };
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

  function renderHome() {
    var scope = visibleCatalog();
    var ids = user.role === "admin" ? null : idSet(scope);
    var m = scopeMetrics(ids);
    var sync = window.__nortSync || {};

    var unassigned = catalog.filter(function (p) { return !(ensureProp(p.id).ownerId || p.ownerId); }).length;
    var paused = scope.filter(function (p) { return (p.status || ensureProp(p.id).status) === "paused"; }).length;
    var rented = scope.filter(function (p) { return (p.status || ensureProp(p.id).status) === "rented"; }).length;
    var published = scope.filter(function (p) {
      var s = p.status || ensureProp(p.id).status || "published";
      return s === "published" || s === "reserved";
    }).length;
    var ranked = scope.map(function (p) { return { p: p, m: metricsFor(p.id) }; })
      .sort(function (a, b) { return b.m.score - a.m.score; });

    var html = periodTabs();
    html += '<div class="alert-strip">';
    if (user.role === "admin") {
      var synced = sync.status === "synced";
      html += '<span class="sync-pill' + (synced ? "" : " warn") + '"><i></i>' +
        (synced ? ("Sincronizado" + (content.updatedAt ? " · " + String(content.updatedAt).slice(0, 16).replace("T", " ") : "")) : "Solo local · publicá para el equipo") +
        "</span>";
    }

    html += '<span class="alert-chip ok">' + scope.length + " props</span>";
    if (user.role === "admin" && unassigned) html += '<span class="alert-chip warn">' + unassigned + " sin dueño</span>";
    if (paused) html += '<span class="alert-chip warn">' + paused + " pausadas</span>";
    html += '<span class="alert-chip">' + published + " visibles</span>";
    html += '<span class="alert-chip">' + rented + " rentadas</span></div>";
    html += '<div class="kpi-row">' + kpi("Fichas", m.views, periodDays + "d") + kpi("Clicks", m.clicks, "Card+mapa") + kpi("Consultas", m.intent, "WA " + m.wa + " · Mail " + m.email) + kpi("Visitas", m.visits, "") + "</div>";
    html += '<div class="kpi-row">' + kpi("Conv. ficha", pct(m.views, m.clicks || m.views) + "%", "") + kpi("Conv. consulta", pct(m.intent, m.views || 1) + "%", "") + kpi("Conv. visita", pct(m.visits, m.intent || 1) + "%", "") + kpi("Pend. publicar", Object.keys(content.props || {}).length + (content.custom || []).length, "cambios locales") + "</div>";
    html += '<div class="charts-row"><div class="panel-block chart-card"><h2>Tendencia 14d</h2><div class="chart-wrap"><canvas id="cTrend"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Mix</h2><div class="chart-wrap sm"><canvas id="cMix"></canvas></div></div></div>';
    html += '<p class="section-title">Ranking</p><div class="grid-cards">';
    ranked.slice(0, 12).forEach(function (r) { html += propCard(r.p, r.m); });
    html += "</div>";
    $("main").innerHTML = html;
    bindPeriod(); bindCards();
    setTimeout(function () { chartLine("cTrend", seriesByDay(ids, 14)); chartDonut("cMix", m); }, 30);
  }

  /* ——— EDITOR CMS ——— */
  function renderEdit() {
    if (user.role !== "admin") {
      $("main").innerHTML = '<div class="empty">Solo admin</div>'; return;
    }
    var isNew = routeParam === "__new__";
    var p = isNew ? {
      id: "", name: "", loc: "", beds: "2 Recámaras", bedsKey: "2",
      price: "", pricePin: "", priceNight: "", tag: "", desc: "", images: [],
      lat: 20.211, lng: -87.465, regionKey: "tulum", status: "published",
      rentalType: "long", minNights: 2, blockedRanges: []
    } : propById(routeParam);
    if (!p) {
      $("main").innerHTML = '<div class="empty">No encontrada <button class="btn ghost sm" id="backBtn">Volver</button></div>';
      $("backBtn").onclick = function () { go("inventory"); };
      return;
    }
    var meta = p.id ? ensureProp(p.id) : { status: "published", ownerId: null, note: "" };
    var imgs = (p.images || []).slice();
    var html = '<button type="button" class="btn ghost sm" id="backBtn">← Inventario</button>';
    html += '<p class="section-title">' + (isNew ? "Nueva propiedad" : "Editar contenido") + "</p>";
    html += '<div class="panel-block"><h2>Identidad y precio</h2><div class="form-row">';
    html += '<label style="flex:2">Título<input id="eName" value="' + esc(p.name) + '"/></label>';
    html += '<label>Zona / loc<input id="eLoc" value="' + esc(p.loc || "") + '"/></label></div>';
    html += '<div class="form-row">';
    html += '<label>Dormitorios<input id="eBeds" value="' + esc(p.beds || "") + '" placeholder="2 Recámaras"/></label>';
    html += '<label>Precio público<input id="ePrice" value="' + esc(p.price || "") + '" placeholder="$25,000 MXN / mes"/></label>';
    html += '<label>Pin mapa<input id="ePin" value="' + esc(p.pricePin || "") + '" placeholder="$25k"/></label></div>';
    html += '<div class="form-row">';
    html += '<label>Tag<input id="eTag" value="' + esc(p.tag || "") + '"/></label>';
    html += '<label>Lat<input id="eLat" type="number" step="any" value="' + esc(p.lat != null ? p.lat : "") + '"/></label>';
    html += '<label>Lng<input id="eLng" type="number" step="any" value="' + esc(p.lng != null ? p.lng : "") + '"/></label></div>';
    html += '<label class="field"><span>Descripción</span><textarea id="eDesc" rows="5" style="background:#0a0a0c;border:1px solid var(--line);border-radius:14px;padding:12px;color:var(--text);font-size:14px;width:100%;resize:vertical">' + esc(p.desc || "") + "</textarea></label></div>";

    html += '<div class="panel-block"><h2>Modalidad de renta</h2><div class="form-row">';
    html += '<label>Tipo<select id="eRental">';
    [["long","Solo largo plazo"],["vacation","Solo vacacional"],["both","Ambas"]].forEach(function(opt){
      html += '<option value="'+opt[0]+'"'+((p.rentalType||"long")===opt[0]?" selected":"")+'>'+opt[1]+'</option>';
    });
    html += '</select></label>';
    html += '<label>Precio / noche<input id="ePriceNight" value="'+esc(p.priceNight||"")+'" placeholder="$3,500 MXN / noche"/></label>';
    html += '<label>Mín. noches<input id="eMinNights" type="number" min="1" value="'+(p.minNights||2)+'"/></label>';
    html += '</div><p class="note">Largo plazo: precio mensual arriba. Vacacional: calendario público + mensaje con fechas. Sin reserva online.</p></div>';

    html += '<div class="panel-block" id="eCalBlock"><h2>Calendario ocupado (vacacional)</h2>';
    html += '<p class="note">Tocá un día para marcar/desmarcar ocupado. O usá rango abajo.</p>';
    html += '<div id="eCal"></div>';
    html += '<div class="form-row"><label>Desde<input id="eBlkFrom" type="date"/></label><label>Hasta<input id="eBlkTo" type="date"/></label></div>';
    html += '<button type="button" class="btn ghost sm" id="eBlkAdd">Marcar rango ocupado</button>';
    html += '<button type="button" class="btn danger sm" id="eBlkClr">Limpiar calendario</button>';
    html += '<div id="eBlkList" class="feed" style="margin-top:10px"></div></div>';

    html += '<div class="panel-block"><h2>Disponibilidad y dueño</h2><div class="form-row">';
    html += '<label>Status<select id="eStatus">';
    ["published", "reserved", "paused", "rented", "draft"].forEach(function (st) {
      var cur = p.status || meta.status || "published";
      html += '<option value="' + st + '"' + (cur === st ? " selected" : "") + ">" + st + "</option>";
    });
    html += '</select></label><label>Propietario<select id="eOwner"><option value="">— Sin dueño —</option>';
    state.users.filter(function (u) { return u.role === "owner" && u.active !== false; }).forEach(function (o) {
      var cur = meta.ownerId || p.ownerId || "";
      html += '<option value="' + esc(o.id) + '"' + (cur === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
    });
    html += '</select></label></div>';
    html += '<label class="field"><span>Nota interna</span><input id="eNote" value="' + esc(meta.note || p.note || "") + '"/></label>';
    html += '<p class="note">published/reserved = visibles en el sitio · paused/rented/draft = ocultas al público tras publicar</p></div>';

    html += '<div class="panel-block"><h2>Imágenes (' + imgs.length + ')</h2>';
    html += '<p class="note">Pegá URLs de Google Drive (lh3.googleusercontent.com/d/ID) u otras HTTPS. Orden = orden del carrusel.</p>';
    html += '<div id="imgList" class="feed">';
    imgs.forEach(function (u, i) {
      html += '<div class="feed-item" data-i="' + i + '" style="display:flex;gap:8px;align-items:center">';
      html += '<i style="flex:0 0 56px;height:40px;border-radius:8px;background:#222 center/cover;background-image:url(\'' + esc(String(u).replace(/=w\\d+/, "=w120")) + '\')"></i>';
      html += '<input data-img="' + i + '" value="' + esc(u) + '" style="flex:1;background:#0a0a0c;border:1px solid var(--line);border-radius:10px;padding:8px;color:var(--text);font-size:12px"/>';
      html += '<button type="button" class="btn ghost sm" data-up="' + i + '">↑</button>';
      html += '<button type="button" class="btn ghost sm" data-dn="' + i + '">↓</button>';
      html += '<button type="button" class="btn danger sm" data-rm="' + i + '">×</button></div>';
    });
    html += '</div><div class="form-row" style="margin-top:10px">';
    html += '<label style="flex:1">Nueva URL<input id="eNewImg" placeholder="https://lh3.googleusercontent.com/d/..."/></label></div>';
    html += '<button type="button" class="btn ghost sm" id="addImg">+ Agregar imagen</button></div>';

    if (isNew) {
      html += '<div class="panel-block"><h2>ID</h2><label class="field"><span>ID único (auto si vacío)</span><input id="eId" placeholder="aldea-zama-mi-depto"/></label></div>';
    } else {
      html += '<p class="meta">ID: <code>' + esc(p.id) + "</code></p>";
    }

    html += '<div class="toolbar" style="margin-top:14px">';
    html += '<button type="button" class="btn gold" id="eSave">Guardar cambios</button>';
    if (!isNew) html += '<button type="button" class="btn danger" id="eDel">Quitar del catálogo</button>';
    html += '<button type="button" class="btn ghost" id="ePub">Guardar y ir a Publicar</button></div>';
    html += '<p class="note">Los cambios quedan en este dispositivo. Usá <strong>Publicar</strong> para subirlos al sitio real (GitHub).</p>';

    $("main").innerHTML = html;
    $("backBtn").onclick = function () { go("inventory"); };

    // blocked ranges state
    window.__editBlocked = (p.blockedRanges || []).map(function (r) {
      return { start: r.start || r.from, end: r.end || r.to || r.start || r.from };
    });
    var calState = { y: new Date().getFullYear(), m: new Date().getMonth() };

    function paintAdminCal() {
      var host = $("eCal");
      var list = $("eBlkList");
      if (!host) return;
      // inline mini month without RNAvail dependency
      function pad(n){return n<10?"0"+n:""+n}
      function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
      function parse(s){var p=String(s).split("-");return new Date(+p[0],+p[1]-1,+p[2])}
      function blockedSet(){
        var set={};
        (window.__editBlocked||[]).forEach(function(r){
          var a=parse(r.start),b=parse(r.end||r.start);
          if(b<a){var t=a;a=b;b=t}
          for(var d=new Date(a);d<=b;d.setDate(d.getDate()+1)) set[iso(d)]=true;
        });
        return set;
      }
      var set=blockedSet();
      var months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      var first=new Date(calState.y,calState.m,1);
      var startPad=(first.getDay()+6)%7;
      var days=new Date(calState.y,calState.m+1,0).getDate();
      var html='<div class="rn-cal"><div class="rn-cal-head">';
      html+='<button type="button" class="rn-cal-nav" id="calPrev">‹</button>';
      html+='<span class="rn-cal-title">'+months[calState.m]+" "+calState.y+"</span>";
      html+='<button type="button" class="rn-cal-nav" id="calNext">›</button></div>';
      html+='<div class="rn-cal-dow"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="rn-cal-grid">';
      for(var i=0;i<startPad;i++) html+='<button type="button" class="rn-cal-day empty" disabled></button>';
      for(var d=1;d<=days;d++){
        var id=iso(new Date(calState.y,calState.m,d));
        var occ=!!set[id];
        html+='<button type="button" class="rn-cal-day '+(occ?"blocked":"free")+'" data-d="'+id+'">'+d+"</button>";
      }
      html+="</div></div>";
      host.innerHTML=html;
      $("calPrev").onclick=function(){calState.m--;if(calState.m<0){calState.m=11;calState.y--}paintAdminCal()};
      $("calNext").onclick=function(){calState.m++;if(calState.m>11){calState.m=0;calState.y++}paintAdminCal()};
      host.querySelectorAll("[data-d]").forEach(function(btn){
        btn.onclick=function(){
          var day=btn.getAttribute("data-d");
          // toggle single-day range
          var found=-1;
          (window.__editBlocked||[]).forEach(function(r,idx){
            if(r.start===day && r.end===day) found=idx;
          });
          if(found>=0) window.__editBlocked.splice(found,1);
          else {
            // if day inside a range, skip simple toggle — add single day block
            window.__editBlocked.push({start:day,end:day});
          }
          paintAdminCal();
        };
      });
      if(list){
        list.innerHTML=(window.__editBlocked||[]).map(function(r,idx){
          return '<div class="feed-item">'+esc(r.start)+(r.end&&r.end!==r.start?" → "+esc(r.end):"")+' <button type="button" class="btn danger sm" data-br="'+idx+'">Quitar</button></div>';
        }).join("") || '<div class="empty">Sin fechas ocupadas</div>';
        list.querySelectorAll("[data-br]").forEach(function(b){
          b.onclick=function(){
            window.__editBlocked.splice(Number(b.getAttribute("data-br")),1);
            paintAdminCal();
          };
        });
      }
      // show/hide cal based on rental type
      var block=$("eCalBlock");
      var rt=$("eRental")&&$("eRental").value;
      if(block) block.style.display=(rt==="vacation"||rt==="both")?"":"none";
    }
    paintAdminCal();
    if($("eRental")) $("eRental").onchange=function(){paintAdminCal()};
    if($("eBlkAdd")) $("eBlkAdd").onclick=function(){
      var a=$("eBlkFrom").value,b=$("eBlkTo").value||a;
      if(!a) return alert("Elegí fecha desde");
      window.__editBlocked.push({start:a,end:b});
      paintAdminCal();
    };
    if($("eBlkClr")) $("eBlkClr").onclick=function(){
      if(confirm("¿Limpiar todas las fechas ocupadas?")){window.__editBlocked=[];paintAdminCal()}
    };

    function readImgs() {
      var out = [];
      $("main").querySelectorAll("[data-img]").forEach(function (inp) {
        var v = inp.value.trim(); if (v) out.push(v);
      });
      return out;
    }
    function refreshImgs(arr) {
      // re-render image section only is hard; full re-save path uses current form - for reorder we re-render edit with temp
      window.__editImgs = arr;
      // mutate and re-call
      p.images = arr;
      renderEdit();
      // restore form fields from window? simpler: store draft
    }

    // keep draft of images on window during edit session
    if (!window.__editImgs || window.__editId !== (p.id || "__new__")) {
      window.__editImgs = imgs.slice();
      window.__editId = p.id || "__new__";
    }

    $("addImg").onclick = function () {
      var v = $("eNewImg").value.trim();
      if (!v) return;
      window.__editImgs.push(v);
      $("eNewImg").value = "";
      // update list without losing form: store form values
      stashAndRerender(p);
    };
    $("main").querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.getAttribute("data-rm"));
        window.__editImgs.splice(i, 1);
        stashAndRerender(p);
      };
    });
    $("main").querySelectorAll("[data-up]").forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.getAttribute("data-up"));
        if (i <= 0) return;
        var a = window.__editImgs; var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t;
        stashAndRerender(p);
      };
    });
    $("main").querySelectorAll("[data-dn]").forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.getAttribute("data-dn"));
        var a = window.__editImgs;
        if (i >= a.length - 1) return;
        var t = a[i + 1]; a[i + 1] = a[i]; a[i] = t;
        stashAndRerender(p);
      };
    });

    function stashAndRerender(base) {
      window.__editDraft = collectForm(base);
      window.__editDraft.images = window.__editImgs.slice();
      // apply draft onto base for display
      Object.keys(window.__editDraft).forEach(function (k) { base[k] = window.__editDraft[k]; });
      renderEdit();
      if (window.__editDraft) {
        // restore inputs after render
        var d = window.__editDraft;
        if ($("eName")) $("eName").value = d.name || "";
        if ($("eLoc")) $("eLoc").value = d.loc || "";
        if ($("eBeds")) $("eBeds").value = d.beds || "";
        if ($("ePrice")) $("ePrice").value = d.price || "";
        if ($("ePin")) $("ePin").value = d.pricePin || "";
        if ($("eTag")) $("eTag").value = d.tag || "";
        if ($("eLat")) $("eLat").value = d.lat != null ? d.lat : "";
        if ($("eLng")) $("eLng").value = d.lng != null ? d.lng : "";
        if ($("eDesc")) $("eDesc").value = d.desc || "";
        if ($("eStatus")) $("eStatus").value = d.status || "published";
        if ($("eNote")) $("eNote").value = d.note || "";
        if ($("eOwner") && d.ownerId) $("eOwner").value = d.ownerId;
        if ($("eId") && d.id) $("eId").value = d.id;
      }
    }

    function collectForm(base) {
      var price = $("ePrice").value.trim();
      var pin = $("ePin").value.trim() || pricePinFrom(price);
      var beds = $("eBeds").value.trim();
      var name = $("eName").value.trim();
      var loc = $("eLoc").value.trim();
      return {
        id: base.id || ($("eId") && $("eId").value.trim()) || slugify(name + "-" + loc),
        name: name,
        loc: loc,
        beds: beds,
        bedsKey: bedsKeyFrom(beds),
        price: price,
        pricePin: pin,
        priceNight: ($("ePriceNight") && $("ePriceNight").value.trim()) || "",
        rentalType: ($("eRental") && $("eRental").value) || "long",
        minNights: ($("eMinNights") && Number($("eMinNights").value)) || 2,
        blockedRanges: window.__editBlocked || base.blockedRanges || [],
        tag: $("eTag").value.trim() || (loc + (beds ? " · " + beds : "")),
        desc: $("eDesc").value.trim(),
        lat: $("eLat").value !== "" ? Number($("eLat").value) : base.lat,
        lng: $("eLng").value !== "" ? Number($("eLng").value) : base.lng,
        regionKey: base.regionKey || "tulum",
        status: $("eStatus").value,
        ownerId: $("eOwner").value || null,
        note: $("eNote").value.trim(),
        images: readImgs().length ? readImgs() : (window.__editImgs || base.images || [])
      };
    }

    function persist(goPublish) {
      var data = collectForm(p);
      if (!data.name) return alert("El título es obligatorio");
      if (!data.images || !data.images.length) {
        if (!confirm("Sin imágenes. ¿Guardar igual?")) return;
      }
      // sync meta
      var meta2 = ensureProp(data.id);
      meta2.status = data.status;
      meta2.ownerId = data.ownerId;
      meta2.note = data.note;
      saveState();

      var isCustom = isNew || (content.custom || []).some(function (c) { return c.id === data.id; });
      var inBase = baseCatalog.some(function (b) { return b.id === data.id; });

      if (isNew || (isCustom && !inBase)) {
        content.custom = (content.custom || []).filter(function (c) { return c.id !== data.id; });
        content.custom.push(data);
        content.deleted = (content.deleted || []).filter(function (id) { return id !== data.id; });
      } else {
        // patch base property
        var patch = {
          name: data.name, loc: data.loc, beds: data.beds, bedsKey: data.bedsKey,
          price: data.price, pricePin: data.pricePin, priceNight: data.priceNight,
          rentalType: data.rentalType, minNights: data.minNights, blockedRanges: data.blockedRanges,
          tag: data.tag, desc: data.desc,
          lat: data.lat, lng: data.lng, status: data.status, images: data.images,
          note: data.note, ownerId: data.ownerId
        };
        content.props[data.id] = Object.assign({}, content.props[data.id] || {}, patch);
        content.deleted = (content.deleted || []).filter(function (id) { return id !== data.id; });
      }
      saveContent();
      rebuildCatalog();
      window.__editImgs = null; window.__editDraft = null; window.__editId = null;
      var token = getGhToken();
      if (token) {
        window.__nortQuietPub = true;
        publishToGitHub().then(function () {
          window.__nortSync.status = "synced";
          window.__nortSync.lastPub = new Date().toISOString();
          toast("Guardado y publicado", "ok");
          if (goPublish) go("tools");
          else go("edit", data.id);
        }).catch(function (err) {
          alert("Guardado local. Falló publicar: " + (err && err.message || "revisá token"));
          if (goPublish) go("tools");
          else go("edit", data.id);
        });
        return;
      }
      alert("Guardado local. Una sola vez: andá a Publicar, pegá el token GitHub y guardalo. Después cada edición se publica sola.");
      if (goPublish) go("tools");
      else go("edit", data.id);
    }

    $("eSave").onclick = function () { persist(false); };
    $("ePub").onclick = function () { persist(true); };
    if ($("eDel")) {
      $("eDel").onclick = function () {
        if (!confirm("¿Ocultar/quitar «" + p.name + "» del catálogo público?")) return;
        content.deleted = content.deleted || [];
        if (content.deleted.indexOf(p.id) < 0) content.deleted.push(p.id);
        content.custom = (content.custom || []).filter(function (c) { return c.id !== p.id; });
        delete content.props[p.id];
        saveContent();
        rebuildCatalog();
        if (getGhToken()) {
          window.__nortQuietPub = true;
          publishToGitHub().then(function(){ toast("Propiedad quitada y publicada", "ok"); go("inventory"); })
            .catch(function(){ alert("Quitada local. Publicá manualmente."); go("inventory"); });
        } else {
          alert("Quitada local. Configurá token en Publicar para auto-subir.");
          go("inventory");
        }
      };
    }
  }

  function renderDetail() {
    var p = propById(routeParam);
    if (!p) {
      $("main").innerHTML = '<div class="empty">No encontrada</div>'; return;
    }
    if (user.role !== "admin" && ensureProp(p.id).ownerId !== user.id && p.ownerId !== user.id) {
      $("main").innerHTML = '<div class="empty">Sin acceso</div>'; return;
    }
    var meta = ensureProp(p.id);
    var m = metricsFor(p.id);
    var m30 = metricsFor(p.id, 30);
    var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w1200") : "";
    var html = '<button type="button" class="btn ghost sm" id="backBtn">← Volver</button>';
    if (user.role === "admin") html += ' <button type="button" class="btn gold sm" id="toEdit">Editar contenido</button>';
    html += periodTabs();
    html += '<div class="detail-hero" style="background-image:url(\'' + esc(img) + '\')"></div>';
    html += '<div class="detail-head"><h1>' + esc(p.name) + '</h1><span class="' + statusClass(p.status || meta.status) + '">' + esc(p.status || meta.status || "published") + "</span></div>";
    html += '<p class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + '</p>';
    html += '<p class="meta" style="color:#e8d5b5;font-size:16px;font-weight:500">' + esc(p.price || "Precio negociable") + "</p>";
    html += '<div class="kpi-row">' + kpi("Pulse", m.score, m.label) + kpi("Fichas", m.views, "30d " + m30.views) + kpi("Consultas", m.intent, "WA " + m.wa) + kpi("Visitas", m.visits, "30d " + m30.visits) + "</div>";
    html += '<div class="charts-row"><div class="panel-block chart-card"><h2>14 días</h2><div class="chart-wrap"><canvas id="cProp"></canvas></div></div>';
    html += '<div class="panel-block chart-card"><h2>Embudo</h2><div class="funnel">';
    var base = Math.max(m.clicks, m.views, 1);
    function funnel(l, v) {
      return '<div class="funnel-row"><span>' + esc(l) + '</span><div class="funnel-bar"><i style="width:' + Math.round((v / base) * 100) + '%"></i></div><b>' + v + "</b></div>";
    }
    html += funnel("Clicks", m.clicks) + funnel("Ficha", m.views) + funnel("Consulta", m.intent) + funnel("Visita", m.visits);
    html += "</div></div></div>";
    if (user.role === "admin") {
      html += '<div class="pcard-actions"><button class="btn ghost sm" id="dVisit">+ Visita</button><button class="btn ghost sm" id="dRent">Rentado</button></div>';
    }
    $("main").innerHTML = html;
    $("backBtn").onclick = function () { go(user.role === "admin" ? "inventory" : "myprops"); };
    if ($("toEdit")) $("toEdit").onclick = function () { go("edit", p.id); };
    bindPeriod();
    setTimeout(function () {
      var o = {}; o[p.id] = true;
      chartLine("cProp", seriesByDay(o, 14));
    }, 30);
    if ($("dVisit")) $("dVisit").onclick = function () {
      pushEvent({ id: uid("ev"), type: "visit_scheduled", propertyId: p.id, ts: now() }); renderDetail();
    };
    if ($("dRent")) $("dRent").onclick = function () {
      var meta2 = ensureProp(p.id); meta2.status = "rented";
      content.props[p.id] = Object.assign({}, content.props[p.id] || {}, { status: "rented" });
      saveState(); saveContent(); rebuildCatalog();
      pushEvent({ id: uid("ev"), type: "rented", propertyId: p.id, ts: now() });
      renderDetail();
    };
  }

  function renderInventory() {
    var q = (window.__invQ || "").toLowerCase();
    var stf = window.__invSt || "all";
    var list = catalog.filter(function (p) {
      var st = p.status || ensureProp(p.id).status || "published";
      if (stf !== "all" && st !== stf) return false;
      if (!q) return true;
      return (p.name + " " + p.id + " " + (p.loc || "") + " " + (p.price || "")).toLowerCase().indexOf(q) >= 0;
    });
    list.sort(function (a, b) { return metricsFor(b.id).score - metricsFor(a.id).score; });
    var html = '<div class="toolbar"><button type="button" class="btn gold sm" id="btnNew">+ Nueva propiedad</button>';
    html += '<button type="button" class="btn ghost sm" id="btnPub">Publicar cambios</button></div>';
    html += '<p class="section-title">Inventario ' + list.length + " / " + catalog.length + "</p>" + periodTabs();
    html += '<div class="form-row"><label style="flex:2">Buscar<input id="invSearch" type="search" value="' + esc(window.__invQ || "") + '"/></label>';
    html += '<label>Status<select id="invSt"><option value="all">Todos</option>';
    ["published", "reserved", "paused", "rented", "draft"].forEach(function (st) {
      html += '<option value="' + st + '"' + (stf === st ? " selected" : "") + ">" + st + "</option>";
    });
    html += "</select></label></div><div class=\"grid-cards\">";
    list.forEach(function (p) { html += propCard(p); });
    html += "</div>";
    $("main").innerHTML = html;
    bindPeriod(); bindCards();
    $("btnNew").onclick = function () {
      window.__editImgs = []; window.__editId = "__new__"; window.__editDraft = null;
      go("edit", "__new__");
    };
    $("btnPub").onclick = function () { go("tools"); };
    $("invSearch").oninput = function () { window.__invQ = this.value; renderInventory(); };
    $("invSt").onchange = function () { window.__invSt = this.value; renderInventory(); };
  }

  function renderMyProps() {
    var list = visibleCatalog();
    var html = periodTabs() + '<p class="section-title">Mis propiedades (' + list.length + ")</p>";
    if (!list.length) html += '<div class="empty">Sin unidades asignadas</div>';
    else {
      html += '<div class="grid-cards">';
      list.forEach(function (p) { html += propCard(p); });
      html += "</div>";
    }
    $("main").innerHTML = html; bindPeriod(); bindCards();
  }

  function renderOwners() {
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    var html = '<div class="panel-block"><h2>Crear propietario</h2>';
    html += '<p class="note">Creás la cuenta, asignás propiedades y publicás. El propietario solo ve esas unidades y sus métricas.</p>';
    html += '<div class="form-row">';
    html += '<label>Nombre<input id="oName"/></label><label>Usuario<input id="oUser"/></label>';
    html += '<label>Email<input id="oEmail" type="email"/></label><label>Tel<input id="oPhone"/></label>';
    html += '<label>Contraseña<input id="oPass" type="text" placeholder="mín. 6"/></label></div>';
    html += '<p class="section-title">Asignar propiedades</p>';
    html += '<div class="prop-pick" id="oPropPick">';
    catalog.forEach(function (p) {
      html += '<label class="pick-row"><input type="checkbox" data-pid="' + esc(p.id) + '"/> <span>' + esc(p.name) + '</span><em>' + esc(p.loc || "") + '</em></label>';
    });
    html += '</div>';
    html += '<button class="btn gold" id="oCreate" style="margin-top:12px">Crear y asignar</button>';
    html += '<pre id="oCreds" class="note" style="display:none;white-space:pre-wrap;margin-top:12px"></pre></div>';

    html += '<p class="section-title">Directorio (' + owners.length + ')</p>';
    owners.forEach(function (o) {
      var props = catalog.filter(function (p) { return (ensureProp(p.id).ownerId || p.ownerId) === o.id; });
      html += '<div class="panel-block owner-card" data-oid="' + esc(o.id) + '">';
      html += '<div class="pcard-top"><h2 style="margin:0;font-size:16px">' + esc(o.name) + '</h2>';
      html += '<span class="badge">' + (o.active !== false ? "activo" : "off") + '</span></div>';
      html += '<p class="meta">@' + esc(o.username) + (o.email ? " · " + esc(o.email) : "") + (o.phone ? " · " + esc(o.phone) : "") + '</p>';
      html += '<p class="meta">' + props.length + ' propiedades asignadas</p>';
      html += '<div class="prop-pick" data-assign="' + esc(o.id) + '">';
      catalog.forEach(function (p) {
        var on = (ensureProp(p.id).ownerId || p.ownerId) === o.id;
        html += '<label class="pick-row"><input type="checkbox" data-pid="' + esc(p.id) + '"' + (on ? " checked" : "") + '/> <span>' + esc(p.name) + '</span></label>';
      });
      html += '</div>';
      html += '<div class="toolbar" style="margin-top:10px">';
      html += '<button type="button" class="btn gold sm" data-save-own="' + esc(o.id) + '">Guardar asignación</button>';
      html += '<button type="button" class="btn danger sm" data-off="' + esc(o.id) + '">Desactivar</button>';
      html += '</div></div>';
    });
    if (!owners.length) html += '<div class="empty">Todavía no hay propietarios</div>';

    $("main").innerHTML = html;

    $("oCreate").onclick = function () {
      var username = $("oUser").value.trim().toLowerCase();
      var pass = $("oPass").value;
      if (!username || pass.length < 6) return alert("Usuario + contraseña (mín. 6)");
      if (state.users.some(function (u) { return u.username === username; })) return alert("Usuario ya existe");
      var id = uid("own");
      state.users.push({
        id: id, username: username, email: $("oEmail").value.trim(), phone: $("oPhone").value.trim(),
        name: $("oName").value.trim() || username, role: "owner", pass: hash(pass), active: true
      });
      var selected = [];
      $("oPropPick").querySelectorAll("input[data-pid]:checked").forEach(function (cb) {
        selected.push(cb.getAttribute("data-pid"));
      });
      saveState();
      assignPropsToOwner(id, selected);
      content.users = publishableUsers();
      saveContent();
      var box = $("oCreds"); box.style.display = "block";
      box.textContent = "Entregar al propietario:\n\nUsuario: " + username + "\nContraseña: " + pass +
        "\nPanel: " + location.origin + location.pathname +
        "\nPropiedades: " + selected.length +
        "\n\nVerá solo esas unidades y métricas (solo lectura).";
      var token = getGhToken();
      if (token) {
        window.__nortQuietPub = true;
        publishToGitHub().then(function () {
          box.textContent += "\n\n✓ Publicado — ya puede entrar desde cualquier dispositivo.";
          renderOwners();
        }).catch(function () { renderOwners(); });
      } else {
        alert("Propietario creado. Configurá token en Publicar para sincronizar con el equipo.");
        renderOwners();
      }
    };

    $("main").querySelectorAll("[data-save-own]").forEach(function (btn) {
      btn.onclick = function () {
        var oid = btn.getAttribute("data-save-own");
        var wrap = $("main").querySelector('[data-assign="' + oid + '"]');
        var selected = [];
        if (wrap) wrap.querySelectorAll("input[data-pid]:checked").forEach(function (cb) {
          selected.push(cb.getAttribute("data-pid"));
        });
        assignPropsToOwner(oid, selected);
        content.users = publishableUsers();
        saveContent();
        var token = getGhToken();
        if (token) {
          window.__nortQuietPub = true;
          publishToGitHub().then(function () { toast("Asignación publicada", "ok"); renderOwners(); });
        } else {
          alert("Asignación guardada local. Publicá para sincronizar.");
          renderOwners();
        }
      };
    });

    $("main").querySelectorAll("[data-off]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-off");
        var u = state.users.find(function (x) { return x.id === id; });
        if (u) u.active = false;
        catalog.forEach(function (p) {
          var meta = ensureProp(p.id);
          if (meta.ownerId === id) {
            meta.ownerId = null;
            content.props[p.id] = Object.assign({}, content.props[p.id] || {}, { ownerId: null });
          }
        });
        content.users = publishableUsers();
        saveState(); saveContent();
        if (getGhToken()) { window.__nortQuietPub = true; publishToGitHub().then(function () { renderOwners(); }); }
        else renderOwners();
      };
    });
  }

  function renderActivity() {
    var ids = user.role === "admin" ? null : idSet(visibleCatalog());
    var labels = { detail_view: "Ficha", card_click: "Card", map_pin_click: "Mapa", whatsapp_click: "WhatsApp", email_click: "Email", visit_scheduled: "Visita", rented: "Rentado", status_changed: "Status" };
    var events = loadEvents().filter(function (e) { return !ids || ids[e.propertyId]; }).reverse().slice(0, 80);
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin eventos aún</div>';
    events.forEach(function (e) {
      var p = propById(e.propertyId);
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time><strong>" + esc(labels[e.type] || e.type) + "</strong> · " + esc(p ? p.name : e.propertyId || "—");
      if (p) html += ' <button class="btn ghost sm" data-open="' + esc(p.id) + '">Ver</button>';
      html += "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html; bindCards();
  }

  
  async function publishRealtimeConfig(wsUrlValue) {
    var token = getGhToken();
    if (!token) throw new Error("Falta token GitHub para guardar wsUrl en el sitio");
    var path = "realtime-config.json";
    var api = "https://api.github.com/repos/Alejoluca/real-nort-immersive/contents/" + path;
    var payload = {
      wsUrl: (wsUrlValue || "").replace(/\/$/, ""),
      pollMs: 4000,
      fastPollMs: 2500,
      updatedAt: new Date().toISOString()
    };
    if (payload.wsUrl.indexOf("https://") === 0) payload.wsUrl = "wss://" + payload.wsUrl.slice(8);
    if (payload.wsUrl.indexOf("http://") === 0) payload.wsUrl = "ws://" + payload.wsUrl.slice(7);
    var sha = null;
    try {
      var cur = await fetch(api + "?ref=main", {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
      });
      if (cur.ok) sha = (await cur.json()).sha;
    } catch (e) {}
    var body = {
      message: "chore: realtime wsUrl " + (payload.wsUrl || "clear"),
      content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
      branch: "main"
    };
    if (sha) body.sha = sha;
    var res = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("GitHub " + res.status + " " + (await res.text()).slice(0, 180));
    return payload;
  }

  async function publishToGitHub() {
    var token = ($("ghToken") && $("ghToken").value.trim()) || getGhToken();
    if (!token) return alert("Pegá un GitHub token con permiso repo (contents:write)");
    setGhToken(token);
    var payload = {
      version: content.version || 1,
      updatedAt: new Date().toISOString(),
      deleted: content.deleted || [],
      props: content.props || {},
      custom: content.custom || [],
      users: publishableUsers()
    };
    content.users = payload.users;
    saveContent();
    var path = "content-overrides.json";
    var api = "https://api.github.com/repos/Alejoluca/real-nort-immersive/contents/" + path;
    var sha = null;
    try {
      var cur = await fetch(api + "?ref=main", {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
      });
      if (cur.ok) {
        var j = await cur.json();
        sha = j.sha;
      }
    } catch (e) {}
    var body = {
      message: "content: publish overrides from NORT OS " + payload.updatedAt,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
      branch: "main"
    };
    if (sha) body.sha = sha;
    var res = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var err = await res.text();
      alert("Error GitHub " + res.status + "\n" + err.slice(0, 300));
      return;
    }
    window.__nortSync = window.__nortSync || {};
    window.__nortSync.status = "synced";
    window.__nortSync.lastPub = payload.updatedAt;
    try {
      if (window.NORT_REALTIME) window.NORT_REALTIME.broadcastContent(payload);
    } catch (e) {}
    if (!window.__nortQuietPub) toast("Publicado y sincronizado", "ok");
    window.__nortQuietPub = false;
  }

  function renderTools() {
    if (user.role !== "admin") {
      $("main").innerHTML = '<div class="empty">Solo admin</div>'; return;
    }
    var nPatch = Object.keys(content.props || {}).length;
    var nCustom = (content.custom || []).length;
    var nDel = (content.deleted || []).length;
    var html = '<div class="panel-block"><h2>Importar desde Google Drive</h2>';
    html += '<p class="note">Pegá uno o varios links de carpetas (una por línea). Cada carpeta con fotos = una propiedad. Si la carpeta solo tiene subcarpetas, se importa cada subcarpeta.</p>';
    html += '<label class="field"><span>Google API Key (Drive API)</span>';
    html += '<input id="driveKey" type="password" placeholder="AIza..." value="' + esc(getDriveKey()) + '"/></label>';
    html += '<label class="field" style="margin-top:10px"><span>Links o IDs de carpetas</span>';
    html += '<textarea id="driveFolders" rows="4" placeholder="https://drive.google.com/drive/folders/XXXX\nhttps://drive.google.com/drive/folders/YYYY"></textarea></label>';
    html += '<div class="toolbar" style="margin-top:12px">';
    html += '<button type="button" class="btn gold" id="btnDriveImport">Importar y publicar</button>';
    html += '<button type="button" class="btn ghost sm" id="btnDrivePreview">Solo previsualizar</button></div>';
    html += '<pre id="driveReport" class="note" style="display:none;white-space:pre-wrap;margin-top:12px"></pre>';
    html += '<p class="note">Las carpetas deben ser “Cualquier persona con el enlace → Lector”. La API Key se guarda solo en este navegador.</p></div>';

    html += '<div class="panel-block"><h2>Publicar al sitio</h2>';
    html += '<p class="note">Sube <code>content-overrides.json</code> al repo para que <strong>todos</strong> vean precios, títulos, descripciones, disponibilidad e imágenes nuevas.</p>';
    html += '<div class="alert-strip">';
    html += '<span class="alert-chip">' + nPatch + " editadas</span>";
    html += '<span class="alert-chip ok">' + nCustom + " nuevas</span>";
    html += '<span class="alert-chip warn">' + nDel + " quitadas</span></div>";
    html += '<label class="field"><span>GitHub token (solo en esta sesión)</span>';
    html += '<input id="ghToken" type="password" placeholder="ghp_..." value="' + esc(getGhToken()) + '"/></label>';
    html += '<div class="toolbar" style="margin-top:12px">';
    html += '<button class="btn gold" id="btnPublish">Publicar ahora</button>';
    html += '<button class="btn ghost sm" id="btnPull">Traer del sitio</button>';
    html += '<button class="btn ghost sm" id="btnDl">Descargar JSON</button>';
    html += '<button class="btn ghost sm" id="btnPrev">Preview local ' + (content.livePreview !== false ? "ON" : "OFF") + "</button></div>";
    html += '<p class="note">Token: Settings → Developer settings → Personal access tokens (contents: write en el repo).</p>';
    html += '<label class="field" style="margin-top:12px"><span>WebSocket hub (opcional)</span>';
    html += '<input id="wsUrl" type="url" placeholder="wss://tu-hub.ejemplo.com" value="' + esc((localStorage.getItem("nort_ws_url")||"")) + '"/></label>';
    html += '<button type="button" class="btn ghost sm" id="btnWsSave" style="margin-top:8px">Guardar WS</button>';
    html += '<p class="note">Sin hub: sync por polling del JSON publicado (gratis en GitHub Pages). Con hub: push instantáneo entre paneles.</p></div>';

    html += '<div class="panel-block"><h2>Export / backup</h2><div class="toolbar">';
    html += '<button class="btn ghost sm" id="dlCsv">CSV métricas</button>';
    html += '<button class="btn ghost sm" id="dlFull">Backup completo</button>';
    html += '<button class="btn ghost sm" id="seedEv">Demo eventos</button>';
    html += '<button class="btn danger sm" id="clrEv">Vaciar eventos</button></div></div>';

    html += '<div class="panel-block"><h2>Pass admin</h2><div class="form-row"><label>Nueva<input id="newPass" type="text"/></label></div>';
    html += '<button class="btn gold sm" id="savePass">Cambiar</button></div>';

    $("main").innerHTML = html;
    $("btnPublish").onclick = function () {
      var t = $("ghToken") && $("ghToken").value.trim();
      if (t) setGhToken(t);
      publishToGitHub();
    };

    async function runDriveImport(publish) {
      var key = $("driveKey") && $("driveKey").value.trim();
      if (key) setDriveKey(key);
      var ids = parseDriveFolderInputs($("driveFolders") && $("driveFolders").value);
      var box = $("driveReport");
      if (!ids.length) { alert("Pegá al menos un link o ID de carpeta"); return; }
      if (!getDriveKey()) { alert("Falta Google API Key"); return; }
      box.style.display = "block";
      box.textContent = "Importando " + ids.length + " carpeta(s)…";
      try {
        var report = await importDriveFolders(ids, { subfolders: true });
        var lines = report.map(function (r) {
          return (r.ok ? "✓ " : "✗ ") + (r.name || r.id) + (r.ok ? (" · " + r.images + " fotos · id " + r.id) : (" · " + (r.reason || "error")));
        });
        box.textContent = lines.join("\n");
        var ok = report.filter(function (r) { return r.ok; }).length;
        if (publish && ok && getGhToken()) {
          window.__nortQuietPub = true;
          await publishToGitHub();
          box.textContent += "\n\nPublicado en el sitio (" + ok + " props).";
        } else if (publish && ok && !getGhToken()) {
          box.textContent += "\n\nGuardado local. Configurá token GitHub abajo para publicar.";
        }
        if (!ok) alert("No se importó ninguna propiedad con imágenes");
      } catch (e) {
        box.textContent = "Error: " + (e && e.message || e);
        alert(e && e.message || e);
      }
    }
    if ($("btnDriveImport")) $("btnDriveImport").onclick = function () { runDriveImport(true); };
    if ($("btnDrivePreview")) $("btnDrivePreview").onclick = function () { runDriveImport(false); };
    if ($("driveKey")) $("driveKey").onchange = function () { if (this.value.trim()) setDriveKey(this.value.trim()); };
    if ($("btnWsSave")) $("btnWsSave").onclick = async function () {
      var u = $("wsUrl") && $("wsUrl").value.trim();
      if (window.NORT_REALTIME) window.NORT_REALTIME.setWsUrl(u);
      else try { localStorage.setItem("nort_ws_url", u || ""); } catch (e) {}
      try {
        if (getGhToken()) {
          await publishRealtimeConfig(u);
          alert(u ? "WS guardado en este dispositivo y publicado para todo el equipo/sitio" : "WS desactivado y publicado");
        } else {
          alert(u ? "WS solo en este dispositivo. Token GitHub en Publicar para compartirlo al equipo." : "WS desactivado");
        }
      } catch (err) {
        alert("WS local OK. Publicar config falló: " + (err && err.message || err));
      }
    };
    if ($("ghToken")) {
      $("ghToken").onchange = function(){ if (this.value.trim()) setGhToken(this.value.trim()); };
    }
    if ($("btnPull")) $("btnPull").onclick = async function () {
      var r = await pullRemoteContent();
      window.__nortSync.lastPull = r;
      window.__nortSync.status = r.ok ? "synced" : "local";
      alert(r.ok ? "Contenido del sitio cargado (" + (r.n||0) + " edits)" : "No se pudo traer: " + (r.reason||""));
      rebuildCatalog(); render();
    };
    $("btnDl").onclick = function () {
      var payload = { version: 1, updatedAt: new Date().toISOString(), deleted: content.deleted, props: content.props, custom: content.custom };
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      a.download = "content-overrides.json"; a.click();
    };
    $("btnPrev").onclick = function () {
      content.livePreview = content.livePreview === false;
      saveContent();
      alert("Preview local " + (content.livePreview !== false ? "activado" : "desactivado"));
      renderTools();
    };
    $("dlCsv").onclick = function () {
      var lines = ["id,name,price,status,views,intent,visits,pulse"];
      catalog.forEach(function (p) {
        var m = metricsFor(p.id);
        lines.push([p.id, JSON.stringify(p.name), JSON.stringify(p.price || ""), p.status || ensureProp(p.id).status, m.views, m.intent, m.visits, m.score].join(","));
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = "nort-metrics.csv"; a.click();
    };
    $("dlFull").onclick = function () {
      var payload = { state: state, content: content, events: loadEvents(), at: new Date().toISOString() };
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      a.download = "nort-os-backup.json"; a.click();
    };
    $("seedEv").onclick = function () {
      var types = ["card_click", "detail_view", "whatsapp_click", "map_pin_click"];
      for (var d = 0; d < 7; d++) {
        for (var k = 0; k < 6; k++) {
          var p = catalog[Math.floor(Math.random() * catalog.length)];
          if (!p) continue;
          pushEvent({ id: uid("ev"), type: types[k % types.length], propertyId: p.id, ts: daysAgo(d) + Math.random() * 864e5, source: "demo" });
        }
      }
      alert("Demo OK"); go("home");
    };
    $("clrEv").onclick = function () { if (confirm("¿Vaciar?")) { saveEvents([]); alert("OK"); } };
    $("savePass").onclick = function () {
      var pass = $("newPass").value;
      if (pass.length < 6) return alert("Mín 6");
      var admin = state.users.find(function (u) { return u.role === "admin"; });
      if (admin) { admin.pass = hash(pass); saveState(); alert("Actualizada"); }
    };
  }

  function render() {
    user = currentUser();
    if (!user) return showLogin();
    destroyCharts();
    if (route === "edit") return renderEdit();
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

  async function pullRemoteContent() {
    try {
      var res = await fetch("../content-overrides.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return { ok: false, reason: "http " + res.status };
      var remote = await res.json();
      if (!remote || typeof remote !== "object") return { ok: false };
      // Remote published content is source of truth for the whole team
      content.props = remote.props || {};
      content.custom = remote.custom || [];
      content.deleted = remote.deleted || [];
      content.users = remote.users || content.users || [];
      content.updatedAt = remote.updatedAt || content.updatedAt;
      content.version = remote.version || content.version || 1;
      content.livePreview = true;
      saveContent();
      syncUsersFromContent();
      rebuildCatalog();
      return { ok: true, at: content.updatedAt, n: Object.keys(content.props || {}).length };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e) };
    }
  }

  window.__nortSync = { lastPull: null, lastPub: null, status: "idle" };

  function bindLoginKeys() {
    ["loginUser","loginPass"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var b = $("loginBtn");
          if (b) b.click();
        }
      });
    });
  }
  // NORT_LOGIN_ENTER

  (async function boot() {
    await loadCatalog();
    var pull = await pullRemoteContent();
    window.__nortSync.lastPull = pull;
    window.__nortSync.status = pull.ok ? "synced" : "local";
    console.log("[NORT OS] base", baseCatalog.length, "resolved", catalog.length, "sync", pull);
    try {
      if (window.NORT_REALTIME) {
        window.NORT_REALTIME.start({
          role: "panel",
          contentUrl: "../content-overrides.json",
          configUrl: "../realtime-config.json",
          fastPollMs: 3000,
          pollMs: 8000,
          onContent: function (payload, source) {
            if (!payload) return;
            content.props = payload.props || {};
            content.custom = payload.custom || [];
            content.deleted = payload.deleted || [];
            content.users = payload.users || content.users || [];
            content.updatedAt = payload.updatedAt || content.updatedAt;
            saveContent();
            if (typeof syncUsersFromContent === "function") syncUsersFromContent();
            rebuildCatalog();
            window.__nortSync = window.__nortSync || {};
            window.__nortSync.status = "synced";
            window.__nortSync.lastPull = { ok: true, at: content.updatedAt, source: source };
            // soft refresh current view if logged in
            try { if (currentUser()) { renderNav(); render(); } } catch (e) {}
          }
        });
      }
    } catch (e) {}
    $("boot").hidden = true;
    bindLoginKeys();
    if (currentUser()) showApp(); else showLogin();
  })();
})();
