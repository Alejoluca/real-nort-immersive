/* NORT OS — Admin + Owner control panel (client core)
   Persistence: localStorage keys nort_os_v1 / nort_os_events_v1
   Site public reads status via same keys when same origin.
*/
(function () {
  "use strict";

  var STORAGE_STATE = "nort_os_v1";
  var STORAGE_EVENTS = "nort_os_events_v1";
  var STORAGE_SESSION = "nort_os_session_v1";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 10);
  }
  function now() { return Date.now(); }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return String(ts); }
  }
  function daysAgo(n) { return now() - n * 864e5; }

  // Simple non-crypto hash for demo gate (upgrade to server auth later)
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
      version: 1,
      users: [
        {
          id: "admin",
          username: "admin",
          email: "alejolucatelli@gmail.com",
          name: "Alejo Lucatelli",
          role: "admin",
          pass: hash("RealNort2026!"),
          active: true,
          notify: true
        }
      ],
      // propertyId -> { status, ownerId, note }
      props: {},
      settings: {
        clickThreshold: 10,
        siteOrigin: "../index.html"
      }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_STATE);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s.users || !s.users.length) return defaultState();
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_STATE, JSON.stringify(state));
  }

  function loadEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_EVENTS) || "[]");
    } catch (e) { return []; }
  }

  function saveEvents(evts) {
    // keep last 5000
    if (evts.length > 5000) evts = evts.slice(-5000);
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(evts));
  }

  function pushEvent(evt) {
    var list = loadEvents();
    list.push(evt);
    saveEvents(list);
    return evt;
  }

  var state = loadState();
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem(STORAGE_SESSION) || "null"); } catch (e) {}

  function setSession(user) {
    session = user ? { id: user.id, role: user.role, name: user.name, username: user.username } : null;
    if (session) sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_SESSION);
  }

  function currentUser() {
    if (!session) return null;
    return state.users.find(function (u) { return u.id === session.id && u.active !== false; }) || null;
  }

  // Catalog from parent data if available (opened from same deployment)
  function getCatalog() {
    var list = [];
    try {
      if (window.opener && window.opener.allProperties) list = window.opener.allProperties;
    } catch (e) {}
    if (!list.length) {
      try {
        list = JSON.parse(localStorage.getItem("nort_os_catalog_cache") || "[]");
      } catch (e) {}
    }
    return list || [];
  }

  async function fetchCatalog() {
    var paths = ["../data.json", "../catalog-full.json", "../catalog.json"];
    for (var i = 0; i < paths.length; i++) {
      try {
        var res = await fetch(paths[i] + "?t=" + Date.now());
        if (!res.ok) continue;
        var data = await res.json();
        var all = [].concat(data.featured || [], data.allProperties || []);
        // unique by id
        var map = {};
        all.forEach(function (p) { if (p && p.id) map[p.id] = p; });
        var list = Object.keys(map).map(function (k) { return map[k]; });
        localStorage.setItem("nort_os_catalog_cache", JSON.stringify(list));
        return list;
      } catch (e) {}
    }
    return getCatalog();
  }

  function ensurePropMeta(propertyId) {
    if (!state.props[propertyId]) {
      state.props[propertyId] = { status: "published", ownerId: null, note: "" };
    }
    return state.props[propertyId];
  }

  function propStatus(id) {
    return ensurePropMeta(id).status || "published";
  }

  function pulseFor(propertyId, events) {
    var since = daysAgo(7);
    var ev = events.filter(function (e) { return e.propertyId === propertyId && e.ts >= since; });
    var views = ev.filter(function (e) { return e.type === "detail_view"; }).length;
    var clicks = ev.filter(function (e) { return e.type === "card_click" || e.type === "map_pin_click"; }).length;
    var intent = ev.filter(function (e) { return e.type === "whatsapp_click" || e.type === "email_click"; }).length;
    var visits = ev.filter(function (e) { return e.type === "visit_scheduled"; }).length;
    // weighted 0-100
    var score = Math.min(100, Math.round(views * 3 + clicks * 2 + intent * 12 + visits * 20));
    var label = score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
    return { score: score, label: label, views: views, clicks: clicks, intent: intent, visits: visits };
  }

  function countEvents(type, propertyId, sinceTs) {
    return loadEvents().filter(function (e) {
      if (type && e.type !== type) return false;
      if (propertyId && e.propertyId !== propertyId) return false;
      if (sinceTs && e.ts < sinceTs) return false;
      return true;
    }).length;
  }

  function ownerProps(userId, catalog) {
    return catalog.filter(function (p) {
      return ensurePropMeta(p.id).ownerId === userId;
    });
  }

  // ——— UI ———
  var catalog = [];
  var route = "home";

  function showLogin() {
    $("boot").hidden = true;
    $("appView").hidden = true;
    $("loginView").hidden = false;
  }

  function showApp() {
    $("boot").hidden = true;
    $("loginView").hidden = true;
    $("appView").hidden = false;
    var u = currentUser();
    $("roleBadge").textContent = u.role === "admin" ? "Admin" : "Propietario";
    $("userLabel").textContent = u.name || u.username;
    renderNav();
    render();
  }

  function renderNav() {
    var u = currentUser();
    var items = u.role === "admin"
      ? [
          ["home", "Command"],
          ["inventory", "Inventario"],
          ["owners", "Propietarios"],
          ["signals", "Signals"],
          ["events", "Eventos"]
        ]
      : [
          ["home", "Mis propiedades"],
          ["feed", "Actividad"],
          ["report", "Informe"]
        ];
    $("nav").innerHTML = items.map(function (it) {
      return '<button type="button" data-route="' + it[0] + '" class="' + (route === it[0] ? "active" : "") + '">' + it[1] + "</button>";
    }).join("");
    $("nav").querySelectorAll("button").forEach(function (btn) {
      btn.onclick = function () {
        route = btn.getAttribute("data-route");
        renderNav();
        render();
      };
    });
  }

  function kpiHtml(label, value, sub) {
    return '<div class="kpi"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div>' +
      (sub ? '<div class="s">' + esc(sub) + "</div>" : "") + "</div>";
  }

  function statusClass(st) { return "status " + (st || "published"); }

  function renderAdminHome() {
    var since = daysAgo(7);
    var ev = loadEvents().filter(function (e) { return e.ts >= since; });
    var views = ev.filter(function (e) { return e.type === "detail_view"; }).length;
    var clicks = ev.filter(function (e) { return e.type === "card_click" || e.type === "map_pin_click"; }).length;
    var intent = ev.filter(function (e) { return e.type === "whatsapp_click" || e.type === "email_click"; }).length;
    var visits = ev.filter(function (e) { return e.type === "visit_scheduled"; }).length;
    var published = catalog.filter(function (p) { return propStatus(p.id) === "published"; }).length;
    var paused = catalog.filter(function (p) { return propStatus(p.id) === "paused"; }).length;
    var rented = catalog.filter(function (p) { return propStatus(p.id) === "rented"; }).length;

    var ranked = catalog.map(function (p) {
      var pulse = pulseFor(p.id, loadEvents());
      return { p: p, pulse: pulse };
    }).sort(function (a, b) { return b.pulse.score - a.pulse.score; }).slice(0, 6);

    var html = "";
    html += '<div class="kpi-row">';
    html += kpiHtml("Inmersiones 7d", views, "Fichas abiertas");
    html += kpiHtml("Atracción 7d", clicks, "Cards + mapa");
    html += kpiHtml("Intención 7d", intent, "WhatsApp + email");
    html += kpiHtml("Visitas 7d", visits, "Marcadas por admin");
    html += "</div>";
    html += '<div class="kpi-row">';
    html += kpiHtml("Publicadas", published, "Visibles en sitio");
    html += kpiHtml("Pausadas", paused, "");
    html += kpiHtml("Rentadas", rented, "");
    html += kpiHtml("Owners", state.users.filter(function (u) { return u.role === "owner"; }).length, "");
    html += "</div>";
    html += '<p class="section-title">Pulse · top demanda</p><div class="grid-cards">';
    ranked.forEach(function (row) {
      var p = row.p;
      var meta = ensurePropMeta(p.id);
      var img = (p.images && p.images[0]) ? p.images[0].replace(/=w\d+/, "=w600") : "";
      html += '<article class="pcard">';
      html += '<div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div>';
      html += '<div class="pcard-body">';
      html += '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
      html += '<div class="meta">' + esc(p.loc || "") + " · " + esc(p.beds || "") + "</div>";
      html += '<div class="pulse-row"><div class="pulse-ring" style="--p:' + row.pulse.score + '"><span>' + row.pulse.score + '</span></div>';
      html += '<div class="pulse-label">' + esc(row.pulse.label) + " · " + row.pulse.intent + " intenciones</div></div>";
      html += "</div></article>";
    });
    html += "</div>";
    html += '<p class="note">Los eventos se capturan desde el sitio público (misma origin / navegador). Conectá backend + mails en la siguiente fase.</p>';
    $("main").innerHTML = html;
  }

  function renderInventory() {
    var html = '<p class="section-title">Inventario (' + catalog.length + ')</p>';
    html += '<div class="table-wrap"><table><thead><tr>';
    html += "<th>Propiedad</th><th>Status</th><th>Owner</th><th>Pulse</th><th>7d intent</th><th>Acciones</th>";
    html += "</tr></thead><tbody>";
    var events = loadEvents();
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    catalog.forEach(function (p) {
      var meta = ensurePropMeta(p.id);
      var pulse = pulseFor(p.id, events);
      html += "<tr data-id=\"" + esc(p.id) + "\">";
      html += "<td><strong>" + esc(p.name) + "</strong><div class=\"meta\">" + esc(p.id) + "</div></td>";
      html += "<td><select data-act=\"status\">";
      ["published", "paused", "reserved", "rented"].forEach(function (st) {
        html += '<option value="' + st + '"' + (meta.status === st ? " selected" : "") + ">" + st + "</option>";
      });
      html += "</select></td>";
      html += "<td><select data-act=\"owner\"><option value=\"\">— Sin dueño —</option>";
      owners.forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (meta.ownerId === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
      });
      html += "</select></td>";
      html += "<td>" + pulse.score + " · " + esc(pulse.label) + "</td>";
      html += "<td>" + pulse.intent + "</td>";
      html += '<td><button type="button" class="btn ghost sm" data-act="visit">+ Visita</button> ';
      html += '<button type="button" class="btn ghost sm" data-act="rent">Rentado</button></td>';
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    html += '<p class="note">Al cambiar status se guarda en este navegador y el sitio lo respeta si abrís el catálogo desde el mismo dispositivo (fase 1). Deploy global = siguiente fase API.</p>';
    $("main").innerHTML = html;

    $("main").querySelectorAll("tr[data-id]").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="status"]').onchange = function () {
        ensurePropMeta(id).status = this.value;
        saveState(state);
        pushEvent({ id: uid("ev"), type: "status_changed", propertyId: id, ts: now(), meta: { status: this.value } });
        maybeNotifyOwner(id, "status", this.value);
      };
      row.querySelector('[data-act="owner"]').onchange = function () {
        ensurePropMeta(id).ownerId = this.value || null;
        saveState(state);
      };
      row.querySelector('[data-act="visit"]').onclick = function () {
        pushEvent({ id: uid("ev"), type: "visit_scheduled", propertyId: id, ts: now(), meta: { by: "admin" } });
        maybeNotifyOwner(id, "visit");
        alert("Visita registrada · el owner recibirá aviso cuando conectemos mail");
        render();
      };
      row.querySelector('[data-act="rent"]').onclick = function () {
        ensurePropMeta(id).status = "rented";
        saveState(state);
        pushEvent({ id: uid("ev"), type: "rented", propertyId: id, ts: now() });
        maybeNotifyOwner(id, "rented");
        render();
      };
    });
  }

  function renderOwners() {
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    var html = '<div class="panel-block"><h2>Nuevo propietario</h2><div class="form-row">';
    html += '<label>Nombre<input id="oName" type="text" placeholder="Nombre"/></label>';
    html += '<label>Usuario<input id="oUser" type="text" placeholder="usuario"/></label>';
    html += '<label>Email<input id="oEmail" type="email" placeholder="dueño@mail.com"/></label>';
    html += '<label>Contraseña<input id="oPass" type="text" placeholder="temporal"/></label>';
    html += '</div><button type="button" class="btn gold" id="oCreate">Crear owner</button>';
    html += '<p class="note">Solo lectura: ven métricas de las props que les asignes. No editan el catálogo.</p></div>';

    html += '<p class="section-title">Propietarios</p><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Props</th><th></th></tr></thead><tbody>';
    owners.forEach(function (o) {
      var n = catalog.filter(function (p) { return ensurePropMeta(p.id).ownerId === o.id; }).length;
      html += "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.username) + "<div class=\"meta\">" + esc(o.email || "") + "</div></td><td>" + n + "</td>";
      html += '<td><button type="button" class="btn danger sm" data-del="' + esc(o.id) + '">Desactivar</button></td></tr>';
    });
    html += "</tbody></table></div>";
    $("main").innerHTML = html;

    $("oCreate").onclick = function () {
      var name = $("oName").value.trim();
      var username = $("oUser").value.trim().toLowerCase();
      var email = $("oEmail").value.trim();
      var pass = $("oPass").value;
      if (!username || !pass) { alert("Usuario y contraseña requeridos"); return; }
      if (state.users.some(function (u) { return u.username === username; })) {
        alert("Usuario ya existe"); return;
      }
      state.users.push({
        id: uid("own"),
        username: username,
        email: email,
        name: name || username,
        role: "owner",
        pass: hash(pass),
        active: true,
        notify: true
      });
      saveState(state);
      render();
    };
    $("main").querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-del");
        var u = state.users.find(function (x) { return x.id === id; });
        if (u) u.active = false;
        Object.keys(state.props).forEach(function (pid) {
          if (state.props[pid].ownerId === id) state.props[pid].ownerId = null;
        });
        saveState(state);
        render();
      };
    });
  }

  function renderSignals() {
    var events = loadEvents().slice().reverse().slice(0, 40);
    var html = '<p class="section-title">Signals recientes</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin eventos aún. Navegá el sitio público para generar demanda.</div>';
    events.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.propertyId; });
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time>";
      html += "<strong>" + esc(e.type) + "</strong> · " + esc(p ? p.name : e.propertyId || "—");
      html += "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderEventsRaw() {
    var events = loadEvents();
    $("main").innerHTML =
      '<p class="section-title">Eventos (' + events.length + ')</p>' +
      '<button type="button" class="btn ghost sm" id="clearEv">Limpiar eventos locales</button>' +
      '<pre class="panel-block" style="overflow:auto;max-height:60vh;font-size:11px">' +
      esc(JSON.stringify(events.slice(-100), null, 2)) + "</pre>";
    $("clearEv").onclick = function () {
      if (confirm("¿Borrar eventos locales?")) {
        saveEvents([]);
        render();
      }
    };
  }

  function renderOwnerHome() {
    var u = currentUser();
    var mine = ownerProps(u.id, catalog);
    var events = loadEvents();
    if (!mine.length) {
      $("main").innerHTML = '<div class="empty">Todavía no tenés propiedades asignadas. Real Nort las vincula desde el panel admin.</div>';
      return;
    }
    var html = '<p class="section-title">Tus propiedades · solo lectura</p><div class="grid-cards">';
    mine.forEach(function (p) {
      var meta = ensurePropMeta(p.id);
      var pulse = pulseFor(p.id, events);
      var img = (p.images && p.images[0]) ? p.images[0].replace(/=w\d+/, "=w600") : "";
      html += '<article class="pcard"><div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div><div class="pcard-body">';
      html += '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
      html += '<div class="meta">' + esc(p.loc || "") + "</div>";
      html += '<div class="pulse-row"><div class="pulse-ring" style="--p:' + pulse.score + '"><span>' + pulse.score + '</span></div>';
      html += '<div class="pulse-label">' + esc(pulse.label) + "<br/>" + pulse.views + " inmersiones · " + pulse.intent + " consultas · " + pulse.visits + " visitas</div></div>";
      html += '<p class="note">La gestión del anuncio la realiza Real Nort.</p>';
      html += "</div></article>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderOwnerFeed() {
    var u = currentUser();
    var ids = ownerProps(u.id, catalog).map(function (p) { return p.id; });
    var events = loadEvents().filter(function (e) { return ids.indexOf(e.propertyId) >= 0; }).reverse().slice(0, 30);
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin actividad reciente en tus propiedades.</div>';
    events.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.propertyId; });
      var label = ({
        detail_view: "Alguien abrió la ficha",
        card_click: "Click en catálogo",
        map_pin_click: "Click en mapa",
        whatsapp_click: "Consulta por WhatsApp",
        email_click: "Consulta por email",
        visit_scheduled: "Visita coordinada",
        rented: "Marcada como rentada",
        status_changed: "Cambio de estado"
      })[e.type] || e.type;
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time>" + esc(label) + " · <strong>" + esc(p ? p.name : "") + "</strong></div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderOwnerReport() {
    var u = currentUser();
    var mine = ownerProps(u.id, catalog);
    var events = loadEvents();
    var html = '<div class="panel-block"><h2>Informe de demanda (7 días)</h2>';
    html += "<p class=\"note\">Generado en NORT OS · " + esc(fmtDate(now())) + "</p>";
    mine.forEach(function (p) {
      var pulse = pulseFor(p.id, events);
      html += "<p><strong>" + esc(p.name) + "</strong><br/>Pulse " + pulse.score + " (" + esc(pulse.label) + ") · ";
      html += pulse.views + " inmersiones · " + pulse.intent + " consultas · " + pulse.visits + " visitas</p>";
    });
    html += '<p class="note">En la siguiente fase: export PDF con marca Real Nort.</p></div>';
    $("main").innerHTML = html;
  }

  function maybeNotifyOwner(propertyId, kind, extra) {
    // Phase 1: queue locally; wire Resend later
    var meta = ensurePropMeta(propertyId);
    if (!meta.ownerId) return;
    var owner = state.users.find(function (u) { return u.id === meta.ownerId; });
    if (!owner || !owner.notify) return;
    var queue = JSON.parse(localStorage.getItem("nort_os_mail_queue") || "[]");
    queue.push({
      ts: now(),
      to: owner.email,
      propertyId: propertyId,
      kind: kind,
      extra: extra || null
    });
    localStorage.setItem("nort_os_mail_queue", JSON.stringify(queue.slice(-200)));
  }

  function render() {
    var u = currentUser();
    if (!u) return showLogin();
    if (u.role === "admin") {
      if (route === "inventory") return renderInventory();
      if (route === "owners") return renderOwners();
      if (route === "signals") return renderSignals();
      if (route === "events") return renderEventsRaw();
      return renderAdminHome();
    }
    if (route === "feed") return renderOwnerFeed();
    if (route === "report") return renderOwnerReport();
    return renderOwnerHome();
  }

  function tryLogin() {
    var username = $("loginUser").value.trim().toLowerCase();
    var pass = $("loginPass").value;
    $("loginErr").hidden = true;
    var user = state.users.find(function (u) {
      return u.active !== false && (u.username === username || (u.email && u.email.toLowerCase() === username));
    });
    if (!user || user.pass !== hash(pass)) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = "Credenciales incorrectas";
      return;
    }
    setSession(user);
    route = "home";
    showApp();
  }

  // bootstrap
  $("loginBtn").onclick = tryLogin;
  $("loginPass").addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryLogin();
  });
  $("logoutBtn").onclick = function () {
    setSession(null);
    showLogin();
  };

  fetchCatalog().then(function (list) {
    catalog = list;
    // seed prop meta
    catalog.forEach(function (p) { ensurePropMeta(p.id); });
    saveState(state);
    $("boot").hidden = true;
    if (currentUser()) showApp();
    else showLogin();
  });
})();
