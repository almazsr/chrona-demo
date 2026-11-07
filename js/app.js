(function (C) {
  'use strict';
  const FREQ = { day: 1440, '3days': 3 * 1440, week: 7 * 1440 };

  // Design doc "Review reminder": in-app notification when the demo opens
  function remindAboutReview() {
    const st = C.store.state, r = st.settings.review;
    if (!st.session.signedIn || !st.session.setupDone || !r.remind || !C.solver) return;
    const n = C.solver.reviewQueue().length, now = C.clock.now;
    if (!n || (r.lastReminder != null && now - r.lastReminder < FREQ[r.freq])) return;
    r.lastReminder = now; C.store.save();
    if (C.currentRoute() === '#/review') return;
    C.ui.toast(`${n} time block${n > 1 ? 's' : ''} ${n > 1 ? 'wait' : 'waits'} for review <span data-go="#/review">Open</span>`, 8000);
  }

  function boot() {
    C.store.load();
    C.tick();
    if (C.solver && C.store.state.session.setupDone && C.solver.freeze()) C.store.save();
    C.$('#cx-toast').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { C.ui.hideToast(); C.go(g.dataset.go); } });
    C.startRouter();
    setTimeout(remindAboutReview, 1200);
    setInterval(() => {
      C.tick();
      if (C.solver && C.store.state.session.setupDone && C.solver.freeze()) C.store.save();
      C.refresh();
    }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.Chrona = window.Chrona || {});
