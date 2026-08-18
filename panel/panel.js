/* NORT OS Panel — works offline on GitHub Pages (local store) + optional API */
(function () {
  "use strict";

  var API = (window.NORT_API || localStorage.getItem("nort_api") || "").replace(/\/$/, "");
  var STATE_KEY = "nort_os_v1";
  var EVENTS_KEY = "nort_os_events_v1";
  var SESSION_KEY = "nort_os_session_v1";
  var mode = "local";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 10); }
  function now() { return Date.now(); }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return String(ts); }
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
  function daysAgo(n) { return now() - n * 864e5; }

  function defaultState() {
    return {
      version: 1,
      users: [{
        id: "admin",
        username: "admin",
        email: "alejolucatelli@gmail.com",
        name: "Alejo Lucatelli",
        role: "admin",
        pass: hash("RealNort2026!"),
        active: true,
        notify: true
      }],
      props: {},
      settings: { clickThreshold: 10 }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s.users || !s.users.length) return defaultState();
      // ensure admin always exists
      if (!s.users.some(function (u) { return u.role === "admin"; })) {
        s.users.unshift(defaultState().users[0]);
      }
      return s;
    } catch (e) { return defaultState(); }
  }
  function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveEvents(list) {
    if (list.length > 5000) list = list.slice(-5000);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  }
  function pushEvent(evt) {
    var list = loadEvents();
    list.push(evt);
    saveEvents(list);
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
  var user = null;

  function ensureProp(id) {
    if (!state.props[id]) state.props[id] = { status: "published", ownerId: null, note: "" };
    return state.props[id];
  }

  function pulseFor(propertyId) {
    var since = daysAgo(7);
    var ev = loadEvents().filter(function (e) { return e.propertyId === propertyId && e.ts >= since; });
    var views = ev.filter(function (e) { return e.type === "detail_view"; }).length;
    var clicks = ev.filter(function (e) { return e.type === "card_click" || e.type === "map_pin_click"; }).length;
    var intent = ev.filter(function (e) { return e.type === "whatsapp_click" || e.type === "email_click"; }).length;
    var visits = ev.filter(function (e) { return e.type === "visit_scheduled"; }).length;
    var score = Math.min(100, Math.round(views * 3 + clicks * 2 + intent * 12 + visits * 20));
    var label = score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
    return { score: score, label: label, views: views, clicks: clicks, intent: intent, visits: visits };
  }

  async function loadCatalog() {
    var paths = ["../data.json", "../catalog-full.json", "../catalog.json"];
    for (var i = 0; i < paths.length; i++) {
      try {
        var res = await fetch(paths[i] + "?t=" + Date.now());
        if (!res.ok) continue;
        var data = await res.json();
        var map = {};
        [].concat(data.featured || [], data.allProperties || []).forEach(function (p) {
          if (p && p.id) map[p.id] = p;
        });
        catalog = Object.keys(map).map(function (k) { return map[k]; });
        catalog.forEach(function (p) { ensureProp(p.id); });
        saveState();
        return;
      } catch (e) {}
    }
    try {
      catalog = JSON.parse(localStorage.getItem("nort_os_catalog_cache") || "[]");
    } catch (e) { catalog = []; }
  }

  // ——— UI ———
  function showLogin() {
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
      ? [["home", "Command"], ["inventory", "Inventario"], ["owners", "Propietarios"], ["signals", "Actividad"]]
      : [["home", "Mis propiedades"], ["feed", "Actividad"], ["report", "Informe"]];
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

  function kpi(label, value, sub) {
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
    var published = catalog.filter(function (p) { return ensureProp(p.id).status === "published"; }).length;
    var paused = catalog.filter(function (p) { return ensureProp(p.id).status === "paused"; }).length;
    var rented = catalog.filter(function (p) { return ensureProp(p.id).status === "rented"; }).length;

    var ranked = catalog.map(function (p) {
      return { p: p, pulse: pulseFor(p.id) };
    }).sort(function (a, b) { return b.pulse.score - a.pulse.score; }).slice(0, 6);

    var html = '<div class="kpi-row">' +
      kpi("Inmersiones 7d", views, "Fichas abiertas") +
      kpi("Atracción 7d", clicks, "Cards + mapa") +
      kpi("Intención 7d", intent, "WhatsApp + email") +
      kpi("Visitas 7d", visits, "Marcadas por admin") +
      "</div><div class=\"kpi-row\">" +
      kpi("Publicadas", published, "") +
      kpi("Pausadas", paused, "") +
      kpi("Rentadas", rented, "") +
      kpi("Owners", state.users.filter(function (u) { return u.role === "owner" && u.active !== false; }).length, "") +
      "</div>";
    html += '<p class="section-title">Pulse · top demanda</p><div class="grid-cards">';
    ranked.forEach(function (row) {
      var p = row.p;
      var meta = ensureProp(p.id);
      var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w600") : "";
      html += '<article class="pcard"><div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div><div class="pcard-body">';
      html += '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
      html += '<div class="meta">' + esc(p.loc || "") + "</div>";
      html += '<div class="pulse-row"><div class="pulse-ring" style="--p:' + row.pulse.score + '"><span>' + row.pulse.score + '</span></div>';
      html += '<div class="pulse-label">' + esc(row.pulse.label) + " · " + row.pulse.intent + " intenciones</div></div></div></article>";
    });
    html += "</div>";
    html += '<p class="note">Modo local activo · datos en este dispositivo. Servidor API opcional más adelante.</p>';
    $("main").innerHTML = html;
  }

  function renderInventory() {
    var owners = state.users.filter(function (u) { return u.role === "owner" && u.active !== false; });
    var html = '<p class="section-title">Inventario (' + catalog.length + ')</p>';
    html += '<div class="table-wrap"><table><thead><tr><th>Propiedad</th><th>Status</th><th>Owner</th><th>Pulse</th><th>Acciones</th></tr></thead><tbody>';
    catalog.forEach(function (p) {
      var meta = ensureProp(p.id);
      var pulse = pulseFor(p.id);
      html += '<tr data-id="' + esc(p.id) + '"><td><strong>' + esc(p.name) + '</strong><div class="meta">' + esc(p.id) + '</div></td>';
      html += '<td><select data-act="status">';
      ["published", "paused", "reserved", "rented"].forEach(function (st) {
        html += '<option value="' + st + '"' + (meta.status === st ? " selected" : "") + ">" + st + "</option>";
      });
      html += '</select></td><td><select data-act="owner"><option value="">— Sin dueño —</option>';
      owners.forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (meta.ownerId === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
      });
      html += '</select></td><td>' + pulse.score + " · " + esc(pulse.label) + '</td>';
      html += '<td><button type="button" class="btn ghost sm" data-act="visit">+ Visita</button> ';
      html += '<button type="button" class="btn ghost sm" data-act="rent">Rentado</button></td></tr>';
    });
    html += "</tbody></table></div>";
    $("main").innerHTML = html;

    $("main").querySelectorAll("tr[data-id]").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="status"]').onchange = function () {
        ensureProp(id).status = this.value;
        saveState();
        pushEvent({ id: uid("ev"), type: "status_changed", propertyId: id, ts: now(), meta: { status: this.value } });
      };
      row.querySelector('[data-act="owner"]').onchange = function () {
        ensureProp(id).ownerId = this.value || null;
        saveState();
      };
      row.querySelector('[data-act="visit"]').onclick = function () {
        pushEvent({ id: uid("ev"), type: "visit_scheduled", propertyId: id, ts: now() });
        alert("Visita registrada");
        render();
      };
      row.querySelector('[data-act="rent"]').onclick = function () {
        ensureProp(id).status = "rented";
        saveState();
        pushEvent({ id: uid("ev"), type: "rented", propertyId: id, ts: now() });
        render();
      };
    });
  }

  function renderOwners() {
    var owners = state.users.filter(function (u) { return u.role === "owner"; });
    var html = '<div class="panel-block"><h2>Crear cuenta de propietario</h2>';
    html += '<p class="note">Vos definís usuario, contraseña y email. El propietario no se registra solo: le transmitís el acceso.</p>';
    html += '<div class="form-row">';
    html += '<label>Nombre<input id="oName" type="text" placeholder="Nombre"/></label>';
    html += '<label>Usuario<input id="oUser" type="text" placeholder="usuario"/></label>';
    html += '<label>Email avisos<input id="oEmail" type="email" placeholder="dueño@email.com"/></label>';
    html += '<label>Contraseña<input id="oPass" type="text" placeholder="mín. 6 caracteres"/></label>';
    html += '</div><button type="button" class="btn gold" id="oCreate">Crear y mostrar acceso</button>';
    html += '<pre id="oCreds" class="note" style="display:none;white-space:pre-wrap;margin-top:12px"></pre></div>';

    html += '<p class="section-title">Propietarios</p><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Props</th><th></th></tr></thead><tbody>';
    owners.forEach(function (o) {
      var n = catalog.filter(function (p) { return ensureProp(p.id).ownerId === o.id; }).length;
      html += "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.username) + "</td><td>" + esc(o.email || "") + "</td><td>" + n + "</td>";
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
        alert("Ese usuario ya existe"); return;
      }
      var id = uid("own");
      state.users.push({
        id: id, username: username, email: email, name: name || username,
        role: "owner", pass: hash(pass), active: true, notify: true
      });
      saveState();
      var box = $("oCreds");
      box.style.display = "block";
      box.textContent =
        "Transmití esto al propietario:\n\n" +
        "Usuario: " + username + "\n" +
        "Contraseña: " + pass + "\n" +
        "Email avisos: " + (email || "—") + "\n" +
        "Panel: " + location.origin + location.pathname;
      renderOwners();
    };
    $("main").querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-del");
        var u = state.users.find(function (x) { return x.id === id; });
        if (u) u.active = false;
        Object.keys(state.props).forEach(function (pid) {
          if (state.props[pid].ownerId === id) state.props[pid].ownerId = null;
        });
        saveState();
        render();
      };
    });
  }

  function renderSignals() {
    var events = loadEvents().slice().reverse().slice(0, 40);
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin eventos aún. Navegá el sitio público en este mismo navegador.</div>';
    events.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.propertyId; });
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time><strong>" +
        esc(e.type) + "</strong> · " + esc(p ? p.name : e.propertyId || "—") + "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderOwnerHome() {
    var mine = catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id; });
    if (!mine.length) {
      $("main").innerHTML = '<div class="empty">Todavía no tenés propiedades asignadas. Real Nort las vincula desde el panel admin.</div>';
      return;
    }
    var html = '<p class="section-title">Tus propiedades · solo lectura</p><div class="grid-cards">';
    mine.forEach(function (p) {
      var meta = ensureProp(p.id);
      var pulse = pulseFor(p.id);
      var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w600") : "";
      html += '<article class="pcard"><div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div><div class="pcard-body">';
      html += '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="' + statusClass(meta.status) + '">' + esc(meta.status) + "</span></div>";
      html += '<div class="meta">' + esc(p.loc || "") + "</div>";
      html += '<div class="pulse-row"><div class="pulse-ring" style="--p:' + pulse.score + '"><span>' + pulse.score + '</span></div>';
      html += '<div class="pulse-label">' + esc(pulse.label) + "<br/>" + pulse.views + " inmersiones · " + pulse.intent + " consultas · " + pulse.visits + " visitas</div></div>";
      html += '<p class="note">La gestión del anuncio la realiza Real Nort.</p></div></article>';
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderOwnerFeed() {
    var ids = catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id; }).map(function (p) { return p.id; });
    var events = loadEvents().filter(function (e) { return ids.indexOf(e.propertyId) >= 0; }).reverse().slice(0, 30);
    var labels = {
      detail_view: "Alguien abrió la ficha", card_click: "Click en catálogo",
      whatsapp_click: "Consulta WhatsApp", email_click: "Consulta email",
      visit_scheduled: "Visita coordinada", rented: "Marcada rentada", status_changed: "Cambio de estado"
    };
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!events.length) html += '<div class="empty">Sin actividad reciente.</div>';
    events.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.propertyId; });
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.ts)) + "</time>" +
        esc(labels[e.type] || e.type) + " · <strong>" + esc(p ? p.name : "") + "</strong></div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  function renderOwnerReport() {
    var mine = catalog.filter(function (p) { return ensureProp(p.id).ownerId === user.id; });
    var html = '<div class="panel-block"><h2>Informe 7 días</h2>';
    mine.forEach(function (p) {
      var pulse = pulseFor(p.id);
      html += "<p><strong>" + esc(p.name) + "</strong><br/>Pulse " + pulse.score + " (" + esc(pulse.label) + ") · " +
        pulse.views + " inmersiones · " + pulse.intent + " consultas · " + pulse.visits + " visitas</p>";
    });
    if (!mine.length) html += '<p class="note">Sin propiedades asignadas.</p>';
    html += "</div>";
    $("main").innerHTML = html;
  }

  function render() {
    user = currentUser();
    if (!user) return showLogin();
    if (user.role === "admin") {
      if (route === "inventory") return renderInventory();
      if (route === "owners") return renderOwners();
      if (route === "signals") return renderSignals();
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
  $("logoutBtn").onclick = function () {
    setSession(null);
    user = null;
    showLogin();
  };

  (async function boot() {
    await loadCatalog();
    mode = "local";
    $("boot").hidden = true;
    if (currentUser()) showApp();
    else showLogin();
  })();
})();
