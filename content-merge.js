/* Merge admin content-overrides into catalog (GitHub Pages) */
(function () {
  function hideStatus(st) {
    return st === "draft" || st === "paused" || st === "rented";
  }
  function applyOne(base, patch) {
    if (!patch) return base;
    var m = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) m[k] = base[k];
    for (var j in patch) if (Object.prototype.hasOwnProperty.call(patch, j) && patch[j] !== undefined && patch[j] !== null) {
      if (j === "images" && (!patch[j] || !patch[j].length)) continue;
      m[j] = patch[j];
    }
    return m;
  }
  function merge(ov) {
    if (!ov) return;
    var deleted = {};
    (ov.deleted || []).forEach(function (id) { deleted[id] = true; });
    var patches = ov.props || {};
    var base = [].concat(window.__RN_P1 || [], window.__RN_P2 || [], window.__RN_P3 || []);
    if (!base.length && window.allProperties) base = window.allProperties.slice();
    var out = [];
    base.forEach(function (p) {
      if (!p || !p.id || deleted[p.id]) return;
      var m = applyOne(p, patches[p.id]);
      if (hideStatus(m.status)) return;
      out.push(m);
    });
    (ov.custom || []).forEach(function (p) {
      if (!p || !p.id || deleted[p.id]) return;
      if (hideStatus(p.status)) return;
      if (out.some(function (x) { return x.id === p.id; })) return;
      out.push(p);
    });
    window.allProperties = out;
    window.featured = out.slice(0, Math.min(7, out.length));
    try {
      if (typeof featured !== "undefined") featured = window.featured;
      if (typeof allProperties !== "undefined") allProperties = window.allProperties;
    } catch (e) {}
    if (typeof window.__RN_ON_DATA === "function") {
      try { window.__RN_ON_DATA(); } catch (e2) {}
    }
  }
  function load() {
    var local = null;
    try {
      local = JSON.parse(localStorage.getItem("nort_os_content_v1") || "null");
      if (local && local.livePreview === false) local = null;
    } catch (e) {}
    fetch("content-overrides.json?t=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        // local admin overrides win for same browser preview
        var ov = remote || { props: {}, custom: [], deleted: [] };
        if (local) {
          ov = {
            version: Math.max(local.version || 1, ov.version || 1),
            deleted: [].concat(ov.deleted || [], local.deleted || []).filter(function (v, i, a) { return a.indexOf(v) === i; }),
            props: Object.assign({}, ov.props || {}, local.props || {}),
            custom: (local.custom && local.custom.length ? local.custom : ov.custom) || []
          };
        }
        merge(ov);
      })
      .catch(function () {
        if (local) merge(local);
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  window.__RN_APPLY_CONTENT = load;
})();
