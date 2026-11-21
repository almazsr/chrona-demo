/* Hero preview: the same falling-blocks week as demo sign-in (demo/js/tetris.js with the shared
   presets in demo/js/tetris-presets.js). One preview at a time: three days on narrow screens,
   Mon–Fri otherwise; the breakpoint matches the demo's mobile layout (demo/js/core.js). */
(function () {
  'use strict';
  var T = window.ChronaTetris;
  var desktop = document.getElementById('week-desktop');
  var mobile = document.getElementById('week-mobile');
  if (!T || !T.presets || !desktop || !mobile) return;

  var narrow = window.matchMedia('(max-width: 800px)');
  var stop = null;

  function sync() {
    if (stop) { stop(); stop = null; }
    desktop.replaceChildren();
    mobile.replaceChildren();
    stop = narrow.matches ? T.mount(mobile, T.presets.MOBILE) : T.mount(desktop, T.presets.DESKTOP);
  }

  if (narrow.addEventListener) narrow.addEventListener('change', sync); else narrow.addListener(sync);
  sync();
})();
