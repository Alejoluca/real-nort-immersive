/* NORT realtime sync — WebSocket + BroadcastChannel + polling (GitHub Pages safe) */
(function (global) {
  "use strict";

  var CHANNEL = "nort-os-realtime-v1";
  var DEFAULT_POLL_MS = 6000;
  var FAST_POLL_MS = 2500;
  var lastStamp = null;
  var timer = null;
  var ws = null;
  var bc = null;
  var started = false;
  var opts = {};

  function wsUrl() {
    return (
      global.NORT_WS_URL ||
      (typeof localStorage !== "undefined" && localStorage.getItem("nort_ws_url")) ||
      ""
    ).replace(/\/$/, "");
  }

  function log() {
    if (global.NORT_RT_DEBUG) {
      try { console.log.apply(console, ["[NORT RT]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }

  function emitContent(payload, source) {
    if (!payload || typeof payload !== "object") return;
    var stamp = payload.updatedAt || JSON.stringify(payload).slice(0, 80);
    if (stamp && stamp === lastStamp && source !== "ws") return;
    lastStamp = stamp;
    try {
      if (typeof opts.onContent === "function") opts.onContent(payload, source);
    } catch (e) { log("onContent error", e); }
    try {
      global.dispatchEvent(new CustomEvent("nort:content", { detail: { payload: payload, source: source } }));
    } catch (e2) {}
  }

  function pullJson() {
    var url = (opts.contentUrl || "content-overrides.json") + "?t=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) emitContent(data, "poll");
        return data;
      })
      .catch(function () { return null; });
  }

  function schedulePoll() {
    if (timer) clearInterval(timer);
    var visible = typeof document === "undefined" || document.visibilityState === "visible";
    var ms = visible ? (opts.fastPollMs || FAST_POLL_MS) : (opts.pollMs || DEFAULT_POLL_MS) * 2;
    timer = setInterval(function () {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      pullJson();
    }, ms);
  }

  function connectWs() {
    var url = wsUrl();
    if (!url || typeof WebSocket === "undefined") return;
    try {
      if (ws) {
        try { ws.close(); } catch (e) {}
        ws = null;
      }
      // allow http page to use wss or ws
      ws = new WebSocket(url);
      ws.onopen = function () {
        log("ws open", url);
        try {
          ws.send(JSON.stringify({ type: "hello", role: opts.role || "client", at: new Date().toISOString() }));
        } catch (e) {}
      };
      ws.onmessage = function (ev) {
        try {
          var msg = JSON.parse(ev.data);
          if (msg && msg.type === "content" && msg.payload) {
            emitContent(msg.payload, "ws");
          } else if (msg && msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch (e) {}
      };
      ws.onclose = function () {
        log("ws close — retry 8s");
        ws = null;
        setTimeout(connectWs, 8000);
      };
      ws.onerror = function () { log("ws error"); };
    } catch (e) {
      log("ws fail", e);
    }
  }

  function setupBroadcast() {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = function (ev) {
        var msg = ev.data;
        if (msg && msg.type === "content" && msg.payload) emitContent(msg.payload, "broadcast");
      };
    } catch (e) {}
  }

  function broadcastContent(payload) {
    if (!payload) return;
    lastStamp = payload.updatedAt || lastStamp;
    try {
      if (bc) bc.postMessage({ type: "content", payload: payload });
    } catch (e) {}
    try {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "content", payload: payload, at: new Date().toISOString() }));
      }
    } catch (e2) {}
    try {
      localStorage.setItem("nort_rt_ping", String(Date.now()));
    } catch (e3) {}
  }

  function start(options) {
    opts = options || {};
    if (started) return api;
    started = true;
    setupBroadcast();
    connectWs();
    schedulePoll();
    pullJson();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        schedulePoll();
        if (document.visibilityState === "visible") pullJson();
      });
    }
    try {
      global.addEventListener("storage", function (ev) {
        if (ev.key === "nort_rt_ping") pullJson();
      });
    } catch (e) {}
    log("started");
    return api;
  }

  function stop() {
    started = false;
    if (timer) clearInterval(timer);
    timer = null;
    if (ws) try { ws.close(); } catch (e) {}
    ws = null;
    if (bc) try { bc.close(); } catch (e2) {}
    bc = null;
  }

  var api = {
    start: start,
    stop: stop,
    pull: pullJson,
    broadcastContent: broadcastContent,
    setWsUrl: function (url) {
      try { localStorage.setItem("nort_ws_url", url || ""); } catch (e) {}
      global.NORT_WS_URL = url || "";
      connectWs();
    },
    status: function () {
      return {
        ws: !!(ws && ws.readyState === 1),
        wsUrl: wsUrl(),
        lastStamp: lastStamp,
        polling: !!timer
      };
    }
  };

  global.NORT_REALTIME = api;
})(window);
