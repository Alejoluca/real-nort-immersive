/* FLIP layout animations — First, Last, Invert, Play */
(function (global) {
  "use strict";

  var reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  var DEFAULT_MS = 420;
  var DEFAULT_EASE = "cubic-bezier(.22, 1, .36, 1)";

  function readRect(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  /**
   * Capture positions of elements with [data-flip-id] inside root.
   */
  function capture(root) {
    var map = Object.create(null);
    if (!root) return map;
    root.querySelectorAll("[data-flip-id]").forEach(function (el) {
      map[el.getAttribute("data-flip-id")] = readRect(el);
    });
    return map;
  }

  /**
   * After DOM update, animate from first → last.
   * @param {Element} root
   * @param {Object} firstMap from capture()
   * @param {Object} opts { duration, easing, onEnter }
   */
  function play(root, firstMap, opts) {
    if (reduced || !root) return;
    opts = opts || {};
    var duration = opts.duration || DEFAULT_MS;
    var easing = opts.easing || DEFAULT_EASE;
    firstMap = firstMap || {};

    root.querySelectorAll("[data-flip-id]").forEach(function (el, index) {
      var id = el.getAttribute("data-flip-id");
      var last = readRect(el);
      var first = firstMap[id];

      // ENTER: no previous position
      if (!first) {
        if (opts.skipEnter) return;
        el.animate(
          [
            { opacity: 0, transform: "translateY(12px) scale(0.97)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: duration * 0.9,
            delay: Math.min(index * 28, 180),
            easing: easing,
            fill: "both",
          }
        );
        return;
      }

      var dx = first.left - last.left;
      var dy = first.top - last.top;
      var sx = first.width && last.width ? first.width / last.width : 1;
      var sy = first.height && last.height ? first.height / last.height : 1;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) {
        return;
      }

      // INVERT
      el.style.transformOrigin = "0 0";
      el.style.transform =
        "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
      el.style.transition = "none";
      el.style.willChange = "transform";

      // PLAY
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.transition =
            "transform " + duration + "ms " + easing;
          el.style.transform = "none";
          var done = function () {
            el.style.transition = "";
            el.style.transform = "";
            el.style.transformOrigin = "";
            el.style.willChange = "";
            el.removeEventListener("transitionend", done);
          };
          el.addEventListener("transitionend", done);
          setTimeout(done, duration + 80);
        });
      });
    });
  }

  /**
   * FLIP a container update: capture → mutate DOM → play.
   * @param {Element} root
   * @param {Function} mutate
   * @param {Object} opts
   */
  function flip(root, mutate, opts) {
    if (!root || typeof mutate !== "function") {
      if (typeof mutate === "function") mutate();
      return;
    }
    if (reduced) {
      mutate();
      return;
    }
    var first = capture(root);
    mutate();
    play(root, first, opts);
  }

  /**
   * Animate main view swap with light FLIP-style fade+slide on children.
   */
  function flipView(mainEl, renderFn) {
    if (!mainEl || typeof renderFn !== "function") return;
    if (reduced) {
      renderFn();
      return;
    }
    var kids = Array.prototype.slice.call(mainEl.children);
    var first = kids.map(function (el) {
      return { el: el, rect: readRect(el) };
    });
    renderFn();
    var next = Array.prototype.slice.call(mainEl.children);
    next.forEach(function (el, i) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 380,
          delay: Math.min(i * 30, 120),
          easing: DEFAULT_EASE,
          fill: "both",
        }
      );
    });
  }

  global.NORT_FLIP = {
    capture: capture,
    play: play,
    flip: flip,
    flipView: flipView,
    reduced: reduced,
  };
})(window);
