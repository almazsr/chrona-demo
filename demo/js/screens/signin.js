(function (C) {
  'use strict';
  // Sign-in, style C "Split with week preview" (mockup 01, authentication.feature)
  const APPLE = '<svg width="14" height="16" viewBox="0 0 14 16"><path fill="currentColor" d="M11.6 8.5c0-1.6 1.3-2.4 1.4-2.5-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.8 4.7 3.7 5.4 3 6.5c-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.6-.9 2.2-1.8.7-1 1-2 1-2.1-.1 0-1.9-.7-1.6-3.2zM9.8 3.5c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.5-.9 1.4-.8 2.3.9.1 1.8-.5 2.3-1.1z"/></svg>';
  const PROVIDERS = [
    ['Google', '<span class="si-ico" style="color:#4285f4">G</span>'],
    ['Apple', `<span class="si-ico">${APPLE}</span>`],
    ['Microsoft', '<span class="si-ico ms"><i style="background:#f25022"></i><i style="background:#7fba00"></i><i style="background:#00a4ef"></i><i style="background:#ffb900"></i></span>'],
  ];
  const { DESKTOP, MOBILE } = window.ChronaTetris.presets; // js/tetris-presets.js, shared with the landing
  let stopPreview = null;

  // one animated preview at a time: the three-day one in the mobile layout, the week otherwise
  function preview(root) {
    const mobile = root.querySelector('.si-mobile-week'), desktop = root.querySelector('.si-desktop-week');
    let stop = null;
    const sync = () => {
      if (stop) { stop(); stop = null; }
      mobile.replaceChildren(); desktop.replaceChildren();
      stop = C.mobileLayout.matches ? window.ChronaTetris.mount(mobile, MOBILE) : window.ChronaTetris.mount(desktop, DESKTOP);
    };
    C.mobileLayout.addEventListener('change', sync);
    sync();
    return () => { if (stop) stop(); C.mobileLayout.removeEventListener('change', sync); };
  }

  C.screen('signin', {
    mount(root) {
      root.innerHTML = `<div class="si">
        <div class="si-left"><div class="si-panel">
          <div class="si-logo"><span class="si-mark"></span>Chrona</div>
          <h1>Your week, arranged for you</h1>
          <p class="si-sub">Tell Chrona what needs doing. It fits your tasks around meetings and replans when the day changes.</p>
          ${PROVIDERS.map(([p, ico]) => `<button type="button" class="si-btn" data-provider="${p}">${ico}Continue with ${p}</button>`).join('')}
          <div class="si-foot">Demo mode: sample data, no real account, nothing connects to your calendar.${window.ChronaEarlyAccess && !window.ChronaEarlyAccess.sent() ? ' <a href="#" class="si-ea" data-early-access="demo-sign-in">Get early access</a>' : ''}</div>
        </div></div>
        <div class="si-right">
          <div class="si-desktop-week" aria-hidden="true"></div>
          <div class="si-mobile-week" aria-hidden="true"></div>
        </div>
      </div>`;
      stopPreview = preview(root);
      root.firstElementChild.addEventListener('click', e => {
        const b = e.target.closest('[data-provider]'); if (!b) return;
        const s = C.store.state.session;
        s.signedIn = true; s.provider = b.dataset.provider; s.email = 'you@example.com';
        C.store.save();
        C.go(s.setupDone ? '#/calendar' : (s.step === 'categories' ? '#/setup/categories' : '#/setup/time-spaces'));
      });
    },
    unmount() { stopPreview?.(); stopPreview = null; },
  });
})(window.Chrona = window.Chrona || {});
