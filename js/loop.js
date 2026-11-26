/* Looping playback for the landing animations (features/landing.feature,
   "Show each benefit with its own looping animation").
   ChronaLoop(target, setup, options):
   - setup() draws the first frame and returns { steps: [[delayMs, fn], ...] };
   - while `target` is visible the steps play, the last frame holds for 5 s, then it starts over;
   - out of view it stops, back in view it starts from the first frame;
   - with reduced motion it shows the last frame once, without motion. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  window.ChronaLoop = function (target, setup, options) {
    var o = options || {};
    var pause = o.pause == null ? 5000 : o.pause;
    var lead = o.lead == null ? 600 : o.lead;
    var timers = [];

    function clear() { timers.forEach(clearTimeout); timers = []; }
    function first() {
      target.classList.add('no-anim');
      var s = setup();
      void target.offsetWidth; // apply the first frame before motion is allowed again
      target.classList.remove('no-anim');
      return s;
    }
    function cycle() {
      clear();
      var s = first(), t = lead;
      s.steps.forEach(function (step) { t += step[0]; timers.push(setTimeout(step[1], t)); });
      timers.push(setTimeout(cycle, t + (s.tail || 0) + pause));
    }

    if (reduced.matches || !('IntersectionObserver' in window)) {
      target.classList.add('no-anim');
      setup().steps.forEach(function (step) { step[1](); });
      return { stop: clear };
    }

    first();
    var visible = false;
    new IntersectionObserver(function (entries) {
      var now = entries[0].isIntersecting;
      if (now === visible) return;
      visible = now;
      if (now) cycle(); else clear();
    }, { threshold: 0.35 }).observe(target);
    return { stop: clear };
  };
})();
