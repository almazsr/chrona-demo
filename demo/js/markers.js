(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, parseWhen, isHuman, whenLabel, humanWhen, placeText, norm, clip, subtract, WDS } = C;
  const IC = C.icons, S = C.store.state;
  const findCat = n => { const c = C.store.catByName(n); return c ? c.id : null; };
  function parseRepWord(w) {
    w = w.toLowerCase();
    if (w === 'daily') return { freq: 'daily' };
    if (w === 'weekdays') return { freq: 'weekdays' };
    if (w === 'weekly') return { freq: 'weekly', days: null };
    if (w === 'monthly') return { freq: 'monthly' };
    if (w === 'yearly') return { freq: 'yearly' };
    const parts = w.split(','), days = parts.map(p => WDS.findIndex(x => x.toLowerCase() === p.slice(0, 3)));
    if (parts.every(p => p.length >= 2) && days.every(x => x >= 0)) return { freq: 'custom', days: [...new Set(days)].sort(), every: 1 };
    return null;
  }
  // ---------- title markers ----------
  const SPECIAL = '@#()[]!*\\';
  function findClose(text, i, ch) { for (; i < text.length; i++) { if (text[i] === '\\' && SPECIAL.includes(text[i + 1] || '')) { i++; continue; } if (text[i] === ch) return i; } return -1; }
  function readWhen(text, i, kind, needTime) {
    const rest = text.slice(i), words = []; const re = /\S+/g; let m;
    while ((m = re.exec(rest)) && words.length < 4) { if (!words.length && m.index !== 0) return null; if (/^[\[\]!@#(]/.test(m[0]) && words.length) break; words.push(m.index + m[0].length); }
    for (let k = words.length; k >= 1; k--) {
      const val = rest.slice(0, words[k - 1]), t = parseWhen(val, kind);
      if (t != null && !Number.isNaN(t) && (!needTime || /\d{1,2}:\d{2}$/.test(val))) return { len: words[k - 1], val, t };
    }
    return null;
  }
  function parseMarkers(text) {
    const toks = [], fields = {}; let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\' && text[i + 1] && SPECIAL.includes(text[i + 1])) { toks.push({ s: i, e: i + 2, t: 'esc' }); i += 2; continue; }
      if (c === '(') { const j = findClose(text, i + 1, ')'); if (j > 0) { const inner = text.slice(i + 1, j), d = parseDur(inner), ok = d != null && !Number.isNaN(d) && d > 0; toks.push({ s: i, e: j + 1, t: ok ? 'dur' : 'bad', why: ok ? '' : 'Unrecognized duration' }); if (ok) fields.dur = { v: fmtDur(d), sig: inner }; i = j + 1; continue; } }
      if (c === '@' && (i === 0 || /\s/.test(text[i - 1]))) { const m = /^@([A-Za-z0-9_-]+)/.exec(text.slice(i)); if (m) { const cat = findCat(m[1]); toks.push({ s: i, e: i + m[0].length, t: cat ? 'cat' : 'bad', cat, why: cat ? '' : `No category "${m[1]}"` }); if (cat) fields.cat = { v: cat, sig: m[1] }; i += m[0].length; continue; } }
      if (text.startsWith('#p:', i)) { const m = /^#p:(\w*)/.exec(text.slice(i)), p = parsePr(m[1]); toks.push({ s: i, e: i + m[0].length, t: p ? 'pr' : 'bad', why: p ? '' : 'Use asap, next, normal, low or a number' }); if (p) fields.pr = { v: p, sig: m[1] }; i += m[0].length; continue; }
      if (c === '*' && (i === 0 || /\s/.test(text[i - 1])) && text[i + 1] && !/\s/.test(text[i + 1])) { const w = /^\*(\S+)/.exec(text.slice(i))[1], r = parseRepWord(w); toks.push({ s: i, e: i + 1 + w.length, t: r ? 'rep' : 'bad', why: r ? '' : 'Use daily, weekdays, weekly, monthly, yearly or days like mon,wed,fri' }); if (r) fields.rep = { v: r, sig: w }; i += 1 + w.length; continue; }
      if ((c === '[' || c === ']' || c === '!') && (i === 0 || /\s/.test(text[i - 1])) && text[i + 1] && !/\s/.test(text[i + 1])) {
        const kind = c === '[' ? 'net' : c === ']' ? 'dl' : 'start', r = readWhen(text, i + 1, kind === 'start' ? 'net' : kind, kind === 'start');
        if (r) {
          toks.push({ s: i, e: i + 1 + r.len, t: kind === 'start' ? 'fix' : 'time', kind });
          if (kind === 'start') { fields.flex = { v: 'fixed', sig: r.val }; fields.start = { v: toLocal(r.t), sig: r.val }; } else fields[kind] = { v: r.val, sig: r.val };
          i += 1 + r.len; continue;
        }
        const w = /^\S+/.exec(text.slice(i + 1))[0];
        if (/^(\d|to|tm|eo|en)/i.test(w)) { toks.push({ s: i, e: i + 1 + w.length, t: 'bad', kind, why: kind === 'start' ? 'Use a date, a space and a time, e.g. !tmr 15:00' : 'Couldn\u2019t read this date' }); i += 1 + w.length; continue; }
      }
      i++;
    }
    // repeating needs a fixed start: from "!" or a fixed category, or Fixed chosen in the form
    if (fields.rep) { const nf = !fields.start && !(fields.cat && C.catOf(fields.cat.v).fixed); fields.rep.needFix = nf; for (const tk of toks) if (tk.t === 'rep') tk.needFix = nf; }
    if (fields.start) for (const tk of toks) if (tk.kind === 'net' || tk.kind === 'dl') { if (tk.t === 'time') { tk.t = 'bad'; tk.why = 'Fixed time blocks have no Deadline or Not earlier than'; } delete fields.net; delete fields.dl; }
    if (fields.net && fields.dl && parseWhen(fields.dl.v, 'dl') <= parseWhen(fields.net.v, 'net')) { const tk = toks.find(t => t.kind === 'dl'); tk.t = 'bad'; tk.why = 'Deadline must be later than Not earlier than'; delete fields.dl; }
    return { toks, fields };
  }
  function highlight(text, toks) {
    let h = '', i = 0;
    for (const tk of toks) {
      h += esc(text.slice(i, tk.s)); const seg = text.slice(tk.s, tk.e);
      if (tk.t === 'esc') h += `<span class="m-esc">\\</span>${esc(seg.slice(1))}`;
      else if (tk.t === 'cat') h += `<span class="m-cat" style="background:${C.catOf(tk.cat).color}88">${esc(seg)}</span>`;
      else h += `<span class="m-${tk.t}">${esc(seg)}</span>`;
      i = tk.e;
    }
    return h + esc(text.slice(i));
  }
  function cleanTitle(text, toks) { let out = '', i = 0; for (const tk of toks) { out += text.slice(i, tk.s) + (tk.t === 'esc' ? text[tk.s + 1] : ''); i = tk.e; } return (out + text.slice(i)).replace(/\s+/g, ' ').trim(); }
  const REP_NEED_FIX = 'Only fixed time blocks repeat. Add a start, e.g. !tmr 09:00';
  const checkRepToks = (toks, fixedNow) => { for (const tk of toks) if (tk.t === 'rep' && tk.needFix && !fixedNow) { tk.t = 'bad'; tk.why = REP_NEED_FIX; } return toks; };
  function attachHighlight(wrap, parse, isFixedNow) {
    const inp = wrap.querySelector('.hl-in'), mir = wrap.querySelector('.hl-mirror > div');
    const sync = () => { mir.innerHTML = parse ? highlight(inp.value, checkRepToks(parseMarkers(inp.value).toks, isFixedNow ? isFixedNow() : false)) : esc(inp.value); mir.style.transform = `translateX(${-inp.scrollLeft}px)`; };
    ['input', 'scroll', 'keyup', 'click'].forEach(ev => inp.addEventListener(ev, sync)); sync();
    return sync;
  }
  C.markers = { parse: parseMarkers, highlight, clean: cleanTitle, attach: attachHighlight, checkRep: checkRepToks, parseRepWord, REP_NEED_FIX };
})(window.Chrona = window.Chrona || {});
