(function (C) {
  'use strict';
  // Sign-in, style C "Split with week preview" (mockup 01, authentication.feature)
  const APPLE = '<svg width="14" height="16" viewBox="0 0 14 16"><path fill="currentColor" d="M11.6 8.5c0-1.6 1.3-2.4 1.4-2.5-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.8 4.7 3.7 5.4 3 6.5c-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.6-.9 2.2-1.8.7-1 1-2 1-2.1-.1 0-1.9-.7-1.6-3.2zM9.8 3.5c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.5-.9 1.4-.8 2.3.9.1 1.8-.5 2.3-1.1z"/></svg>';
  const PROVIDERS = [
    ['Google', '<span class="si-ico" style="color:#4285f4">G</span>'],
    ['Apple', `<span class="si-ico">${APPLE}</span>`],
    ['Microsoft', '<span class="si-ico ms"><i style="background:#f25022"></i><i style="background:#7fba00"></i><i style="background:#00a4ef"></i><i style="background:#ffb900"></i></span>'],
  ];
  // sample week shown next to the sign-in buttons: [day, start, end, category, title]
  const BLOCKS = [
    [0, '09:00', '09:45', 'work', 'Team sync'], [0, '10:00', '12:00', 'work', 'Prepare report'], [0, '13:30', '14:30', 'gym', 'Gym'], [0, '18:30', '20:00', 'fam', 'Dinner'],
    [1, '09:00', '11:30', 'work', 'Deep work'], [1, '11:45', '12:30', 'work', '1:1'], [1, '16:00', '17:45', 'side', 'Side project'],
    [2, '09:30', '10:30', 'work', 'Client call'], [2, '10:45', '12:30', 'work', 'Read emails'], [2, '13:30', '14:30', 'gym', 'Gym'], [2, '18:00', '20:00', 'fam', 'Kids'],
    [3, '09:00', '12:30', 'work', 'Prepare report'], [3, '16:00', '17:30', 'side', 'Side project'],
    [4, '09:00', '10:15', 'work', 'Review'], [4, '10:30', '12:00', 'work', 'Planning'], [4, '17:30', '20:00', 'fam', 'Family time'],
  ];
  const H0 = 8 * 60, H1 = 21 * 60;
  const mins = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };

  function weekHtml() {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<div class="si-d"><b>${d}</b><div class="si-dc">${BLOCKS.filter(b => b[0] === i).map(([, s, e, c, t]) => {
      const top = (mins(s) - H0) / (H1 - H0) * 100, h = (mins(e) - mins(s)) / (H1 - H0) * 100;
      return `<div class="si-blk si-${c}" style="top:${top}%;height:${h}%">${C.esc(t)}<small>${s}\u2013${e}</small></div>`;
    }).join('')}</div></div>`).join('');
  }

  C.screen('signin', {
    mount(root) {
      root.innerHTML = `<div class="si">
        <div class="si-left"><div class="si-panel">
          <div class="si-logo"><span class="si-mark"></span>Chrona</div>
          <h1>Your week, arranged for you</h1>
          <p class="si-sub">Tell Chrona what needs doing. It fits your tasks around meetings and replans when the day changes.</p>
          ${PROVIDERS.map(([p, ico]) => `<button type="button" class="si-btn" data-provider="${p}">${ico}Continue with ${p}</button>`).join('')}
          <div class="si-foot">Demo mode: no real account is used</div>
        </div></div>
        <div class="si-right"><div class="si-wk">${weekHtml()}</div></div>
      </div>`;
      root.firstElementChild.addEventListener('click', e => {
        const b = e.target.closest('[data-provider]'); if (!b) return;
        const s = C.store.state.session;
        s.signedIn = true; s.provider = b.dataset.provider; s.email = 'you@example.com';
        C.store.save();
        C.go(s.setupDone ? '#/calendar' : (s.step === 'categories' ? '#/setup/categories' : '#/setup/time-spaces'));
      });
    },
    unmount() {},
  });
})(window.Chrona = window.Chrona || {});
