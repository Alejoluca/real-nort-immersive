/* Real Nort — availability helpers + public calendar (no online booking) */
(function (global) {
  "use strict";

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function toISO(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function parseISO(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split("-");
    if (p.length < 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  function nightsBetween(a, b) {
    var da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.max(0, Math.round((db - da) / 864e5));
  }
  function expandRanges(ranges) {
    var set = {};
    (ranges || []).forEach(function (r) {
      var a = parseISO(r.start || r.from);
      var b = parseISO(r.end || r.to || r.start || r.from);
      if (!a || !b) return;
      if (b < a) { var t = a; a = b; b = t; }
      for (var d = a; d <= b; d = addDays(d, 1)) set[toISO(d)] = true;
    });
    return set;
  }
  function isNightBlocked(isoDate, blockedSet) {
    return !!blockedSet[isoDate];
  }
  /** Stay nights are checkIn .. checkOut-1 */
  function rangeHasBlocked(checkIn, checkOut, ranges) {
    var set = expandRanges(ranges);
    var a = parseISO(checkIn), b = parseISO(checkOut);
    if (!a || !b || b <= a) return true;
    for (var d = a; d < b; d = addDays(d, 1)) {
      if (set[toISO(d)]) return true;
    }
    return false;
  }
  function rentalType(p) {
    return (p && p.rentalType) || "long";
  }
  function isVacation(p) {
    var t = rentalType(p);
    return t === "vacation" || t === "both";
  }
  function isLong(p) {
    var t = rentalType(p);
    return t === "long" || t === "both" || !p.rentalType;
  }
  function monthMatrix(year, month) {
    // month 0-11; returns weeks of ISO dates or null
    var first = new Date(year, month, 1);
    var startPad = (first.getDay() + 6) % 7; // Mon=0
    var days = new Date(year, month + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startPad; i++) cells.push(null);
    for (var d = 1; d <= days; d++) cells.push(toISO(new Date(year, month, d)));
    while (cells.length % 7) cells.push(null);
    var weeks = [];
    for (var w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
    return weeks;
  }

  function renderMonthHTML(p, year, month, opts) {
    opts = opts || {};
    var ranges = (p && p.blockedRanges) || [];
    var blocked = expandRanges(ranges);
    var today = toISO(new Date());
    var weeks = monthMatrix(year, month);
    var months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    var html = '<div class="rn-cal" data-y="' + year + '" data-m="' + month + '">';
    html += '<div class="rn-cal-head">';
    if (opts.nav) {
      html += '<button type="button" class="rn-cal-nav" data-dir="-1" aria-label="Mes anterior">‹</button>';
    }
    html += '<span class="rn-cal-title">' + months[month] + " " + year + "</span>";
    if (opts.nav) {
      html += '<button type="button" class="rn-cal-nav" data-dir="1" aria-label="Mes siguiente">›</button>';
    }
    html += "</div>";
    html += '<div class="rn-cal-dow">';
    ["L","M","X","J","V","S","D"].forEach(function (d) { html += "<span>" + d + "</span>"; });
    html += "</div><div class=\"rn-cal-grid\">";
    weeks.forEach(function (week) {
      week.forEach(function (iso) {
        if (!iso) { html += '<button type="button" class="rn-cal-day empty" disabled></button>'; return; }
        var past = iso < today;
        var occ = !!blocked[iso];
        var cls = "rn-cal-day";
        if (past) cls += " past";
        else if (occ) cls += " blocked";
        else cls += " free";
        if (opts.selected && (iso === opts.selected.start || iso === opts.selected.end)) cls += " selected";
        if (opts.selected && opts.selected.start && opts.selected.end && iso > opts.selected.start && iso < opts.selected.end) cls += " inrange";
        html += '<button type="button" class="' + cls + '" data-date="' + iso + '"' + (past && !opts.admin ? " disabled" : "") + ">" + Number(iso.slice(8)) + "</button>";
      });
    });
    html += "</div>";
    html += '<div class="rn-cal-legend"><span class="free">Disponible</span><span class="blocked">Ocupado</span></div>';
    html += "</div>";
    return html;
  }

  global.RNAvail = {
    toISO: toISO,
    parseISO: parseISO,
    addDays: addDays,
    nightsBetween: nightsBetween,
    expandRanges: expandRanges,
    rangeHasBlocked: rangeHasBlocked,
    rentalType: rentalType,
    isVacation: isVacation,
    isLong: isLong,
    monthMatrix: monthMatrix,
    renderMonthHTML: renderMonthHTML
  };
})(window);
