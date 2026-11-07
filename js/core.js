(function (C) {
  'use strict';
  C.$ = (s, r = document) => r.querySelector(s);
  C.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  C.esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- wall-clock time: minutes since Monday 2024-01-01 00:00; every day has 1440 minutes ----------
  const D = C.D = 1440;
  const EPOCH = Date.UTC(2024, 0, 1);
  const p2 = C.p2 = n => String(n).padStart(2, '0');
  C.dayIndex = date => Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / 864e5);
  C.dateOf = day => { const u = new Date(EPOCH + day * 864e5); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
  C.at = (day, h, m = 0) => day * D + h * 60 + m;
  C.dayOf = t => Math.floor(t / D);
  C.dow = day => ((day % 7) + 7) % 7;
  C.WDS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  C.clock = {};
  // ?now=2026-11-03T10:30 pins the clock (handy for checking a fixed moment)
  const pinned = (() => { const m = /[?&]now=(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(location.search); return m ? { d: new Date(+m[1], +m[2] - 1, +m[3]), min: +m[4] * 60 + +m[5] } : null; })();
  C.tick = () => {
    const n = new Date(), today = pinned ? C.dayIndex(pinned.d) : C.dayIndex(n);
    C.clock.today = today;
    C.clock.now = pinned ? C.at(today, 0) + pinned.min : C.at(today, n.getHours(), n.getMinutes());
    C.clock.weekStart = today - C.dow(today);
    C.clock.weekEnd = C.clock.weekStart + 6;
  };
  C.tick();

  C.hm = m => { m = ((m % D) + D) % D; return p2(Math.floor(m / 60)) + ':' + p2(m % 60); };
  C.wd = d => C.dateOf(d).toLocaleDateString('en-GB', { weekday: 'short' });
  C.fmtDay = d => { const x = C.dateOf(d); return `${p2(x.getDate())}/${p2(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`; };
  C.fmtWhen = t => `${C.fmtDay(C.dayOf(t))} ${C.hm(t)}`;
  C.endLabel = (s, e) => e % D === 0 && e > s ? '24:00' : C.hm(e);
  C.range = (s, e) => `${C.wd(C.dayOf(s))} ${C.fmtDay(C.dayOf(s))}, ${C.hm(s)}\u2013${C.endLabel(s, e)}`;
  C.toLocal = t => { const x = C.dateOf(C.dayOf(t)); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}T${C.hm(t)}`; };
  C.fromLocal = s => { const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(s || ''); return m ? C.at(C.dayIndex(new Date(+m[1], +m[2] - 1, +m[3])), +m[4], +m[5]) : null; };
  C.fmtDur = m => ((m >= 60 ? Math.floor(m / 60) + 'h' : '') + (m % 60 ? ' ' + (m % 60) + 'm' : '')).trim() || '0m';
  C.parseDur = s => {
    s = String(s || '').trim().toLowerCase(); if (!s) return null; let m;
    if ((m = /^(\d+):(\d{2})$/.exec(s))) return +m[1] * 60 + +m[2];
    if ((m = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*m)?$/.exec(s))) return Math.round(+m[1] * 60) + (m[2] ? +m[2] : 0);
    if ((m = /^(\d+)\s*m(?:in)?$/.exec(s))) return +m[1];
    return NaN;
  };

  // ---------- icons ----------
  const svg = C.svg = (p, w = 14) => `<svg width="${w}" height="${w}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const LOCKP = '<path fill="currentColor" d="M2.5 4.5V3a2.5 2.5 0 0 1 5 0v1.5H8a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h.5zm1.2 0h2.6V3a1.3 1.3 0 0 0-2.6 0v1.5z"/>';
  const REP = '<path d="M12.5 5.5A5 5 0 0 0 3.2 6.8M3.5 10.5a5 5 0 0 0 9.3-1.3"/><path d="M12.8 2.6v3h-3M3.2 13.4v-3h3"/>';
  C.icons = {
    clock: svg('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/>'),
    swap: svg('<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>'),
    lock: `<svg width="13" height="13" viewBox="0 0 10 11">${LOCKP}</svg>`,
    lockCard: `<svg class="lk" width="10" height="11" viewBox="0 0 10 11" aria-label="Fixed">${LOCKP}</svg>`,
    repeat: svg(REP),
    repeatCard: `<svg class="rp" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Repeats">${REP}</svg>`,
    flag: svg('<path d="M3.5 14V2.5M3.5 3h8l-1.6 3 1.6 3h-8"/>'),
    deadline: svg('<path d="M4 2h8M4 14h8M5 2c0 3.3 6 3.7 6 6s-6 2.7-6 6M11 2c0 3.3-6 3.7-6 6"/>'),
    net: svg('<path d="M2.5 2.5v11M5.5 8h8M10.5 5l3 3-3 3"/>'),
    cal: svg('<rect x="2.3" y="3.2" width="11.4" height="10.3" rx="1.6"/><path d="M2.3 6.5h11.4M5.5 2v2.4M10.5 2v2.4"/>'),
    close: svg('<path d="M4 4l8 8M12 4l-8 8"/>', 16),
    check: svg('<path d="M3 8.5l3.2 3L13 4.5"/>'),
    undo: svg('<path d="M5 3L2.5 5.5 5 8M2.5 5.5H10a3.5 3.5 0 0 1 0 7H6"/>'),
    half: svg('<circle cx="8" cy="8" r="6"/><path d="M8 2v12A6 6 0 0 0 8 2z" fill="currentColor"/>'),
    later: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8h3"/><path d="M12.8 2.8l1.2 2.4-2.6.4"/>'),
    edit: svg('<path d="M10.5 2.5l3 3L6 13H3v-3z"/>'),
    resize: svg('<path d="M8 2v12M5 4.5L8 2l3 2.5M5 11.5L8 14l3-2.5"/>'),
    move: svg('<path d="M8 2v12M2 8h12M8 2L6.3 3.7M8 2l1.7 1.7M8 14l-1.7-1.7M8 14l1.7-1.7M2 8l1.7-1.7M2 8l1.7 1.7M14 8l-1.7-1.7M14 8l-1.7 1.7"/>'),
    trash: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9"/>'),
    more: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>',
    send: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.6 7.2 13.9 1.9c.5-.2 1 .3.8.8L9.4 15c-.2.5-.9.5-1.1 0L6.6 9.9 1.6 8.3c-.5-.2-.5-.9 0-1.1zm5.6 2.3 1.2 3.6 4.3-10-10 4.3 3.6 1.2 3.5-3.5.8.8-3.4 3.6z"/></svg>',
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.2 5.2 1.9-5.2 1.9L12 16.7l-1.9-5.2L4.9 9.6l5.2-1.9z"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" opacity=".75"/><path d="M5.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" opacity=".6"/></svg>',
  };

  // ---------- priorities ----------
  C.PRN = { asap: 1, next: 2, normal: 5, low: 10 };
  C.DEF_PR = 5;
  C.prName = n => Object.keys(C.PRN).find(k => C.PRN[k] === n) || null;
  C.prLabel = n => C.prName(n) || String(n);
  C.parsePr = s => { s = String(s ?? '').trim().toLowerCase(); if (C.PRN[s]) return C.PRN[s]; if (/^\d+$/.test(s) && +s >= 1) return +s; return null; };

  // ---------- humanized dates (glossary: Humanized date) ----------
  const phrases = () => {
    const { today, weekEnd } = C.clock;
    return [
      { re: /^(eotmr|end of tomorrow)\b/, t: at(today + 1, 23, 59), day: today + 1 },
      { re: /^(tomorrow|tmr)\b/, t: at(today + 1, 0), day: today + 1 },
      { re: /^(end of day|eod)\b/, t: at(today, 23, 59), day: today },
      { re: /^(today)\b/, t: at(today, 0), day: today },
      { re: /^(end of week|eow)\b/, t: at(weekEnd, 23, 59), day: weekEnd },
      { re: /^(next week)\b/, t: at(weekEnd + 1, 0), day: weekEnd + 1 },
    ];
  };
  const at = C.at;
  const parseClock = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  C.parseWhen = (text, kind) => {
    const s = String(text || '').trim().toLowerCase(); if (!s) return null; let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})$/.exec(s))) return C.fromLocal(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`);
    if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?:\s+(\d{1,2}:\d{2}))?$/.exec(s))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : C.dateOf(C.clock.today).getFullYear();
      const dt = new Date(y, +m[2] - 1, +m[1]);
      if (dt.getMonth() !== +m[2] - 1) return NaN;
      const c = m[4] ? parseClock(m[4]) : (kind === 'dl' ? 23 * 60 + 59 : 0); if (c == null) return NaN;
      return at(C.dayIndex(dt), 0) + c;
    }
    for (const ph of phrases()) { const mm = ph.re.exec(s); if (mm) { const rest = s.slice(mm[0].length).trim(); if (!rest) return ph.t; const c = parseClock(rest); return c == null ? NaN : at(ph.day, 0) + c; } }
    const c = parseClock(s); if (c != null) return at(C.clock.today, 0) + c;
    return NaN;
  };
  C.isHuman = t => /[a-z]/i.test(t || '');
  C.whenLabel = (text, kind) => { const t = C.parseWhen(text, kind); if (t == null || Number.isNaN(t)) return text; return C.isHuman(text) ? text.trim().toLowerCase() : C.fmtWhen(t); };
  // reverse: show "next week", "tmr", "eow"... when a date matches one exactly
  C.humanWhen = t => {
    if (t == null) return '';
    const { today, weekEnd } = C.clock;
    const hit = [['today', at(today, 0)], ['eod', at(today, 23, 59)], ['tmr', at(today + 1, 0)], ['eotmr', at(today + 1, 23, 59)], ['eow', at(weekEnd, 23, 59)], ['next week', at(weekEnd + 1, 0)]].find(([, v]) => v === t);
    if (hit) return hit[0];
    const d = C.dayOf(t);
    return d === today ? `today ${C.hm(t)}` : d === today + 1 ? `tmr ${C.hm(t)}` : d === weekEnd + 1 ? `next week ${C.hm(t)}` : C.fmtWhen(t);
  };
  C.placeText = t => { const d = C.dayOf(t); return d === C.clock.today ? `today ${C.hm(t)}` : d === C.clock.today + 1 ? `tmr ${C.hm(t)}` : `${C.wd(d)} ${C.fmtWhen(t)}`; };

  // ---------- intervals ----------
  C.norm = list => { const v = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]); const out = []; for (const iv of v) { const l = out[out.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else out.push([iv[0], iv[1]]); } return out; };
  C.clip = (list, a, b) => list.map(([s, e]) => [Math.max(s, a), Math.min(e, b)]).filter(([s, e]) => e > s);
  C.subtract = (list, occ) => { let res = list.map(x => [...x]); for (const [os, oe] of occ) { const nx = []; for (const [s, e] of res) { if (oe <= s || os >= e) { nx.push([s, e]); continue; } if (os > s) nx.push([s, os]); if (oe < e) nx.push([oe, e]); } res = nx; } return res; };
})(window.Chrona = window.Chrona || {});
