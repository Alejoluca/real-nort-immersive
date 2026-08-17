(async function () {
const WA = "529843237592";
const FB = "https://www.facebook.com/alejo.lucatelliperren";
const IG = "https://www.instagram.com/alejo_lucatelli/";
const EMAIL = (window.RN_EMAIL || "alejolucatelli@gmail.com").trim();
const metrics = {
events: [],
track(name, data) {
this.events.push({ name, t: Date.now(), ...data });
try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "rn_" + name, ...data }); } catch (_) {}
try { if (typeof gtag === "function" && window.RN_GA4_ID && String(window.RN_GA4_ID).indexOf("XXXX") === -1) { gtag("event", name, Object.assign({ event_category: "real_nort", send_to: window.RN_GA4_ID }, data || {})); } } catch (_) {}
},
summary() { const c = {}; this.events.forEach((e) => { c[e.name] = (c[e.name] || 0) + 1; }); return c; }
};
window.__RN_METRICS = metrics;
function driveOpt(url, w) {
if (!url) return url;
const width = w || 1600;
if (url.indexOf("lh3.googleusercontent.com/d/") !== -1) return url.replace(/=w\d+.*/, "") + "=w" + width;
if (url.indexOf("drive.google.com") !== -1) {
const m = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
if (m) return "https://lh3.googleusercontent.com/d/" + m[1] + "=w" + width;
}
return url;
}
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
function emailMsg(p) {
const sub = encodeURIComponent("Consulta Real Nort: " + (p && p.name ? p.name : "Propiedades Tulum"));
let body = "Hola Alejo,\n\nVi la web de Real Nort México";
if (p && p.name) body += " y me interesa:\n\n" + p.name + "\n" + (p.loc || "") + " · " + (p.beds || "") + "\n" + (p.price || "");
body += "\n\n¿Me puedes dar más información?\n";
return "mailto:" + EMAIL + "?subject=" + sub + "&body=" + encodeURIComponent(body);
}
function mapsUrl(p) {
if (p && p.maps) return p.maps;
const q = encodeURIComponent((p && p.name ? p.name + ", " : "") + (p && p.loc ? p.loc + ", " : "") + "Tulum, Quintana Roo, Mexico");
return "https://www.google.com/maps/search/?api=1&query=" + q;
}
const gallery = document.getElementById("gallery");
const progressRail = document.getElementById("progressRail");
let currentIndex = 0, wheelLock = false;
let filterBeds = "all", filterRegion = "all";
let currentDetail = null, detailIdx = 0, gridImgObs = null, detailImgs = [];
let catalogMap = null, mapMarkers = [], catalogView = "grid";
let detailWheelLock = false, detailIo = null;
function safeImg(p, i, w) {
let url = null;
if (p && p.images && p.images.length) url = p.images[Math.min(i || 0, p.images.length - 1)] || p.images[0];
if (!url) url = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop";
return driveOpt(url, w || 1600);
}
function lazyBg(el, url, fallback, opts) {
if (!el || el.classList.contains("loaded") || el.dataset.loading === "1") return;
el.dataset.loading = "1";
opts = opts || {};
const full = url;
let preview = null;
if (full && full.indexOf("lh3.googleusercontent.com/d/") !== -1 && !opts.noPreview) {
preview = full.replace(/=w\d+.*/, "") + "=w400";
}
function apply(src, done) {
const img = new Image();
img.decoding = "async";
if (opts.priority === "high") { try { img.fetchPriority = "high"; } catch (_) {} }
else { img.loading = "lazy"; }
img.onload = () => {
el.style.backgroundImage = "url('" + src + "')";
if (done) { el.classList.add("loaded"); el.dataset.loading = "0"; }
};
img.onerror = () => {
if (done) {
const fb = fallback || safeImg(null, 0, 600);
if (fb && fb !== src) el.style.backgroundImage = "url('" + fb + "')";
el.classList.add("loaded"); el.dataset.loading = "0";
}
};
img.src = src;
}
if (preview && preview !== full) { apply(preview, false); apply(full, true); }
else { apply(full, true); }
}
/* PLACEHOLDER_BUILD - continued in next push if truncated */
console.warn('RN: incomplete app - need full push');
})();
