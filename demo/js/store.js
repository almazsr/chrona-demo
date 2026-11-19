(function (C) {
  'use strict';
  const KEY = 'chrona-demo', VERSION = 1;
  const listeners = [];

  function defaults() {
    let tz = 'UTC';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* keep UTC */ }
    return {
      v: VERSION,
      seq: 100,
      session: { signedIn: false, setupDone: false, step: 'spaces', chat: [], draft: null },
      settings: { planAhead: '2w', split: true, tz, review: { period: 'month', remind: true, freq: 'day', lastReminder: null } },
      spaces: [],
      cats: [],
      tasks: [],
      fixed: [],
      locked: [],
      placement: {},
      series: [],
    };
  }

  // load and reset refill the same state object, so modules may keep a reference to C.store.state
  const refill = obj => { const st = store.state; Object.keys(st).forEach(k => delete st[k]); Object.assign(st, obj); return st; };
  const store = C.store = {
    state: defaults(),
    load() {
      let data = null;
      try { const raw = localStorage.getItem(KEY); data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      return refill(data && data.v === VERSION ? Object.assign(defaults(), data) : defaults());
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(store.state)); } catch (e) { /* storage full or blocked: keep working in memory */ }
      listeners.forEach(fn => { try { fn(store.state); } catch (e) { console.error(e); } });
    },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } refill(defaults()); store.save(); },
    on(fn) { listeners.push(fn); },
    id(prefix) { store.state.seq = (store.state.seq || 100) + 1; return `${prefix}${store.state.seq}`; },
    cat(id) { return store.state.cats.find(c => c.id === id) || null; },
    catByName(name) { const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return store.state.cats.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n) || null; },
    defaultCat() { return store.state.cats.find(c => c.def) || store.state.cats[0] || null; },
    space(id) { return store.state.spaces.find(s => s.id === id) || null; },
  };
  // a time block may outlive its category (removed in settings); show it in neutral grey instead of failing
  C.catOf = id => store.cat(id) || { id, name: 'No category', color: '#d9e0ea', fixed: false, spaces: [] };
})(window.Chrona = window.Chrona || {});
