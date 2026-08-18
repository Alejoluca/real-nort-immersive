/* NORT OS Panel — API-first (SQLite server). Fallback local if API offline. */
(function () {
  "use strict";

  var API = window.NORT_API || localStorage.getItem("nort_api") || "";
  var TOKEN_KEY = "nort_os_token";
  var mode = "api"; // or "local"

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function fmtDate(ts) {
    try {
      var d = typeof ts === "number" ? new Date(ts) : new Date(ts);
      return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return String(ts); }
  }

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token()) headers.Authorization = "Bearer " + token();
    var res = await fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = null;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  var user = null;
  var catalog = [];
  var propMeta = {}; // id -> { status, owner_id }
  var route = "home";

  async function loadCatalog() {
    var paths = ["../data.json", "../catalog-full.json"];
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
        return;
      } catch (e) {}
    }
    catalog = [];
  }

  async function refreshMeta() {
    if (mode !== "api" || !user) return;
    try {
      var data = await api("/api/owner/properties");
      propMeta = {};
      (data.properties || []).forEach(function (r) {
        propMeta[r.property_id] = r;
      });
    } catch (e) {
      // admin inventory uses same endpoint shape
    }
    if (user.role === "admin") {
      try {
        var data2 = await api("/api/admin/properties");
        propMeta = {};
        (data2.properties || []).forEach(function (r) {
          propMeta[r.property_id] = r;
        });
      } catch (e) {}
    }
  }

  function metaOf(id) {
    return propMeta[id] || { property_id: id, status: "published", owner_id: null };
  }

  function pulseLabel(score) {
    return score >= 70 ? "Ardiente" : score >= 40 ? "Caliente" : score >= 15 ? "Tibio" : "Frío";
  }

  // ——— Views ———
  function showLogin() {
    $("boot").hidden = true;
    $("appView").hidden = true;
    $("loginView").hidden = false;
  }

  function showApp() {
    $("boot").hidden = true;
    $("loginView").hidden = true;
    $("appView").hidden = false;
    $("roleBadge").textContent = user.role === "admin" ? "Admin" : "Propietario";
    $("userLabel").textContent = user.name || user.username;
    renderNav();
    render();
  }

  function renderNav() {
    var items = user.role === "admin"
      ? [["home", "Command"], ["inventory", "Inventario"], ["owners", "Propietarios"], ["signals", "Actividad"], ["audit", "Audit"]]
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

  async function renderAdminHome() {
    $("main").innerHTML = '<p class="section-title">Command center</p><div class="empty">Cargando…</div>';
    var published = 0, paused = 0, rented = 0;
    catalog.forEach(function (p) {
      var st = metaOf(p.id).status || "published";
      if (st === "published" || st === "reserved") published++;
      else if (st === "paused") paused++;
      else if (st === "rented") rented++;
    });
    var activity = [];
    try { activity = (await api("/api/owner/activity")).events || []; } catch (e) {}

    var html = '<div class="kpi-row">' +
      kpi("Propiedades", catalog.length, "Catálogo") +
      kpi("Publicadas", published, "") +
      kpi("Pausadas", paused, "") +
      kpi("Rentadas", rented, "") +
      "</div>";
    html += '<p class="section-title">Actividad reciente</p><div class="feed">';
    if (!activity.length) html += '<div class="empty">Sin eventos en servidor aún. El sitio público enviará tracking cuando NORT_API esté configurada.</div>';
    activity.slice(0, 15).forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.property_id; });
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.created_at)) + "</time><strong>" +
        esc(e.type) + "</strong> · " + esc(p ? p.name : e.property_id || "—") + "</div>";
    });
    html += "</div>";
    html += '<p class="note">Modo: <strong>' + esc(mode) + "</strong> · API: " + esc(API || "(no configurada)") + "</p>";
    $("main").innerHTML = html;
  }

  async function renderInventory() {
    $("main").innerHTML = '<div class="empty">Cargando inventario…</div>';
    await refreshMeta();
    var owners = [];
    try { owners = (await api("/api/admin/owners")).owners || []; } catch (e) {}

    var html = '<p class="section-title">Inventario · asignación y disponibilidad</p>';
    html += '<div class="table-wrap"><table><thead><tr><th>Propiedad</th><th>Status</th><th>Propietario</th><th>Acciones</th></tr></thead><tbody>';

    catalog.forEach(function (p) {
      var m = metaOf(p.id);
      html += '<tr data-id="' + esc(p.id) + '"><td><strong>' + esc(p.name) + '</strong><div class="meta">' + esc(p.id) + "</div></td>";
      html += '<td><select data-act="status">';
      ["published", "paused", "reserved", "rented", "draft"].forEach(function (st) {
        html += '<option value="' + st + '"' + ((m.status || "published") === st ? " selected" : "") + ">" + st + "</option>";
      });
      html += "</select></td><td><select data-act=\"owner\"><option value=\"\">— Sin dueño —</option>";
      owners.forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (m.owner_id === o.id ? " selected" : "") + ">" + esc(o.name || o.username) + "</option>";
      });
      html += '</select></td><td>';
      html += '<button type="button" class="btn ghost sm" data-act="visit">+ Visita</button> ';
      html += '<button type="button" class="btn ghost sm" data-act="rent">Rentado</button></td></tr>';
    });
    html += "</tbody></table></div>";
    html += '<p class="note">Solo vos asignás propietarios y disponibilidad. Ellos no editan el catálogo.</p>';
    $("main").innerHTML = html;

    $("main").querySelectorAll("tr[data-id]").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector('[data-act="status"]').onchange = async function () {
        try {
          await api("/api/admin/properties/" + encodeURIComponent(id), {
            method: "PATCH",
            body: { status: this.value },
          });
          await refreshMeta();
        } catch (e) { alert(e.message); }
      };
      row.querySelector('[data-act="owner"]').onchange = async function () {
        try {
          await api("/api/admin/properties/" + encodeURIComponent(id), {
            method: "PATCH",
            body: { owner_id: this.value || null },
          });
          await refreshMeta();
        } catch (e) { alert(e.message); }
      };
      row.querySelector('[data-act="visit"]').onclick = async function () {
        try {
          await api("/api/admin/properties/" + encodeURIComponent(id) + "/events", {
            method: "POST",
            body: { type: "visit_scheduled" },
          });
          alert("Visita registrada · notificación encolada al owner");
        } catch (e) { alert(e.message); }
      };
      row.querySelector('[data-act="rent"]').onclick = async function () {
        try {
          await api("/api/admin/properties/" + encodeURIComponent(id) + "/events", {
            method: "POST",
            body: { type: "rented" },
          });
          await refreshMeta();
          render();
        } catch (e) { alert(e.message); }
      };
    });
  }

  async function renderOwners() {
    $("main").innerHTML = '<div class="empty">Cargando…</div>';
    var owners = [];
    try { owners = (await api("/api/admin/owners")).owners || []; } catch (e) {
      $("main").innerHTML = '<div class="empty">' + esc(e.message) + "</div>";
      return;
    }

    var html = '<div class="panel-block"><h2>Crear cuenta de propietario</h2>';
    html += '<p class="note">Vos definís usuario, contraseña y email de notificaciones. El propietario no se registra solo: le transmitís el acceso.</p>';
    html += '<div class="form-row">';
    html += '<label>Nombre<input id="oName" type="text" placeholder="Nombre completo"/></label>';
    html += '<label>Usuario<input id="oUser" type="text" placeholder="usuario"/></label>';
    html += '<label>Email notificaciones<input id="oEmail" type="email" placeholder="dueño@email.com"/></label>';
    html += '<label>Teléfono<input id="oPhone" type="text" placeholder="+52…"/></label>';
    html += '<label>Contraseña temporal<input id="oPass" type="text" placeholder="mín. 8 caracteres"/></label>';
    html += '</div><button type="button" class="btn gold" id="oCreate">Crear y mostrar acceso</button>';
    html += '<pre id="oCreds" class="note" style="display:none;white-space:pre-wrap;margin-top:12px"></pre></div>';

    html += '<p class="section-title">Propietarios</p><div class="table-wrap"><table><thead><tr>';
    html += "<th>Nombre</th><th>Usuario</th><th>Email</th><th>Estado</th><th></th></tr></thead><tbody>";
    owners.forEach(function (o) {
      html += "<tr><td>" + esc(o.name) + "</td><td>" + esc(o.username) + "</td><td>" + esc(o.email) + "</td>";
      html += "<td>" + (o.notify_email !== false ? "Avisos ON" : "Avisos OFF") + "</td>";
      html += '<td><button type="button" class="btn danger sm" data-off="' + esc(o.id) + '">Desactivar</button> ';
      html += '<button type="button" class="btn ghost sm" data-reset="' + esc(o.id) + '">Reset pass</button></td></tr>';
    });
    html += "</tbody></table></div>";
    $("main").innerHTML = html;

    $("oCreate").onclick = async function () {
      try {
        var body = {
          name: $("oName").value.trim(),
          username: $("oUser").value.trim(),
          email: $("oEmail").value.trim(),
          phone: $("oPhone").value.trim(),
          password: $("oPass").value,
        };
        var res = await api("/api/admin/owners", { method: "POST", body: body });
        var box = $("oCreds");
        box.style.display = "block";
        box.textContent =
          "Transmití esto al propietario (no se vuelve a mostrar la pass):\n\n" +
          "Usuario: " + res.owner.username + "\n" +
          "Contraseña: " + res.temporary_password + "\n" +
          "Email avisos: " + res.owner.email + "\n" +
          "Panel: " + location.href;
        renderOwners();
      } catch (e) { alert(e.message); }
    };

    $("main").querySelectorAll("[data-off]").forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm("¿Desactivar propietario y desasignar sus props?")) return;
        try {
          await api("/api/admin/owners/" + btn.getAttribute("data-off"), {
            method: "PATCH",
            body: { active: false },
          });
          renderOwners();
        } catch (e) { alert(e.message); }
      };
    });

    $("main").querySelectorAll("[data-reset]").forEach(function (btn) {
      btn.onclick = async function () {
        var pass = prompt("Nueva contraseña temporal (mín. 8):");
        if (!pass) return;
        try {
          var res = await api("/api/admin/owners/" + btn.getAttribute("data-reset"), {
            method: "PATCH",
            body: { password: pass },
          });
          alert("Nueva pass: " + (res.temporary_password || pass));
        } catch (e) { alert(e.message); }
      };
    });
  }

  async function renderSignals() {
    var activity = [];
    try { activity = (await api("/api/owner/activity")).events || []; } catch (e) {}
    var html = '<p class="section-title">Actividad</p><div class="feed">';
    if (!activity.length) html += '<div class="empty">Sin eventos</div>';
    activity.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.property_id; });
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.created_at)) + "</time>" +
        esc(e.type) + " · " + esc(p ? p.name : e.property_id || "") + "</div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  async function renderAudit() {
    try {
      var data = await api("/api/admin/audit");
      var html = '<p class="section-title">Audit log</p><div class="feed">';
      (data.audit || []).forEach(function (a) {
        html += '<div class="feed-item"><time>' + esc(fmtDate(a.created_at)) + "</time>" +
          esc(a.action) + " · " + esc(a.entity_type || "") + " " + esc(a.entity_id || "") + "</div>";
      });
      html += "</div>";
      $("main").innerHTML = html;
    } catch (e) {
      $("main").innerHTML = '<div class="empty">' + esc(e.message) + "</div>";
    }
  }

  async function renderOwnerHome() {
    await refreshMeta();
    var mine = catalog.filter(function (p) { return metaOf(p.id).owner_id === user.id; });
    if (user.role === "admin") mine = catalog.slice(0, 12);

    if (!mine.length) {
      $("main").innerHTML = '<div class="empty">Real Nort aún no te asignó propiedades. Solo ellos gestionan altas y el anuncio.</div>';
      return;
    }

    var html = '<p class="section-title">Tus propiedades · solo lectura</p><div class="grid-cards">';
    for (const p of mine) {
      var m = metaOf(p.id);
      var metrics = { pulse: { score: 0, label: "Frío" }, totals: { views: 0, intent: 0, visits: 0 } };
      try {
        metrics = await api("/api/owner/properties/" + encodeURIComponent(p.id) + "/metrics?days=7");
      } catch (e) {}
      var img = (p.images && p.images[0]) ? String(p.images[0]).replace(/=w\d+/, "=w600") : "";
      html += '<article class="pcard"><div class="pcard-media" style="background-image:url(\'' + esc(img) + '\')"></div><div class="pcard-body">';
      html += '<div class="pcard-top"><h3>' + esc(p.name) + '</h3><span class="status ' + esc(m.status || "published") + '">' + esc(m.status || "published") + "</span></div>";
      html += '<div class="meta">' + esc(p.loc || "") + "</div>";
      html += '<div class="pulse-row"><div class="pulse-ring" style="--p:' + metrics.pulse.score + '"><span>' + metrics.pulse.score + "</span></div>";
      html += '<div class="pulse-label">' + esc(metrics.pulse.label) + "<br/>" +
        (metrics.totals.views || 0) + " inmersiones · " + (metrics.totals.intent || 0) + " consultas · " +
        (metrics.totals.visits || 0) + " visitas</div></div>";
      html += '<p class="note">La gestión del anuncio la realiza Real Nort.</p></div></article>';
    }
    html += "</div>";
    $("main").innerHTML = html;
  }

  async function renderOwnerFeed() {
    var activity = [];
    try { activity = (await api("/api/owner/activity")).events || []; } catch (e) {}
    var html = '<p class="section-title">Actividad en tus propiedades</p><div class="feed">';
    if (!activity.length) html += '<div class="empty">Sin actividad reciente</div>';
    activity.forEach(function (e) {
      var p = catalog.find(function (x) { return x.id === e.property_id; });
      var labels = {
        detail_view: "Alguien abrió la ficha",
        card_click: "Click en catálogo",
        whatsapp_click: "Consulta WhatsApp",
        email_click: "Consulta email",
        visit_scheduled: "Visita coordinada",
        rented: "Marcada rentada",
      };
      html += '<div class="feed-item"><time>' + esc(fmtDate(e.created_at)) + "</time>" +
        esc(labels[e.type] || e.type) + " · <strong>" + esc(p ? p.name : "") + "</strong></div>";
    });
    html += "</div>";
    $("main").innerHTML = html;
  }

  async function renderOwnerReport() {
    await refreshMeta();
    var mine = catalog.filter(function (p) { return metaOf(p.id).owner_id === user.id; });
    var html = '<div class="panel-block"><h2>Informe 7 días</h2>';
    for (const p of mine) {
      try {
        var m = await api("/api/owner/properties/" + encodeURIComponent(p.id) + "/metrics?days=7");
        html += "<p><strong>" + esc(p.name) + "</strong><br/>Pulse " + m.pulse.score + " (" + esc(m.pulse.label) + ") · " +
          m.totals.views + " inmersiones · " + m.totals.intent + " consultas · " + m.totals.visits + " visitas</p>";
      } catch (e) {}
    }
    if (!mine.length) html += '<p class="note">Sin propiedades asignadas.</p>';
    html += "</div>";
    $("main").innerHTML = html;
  }

  function render() {
    if (!user) return showLogin();
    if (user.role === "admin") {
      if (route === "inventory") return renderInventory();
      if (route === "owners") return renderOwners();
      if (route === "signals") return renderSignals();
      if (route === "audit") return renderAudit();
      return renderAdminHome();
    }
    if (route === "feed") return renderOwnerFeed();
    if (route === "report") return renderOwnerReport();
    return renderOwnerHome();
  }

  async function tryLogin() {
    $("loginErr").hidden = true;
    var username = $("loginUser").value.trim();
    var password = $("loginPass").value;
    if (!API) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = "Configurá window.NORT_API (servidor). Ej: http://localhost:8787";
      return;
    }
    try {
      var data = await api("/api/auth/login", { method: "POST", body: { username: username, password: password } });
      setToken(data.token);
      user = data.user;
      route = "home";
      await refreshMeta();
      showApp();
    } catch (e) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = e.message || "Error de acceso";
    }
  }

  $("loginBtn").onclick = tryLogin;
  $("loginPass").addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  $("logoutBtn").onclick = async function () {
    try { await api("/api/auth/logout", { method: "POST", body: {} }); } catch (e) {}
    setToken("");
    user = null;
    showLogin();
  };

  // Optional API field on first paint via query ?api=
  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q) {
      API = q.replace(/\/$/, "");
      localStorage.setItem("nort_api", API);
      window.NORT_API = API;
    } else if (!API) {
      API = localStorage.getItem("nort_api") || "";
    }
  } catch (e) {}

  (async function boot() {
    await loadCatalog();
    if (API) {
      try {
        await fetch(API + "/api/health");
        mode = "api";
      } catch (e) {
        mode = "offline";
      }
    } else {
      mode = "offline";
    }

    if (token() && API) {
      try {
        var me = await api("/api/auth/me");
        user = me.user;
        await refreshMeta();
        showApp();
        return;
      } catch (e) {
        setToken("");
      }
    }
    $("boot").hidden = true;
    showLogin();
    if (!API) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = "Definí la API: localStorage nort_api o ?api=http://localhost:8787";
    }
  })();
})();
