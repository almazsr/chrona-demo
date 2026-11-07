(function (C) {
  'use strict';
  const screens = {};
  C.screen = (name, def) => { screens[name] = def; };
  const ROUTES = {
    '#/sign-in': ['signin', {}],
    '#/setup/time-spaces': ['setup', { step: 'spaces' }],
    '#/setup/categories': ['setup', { step: 'categories' }],
    '#/calendar': ['calendar', {}],
    '#/list': ['list', {}],
    '#/review': ['review', {}],
    '#/settings': ['settings', {}],
  };
  const APP_SCREENS = ['calendar', 'list', 'review', 'settings'];
  const NAV = [['#/calendar', 'Calendar'], ['#/list', 'List'], ['#/review', 'Review'], ['#/settings', 'Settings']];
  let current = null, currentHash = null;

  function target(hash) {
    const s = C.store.state.session;
    if (!s.signedIn) return '#/sign-in';
    if (!s.setupDone) return hash === '#/setup/time-spaces' || hash === '#/setup/categories' ? hash : (s.step === 'categories' ? '#/setup/categories' : '#/setup/time-spaces');
    return ROUTES[hash] && APP_SCREENS.includes(ROUTES[hash][0]) ? hash : '#/calendar';
  }

  function renderHeader(hash) {
    const hdr = C.$('#cx-hdr'), name = ROUTES[hash][0];
    if (!APP_SCREENS.includes(name)) { hdr.hidden = true; hdr.innerHTML = ''; return; }
    const n = C.solver && C.solver.reviewQueue ? C.solver.reviewQueue().length : 0, s = C.store.state.session;
    hdr.hidden = false;
    hdr.innerHTML = `<div class="logo"><span class="mark"></span>Chrona</div>
      <nav class="nav">${NAV.map(([h, l]) => `<a href="${h}" class="${h === hash ? 'on' : ''}" id="nav-${l.toLowerCase()}">${l}${h === '#/review' && n ? `<b class="nb">${n}</b>` : ''}</a>`).join('')}</nav>
      <div class="avwrap"><span class="avatar" data-avatar="1" title="Account">${C.esc((s.email || 'Y')[0].toUpperCase())}</span>
        <div class="avmenu" hidden><div class="avmail">${C.esc(s.email || 'you@example.com')}<br>Signed in with ${C.esc(s.provider || 'Google')}</div><div class="avi" data-av="reset">Reset demo</div><div class="avi dng" data-av="signout">Sign out</div></div></div>`;
  }

  function route() {
    const want = target(location.hash || '');
    if (want !== location.hash) { history.replaceState(null, '', want); }
    const [name, params] = ROUTES[want];
    C.ui.hideToast(); C.ui.closeModal();
    if (current && current.unmount) current.unmount();
    currentHash = want;
    current = screens[name] || null;
    renderHeader(want);
    const root = C.$('#cx-screen');
    root.innerHTML = ''; root.className = `scr scr-${name}`;
    if (current) current.mount(root, params); else root.innerHTML = `<div class="empty-screen">The ${C.esc(name)} screen is not built yet.</div>`;
  }

  C.go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
  C.refreshHeader = () => { if (currentHash) renderHeader(currentHash); };
  C.refresh = () => { if (!currentHash) return; renderHeader(currentHash); if (current && current.refresh) current.refresh(); };
  C.currentRoute = () => currentHash;

  C.startRouter = () => {
    C.store.on(() => C.refreshHeader());
    window.addEventListener('hashchange', route);
    C.$('#cx-hdr').addEventListener('click', async e => {
      const menu = C.$('#cx-hdr .avmenu');
      if (e.target.closest('[data-avatar]')) { menu.hidden = !menu.hidden; e.stopPropagation(); return; }
      const a = e.target.closest('[data-av]'); if (!a) return;
      menu.hidden = true;
      if (a.dataset.av === 'signout') { C.store.state.session.signedIn = false; C.store.save(); C.go('#/sign-in'); }
      else if (await C.ui.confirm({ title: 'Reset demo?', text: 'This deletes your setup, settings and all time blocks, and starts the demo from sign-in.', ok: 'Reset', danger: true })) { C.store.reset(); C.go('#/sign-in'); }
    });
    document.addEventListener('click', e => { const m = C.$('#cx-hdr .avmenu'); if (m && !m.hidden && !e.target.closest('.avwrap')) m.hidden = true; });
    route();
  };
})(window.Chrona = window.Chrona || {});
