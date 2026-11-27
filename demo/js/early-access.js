/* Early access form (features/early-access.feature, ALM-99). Shared by the landing page and the demo.
   - ChronaEarlyAccess.open(via): show the form; any element with [data-early-access] opens it too.
   - In the demo it offers itself once, after setup, when the visitor has done 3 useful actions and
     at least one replan, or after 3 minutes of active use; never while a form, menu or drag is open.
   - Closing it collapses it into a "Get early access" button in the bottom right corner.
   - The browser keeps only markers (shown, collapsed, sent, counters), never the name or email.
   Needs js/leads.js (window.ChronaLeads) and css/early-access.css. */
(function () {
  'use strict';

  var KEY = 'chrona.earlyAccess';
  var OLD_KEY = 'chrona.landing.contact'; // the earlier pre-demo form on the landing page
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NEED_ACTIONS = 3, NEED_REPLANS = 1, ACTIVE_MS = 3 * 60 * 1000, DELAY_MS = 6000;
  var SPARK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.2 5.2 1.9-5.2 1.9L12 16.7l-1.9-5.2L4.9 9.6l5.2-1.9z"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" opacity=".7"/></svg>';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var listeners = [];

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
    try { if (!s.sent && localStorage.getItem(OLD_KEY)) s.sent = true; } catch (e) { /* storage blocked */ }
    return s;
  }
  var st = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked: keep in memory */ } }

  var root, card, form, done, pill, corner = false;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'ea';
    root.innerHTML =
      '<div class="ea-card" role="dialog" aria-modal="false" aria-labelledby="ea-title" hidden>'
      + '<button type="button" class="ea-x" data-ea-close aria-label="Close">&times;</button>'
      + '<form class="ea-form" novalidate>'
      + '<h2 id="ea-title">Get early access</h2>'
      + '<p class="ea-sub">Chrona is in early preview. Leave your email and we’ll invite you when the working version is ready. No newsletter.</p>'
      + '<label class="ea-field"><span>Name</span><input name="name" type="text" autocomplete="name" maxlength="100"><em class="ea-err" data-err="name" id="ea-err-name" hidden>Enter your name.</em></label>'
      + '<label class="ea-field"><span>Email</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="200"><em class="ea-err" data-err="email" id="ea-err-email" hidden>Enter an email like name@company.com.</em></label>'
      + '<button type="submit" class="ea-btn">Get early access</button>'
      + '<p class="ea-note">We use your email only to invite you to Chrona.</p>'
      + '</form>'
      + '<div class="ea-done" hidden><h2>You’re on the list</h2><p>We’ll email you when early access opens.</p></div>'
      + '</div>'
      + '<button type="button" class="ea-pill" data-ea-pill hidden>' + SPARK + '<span>Get early access</span></button>';
    document.body.appendChild(root);
    card = root.querySelector('.ea-card');
    form = root.querySelector('.ea-form');
    done = root.querySelector('.ea-done');
    pill = root.querySelector('.ea-pill');

    root.querySelector('[data-ea-close]').addEventListener('click', close);
    pill.addEventListener('click', function () { open('corner'); });
    card.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') showError(e.target.name, false); });
    form.addEventListener('submit', submit);
  }

  function showError(name, on) {
    var input = form.elements[name];
    form.querySelector('[data-err="' + name + '"]').hidden = !on;
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    if (on) input.setAttribute('aria-describedby', 'ea-err-' + name); else input.removeAttribute('aria-describedby');
  }

  function open(via, options) {
    if (st.sent) return;
    build();
    card.dataset.via = via || 'link';
    form.hidden = false; done.hidden = true;
    card.hidden = false;
    card.classList.remove('is-in'); void card.offsetWidth; card.classList.add('is-in');
    pill.hidden = true;
    // shown by itself: don't pull up the phone keyboard
    if (!(options && options.auto)) form.elements.name.focus();
  }

  function close() {
    if (!card || card.hidden) return;
    card.hidden = true;
    if (st.sent) return;
    st.collapsed = true; save();
    if (corner) showPill(true);
  }

  function showPill(glow) {
    if (st.sent || !corner) return;
    build();
    pill.hidden = false;
    pill.classList.remove('is-glow');
    if (glow && !reduced.matches) { void pill.offsetWidth; pill.classList.add('is-glow'); }
  }

  function submit(e) {
    e.preventDefault();
    var name = form.elements.name.value.trim(), email = form.elements.email.value.trim();
    var nameOk = !!name, emailOk = EMAIL.test(email);
    showError('name', !nameOk); showError('email', !emailOk);
    if (!nameOk) { form.elements.name.focus(); return; }
    if (!emailOk) { form.elements.email.focus(); return; }
    var btn = form.querySelector('.ea-btn');
    btn.disabled = true;
    var send = window.ChronaLeads ? window.ChronaLeads.submit({ name: name, email: email, via: card.dataset.via }) : Promise.resolve(false);
    send.then(function () {
      st.sent = true; st.sentAt = new Date().toISOString(); save();
      form.hidden = true; done.hidden = false;
      pill.hidden = true;
      listeners.forEach(function (fn) { try { fn(); } catch (err) { /* ignore */ } });
      setTimeout(function () { card.hidden = true; }, 3500);
    });
  }

  // links and buttons anywhere on the page
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-early-access]');
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-early-access') || 'link');
  });

  // once the email is left, the links and menu entries that open the form go away
  function removeEntries() {
    [].forEach.call(document.querySelectorAll('[data-early-access], [data-av="early"]'), function (el) { el.remove(); });
  }
  listeners.push(removeEntries);
  if (st.sent) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeEntries); else removeEntries();
  }

  window.ChronaEarlyAccess = {
    open: open,
    sent: function () { return !!st.sent; },
    onSent: function (fn) { listeners.push(fn); },
    // the demo shows the corner button once the form has been offered
    corner: function () { corner = true; if ((st.collapsed || st.autoShown) && !st.sent) showPill(false); },
  };

  // ---------- demo: offer the form after useful work ----------
  var C = window.Chrona;
  if (!C || !C.store) return;

  var lastInput = 0, lastAction = 0, pending = null, baseline = null;
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { lastInput = Date.now(); }, true); });
  var byUser = function () { return Date.now() - lastInput < 2000; };

  function eligible() {
    var s = C.store.state.session, r = (C.currentRoute && C.currentRoute()) || location.hash;
    return s.signedIn && s.setupDone && !/^#\/(setup|sign-in)/.test(r) && !st.sent && !st.autoShown;
  }
  // what a useful action changes: time blocks, series, categories, time spaces and settings
  function signature() {
    var S = C.store.state, set = JSON.parse(JSON.stringify(S.settings || {}));
    if (set.review) set.review.lastReminder = null;
    return JSON.stringify([S.tasks, S.fixed, S.locked, S.series, S.cats, S.spaces, set]);
  }
  C.store.on(function () {
    var now = signature();
    if (baseline === null || !eligible()) { baseline = now; return; }
    if (now === baseline) return;
    baseline = now;
    if (!byUser() || Date.now() - lastAction < 800) return; // one action may save several times
    lastAction = Date.now();
    st.actions = (st.actions || 0) + 1; save();
    check();
  });
  if (C.solver && C.solver.replan) {
    var replan = C.solver.replan;
    C.solver.replan = function () {
      var r = replan.apply(this, arguments);
      if (eligible() && byUser()) { st.replans = (st.replans || 0) + 1; save(); check(); }
      return r;
    };
  }
  // fallback: 3 minutes of active use (the tab is visible and the visitor did something in the last 30 s)
  setInterval(function () {
    if (!eligible() || document.visibilityState !== 'visible' || Date.now() - lastInput > 30000) return;
    st.activeMs = (st.activeMs || 0) + 5000; save();
    if (st.activeMs >= ACTIVE_MS) schedule();
  }, 5000);

  function check() { if ((st.actions || 0) >= NEED_ACTIONS && (st.replans || 0) >= NEED_REPLANS) schedule(); }
  function schedule() { if (!pending) pending = setTimeout(tryShow, DELAY_MS); }

  function visible(sel) { return [].some.call(document.querySelectorAll(sel), function (el) { return !el.hidden && el.offsetParent !== null; }); }
  function busy() {
    // quick add keeps its focus after Enter, so a focused field alone doesn't count; typing does
    return visible('.cx .pop, .cx .cmenu, .cx .overlay, .cx .tbf, .cx .dragging, .cx .avmenu, .cx .fpop')
      || Date.now() - lastInput < 1500;
  }
  function tryShow() {
    pending = null;
    if (!eligible()) return;
    if (busy()) { pending = setTimeout(tryShow, 2000); return; }
    st.autoShown = true; save();
    open('auto', { auto: true });
  }

  function start() { window.ChronaEarlyAccess.corner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
