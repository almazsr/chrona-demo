(function (C) {
  'use strict';
  const { at, dayOf, dateOf, dow, fmtDay, p2, WDS } = C;
  const S = C.store.state;
  // occurrences are expanded within this window around today (calendar navigation and review never need more)
  const PAST_DAYS = 70, FUTURE_DAYS = 180;

  function occursOn(sr, d) {
    const r = sr.rule;
    if (d < sr.from) return false;
    if (r.freq === 'daily') return true;
    if (r.freq === 'weekdays') return dow(d) < 5;
    if (r.freq === 'weekly') return (r.days || [dow(sr.from)]).includes(dow(d));
    if (r.freq === 'custom') return r.days.includes(dow(d)) && Math.floor((d - sr.from + dow(sr.from)) / 7) % (r.every || 1) === 0;
    if (r.freq === 'monthly') return dateOf(d).getDate() === dateOf(sr.from).getDate();
    if (r.freq === 'yearly') return dateOf(d).getDate() === dateOf(sr.from).getDate() && dateOf(d).getMonth() === dateOf(sr.from).getMonth();
    return false;
  }
  function occDays(sr, lo = -Infinity, hi = C.clock.today + FUTURE_DAYS) {
    const out = []; let n = 0;
    for (let d = sr.from; d <= hi; d++) {
      if (!occursOn(sr, d)) continue;
      n++;
      if (sr.ends.type === 'count' && n > sr.ends.n) break;
      if (sr.ends.type === 'date' && d > sr.ends.day) break;
      if (d >= lo) out.push(d);
    }
    return out;
  }
  const dayNames = days => days.map(x => WDS[x]).join(', ');
  function ruleText(r, from) {
    const fd = dateOf(from);
    return r.freq === 'daily' ? 'Every day' : r.freq === 'weekdays' ? 'Every weekday' : r.freq === 'weekly' ? `Every week on ${dayNames(r.days || [dow(from)])}`
      : r.freq === 'custom' ? `Every ${(r.every || 1) > 1 ? r.every + ' weeks' : 'week'} on ${dayNames(r.days)}`
      : r.freq === 'monthly' ? `Every month on day ${fd.getDate()}` : `Every year on ${p2(fd.getDate())}/${p2(fd.getMonth() + 1)}`;
  }
  const endsText = en => en.type === 'never' ? 'never ends' : en.type === 'count' ? `${en.n} times` : `until ${fmtDay(en.day)}`;
  const exOf = (sr, d) => (sr.ex[d] = sr.ex[d] || {});
  const find = id => S.series.find(x => x.id === id);
  // one stable object per occurrence, so screens can compare references across renders
  const refs = new Map();
  const occRef = (sid, day) => { const k = `${sid}@${day}`; if (!refs.has(k)) refs.set(k, { occ: true, sid, day }); return refs.get(k); };

  // every occurrence is a fixed time block; exceptions may change its time, title, category, priority, done
  function blocks() {
    const out = [], lo = C.clock.today - PAST_DAYS;
    for (const sr of S.series) for (const d of occDays(sr, lo)) {
      const x = sr.ex[d] || {}; if (x.deleted) continue;
      const s = x.s ?? at(d, 0) + sr.start, dur = x.dur ?? sr.dur;
      out.push({ id: `${sr.id}@${d}`, ref: occRef(sr.id, d), sid: sr.id, day: d, title: x.title ?? sr.title, cat: x.cat ?? sr.cat, pr: x.pr ?? sr.pr, done: !!x.done, s, e: x.e ?? s + dur });
    }
    return out;
  }

  const SCOPES = [['this', 'This time block'], ['following', 'This and following time blocks']];
  const scopeWord = sc => sc === 'this' ? 'this time block' : 'this and following time blocks';
  function split(sr, d) {
    const ns = { ...sr, id: C.store.id('r'), rule: { ...sr.rule, days: sr.rule.days ? [...sr.rule.days] : sr.rule.days }, ends: { ...sr.ends }, from: d, ex: {} };
    if (sr.ends.type === 'count') ns.ends = { type: 'count', n: Math.max(1, sr.ends.n - occDays({ ...sr, ends: { type: 'date', day: d - 1 } }).length) };
    for (const k of Object.keys(sr.ex)) if (+k >= d) { ns.ex[k] = sr.ex[k]; delete sr.ex[k]; }
    sr.ends = { type: 'date', day: d - 1 };
    S.series.splice(S.series.indexOf(sr) + 1, 0, ns);
    if (!occDays(sr).length) S.series = S.series.filter(x => x !== sr);
    return ns;
  }
  function shiftDays(sr, dd) {
    if (!dd) return;
    if (sr.rule.freq === 'weekly' || sr.rule.freq === 'custom') sr.rule.days = [...new Set((sr.rule.days || [dow(sr.from)]).map(x => dow(x + dd)))].sort();
    else if (sr.rule.freq === 'monthly' || sr.rule.freq === 'yearly') sr.from += dd;
  }
  // ch: { s, e, dur, title, cat, pr, rule, ends } — "this" keeps an exception; "following" starts a new series that day
  function change(it, sc, ch) {
    const r = it.ref, sr = find(r.sid);
    if (sc === 'this') {
      const x = exOf(sr, r.day);
      if (ch.s != null) { x.s = ch.s; x.e = ch.e; }
      else if (ch.dur != null) { x.s = it.s; x.e = it.s + ch.dur; }
      for (const f of ['title', 'cat', 'pr']) if (ch[f] != null) x[f] = ch[f];
      return;
    }
    const tgt = split(sr, r.day);
    if (ch.s != null) { tgt.start = ch.s - at(dayOf(ch.s), 0); shiftDays(tgt, dayOf(ch.s) - r.day); if (ch.e != null) tgt.dur = ch.e - ch.s; }
    if (ch.dur != null) tgt.dur = ch.dur;
    for (const f of ['title', 'cat', 'pr']) if (ch[f] != null) tgt[f] = ch[f];
    if (ch.rule) { tgt.rule = ch.rule; tgt.ends = ch.ends; }
    for (const k of Object.keys(tgt.ex)) { const x = tgt.ex[k]; for (const f of ['title', 'cat', 'pr', 'dur']) if (ch[f] != null) delete x[f]; if (ch.s != null && !x.done) { delete x.s; delete x.e; } }
  }
  // stop the series before day d (scope "this and following" for delete or removing Repeat)
  function stopFrom(sr, d) { sr.ends = { type: 'date', day: d - 1 }; if (!occDays(sr).length) S.series = S.series.filter(x => x !== sr); }
  const ruleOf = (rp, fromDay) => ({ freq: rp.freq, days: rp.freq === 'weekly' ? (rp.days || [dow(fromDay)]) : rp.freq === 'custom' ? [...rp.days] : null, every: rp.every || 1 });
  function create(data) {
    const fromDay = dayOf(data.start);
    const sr = { id: C.store.id('r'), title: data.title, cat: data.cat, start: data.start - at(fromDay, 0), dur: data.dur, pr: data.pr, rule: ruleOf(data.rep, fromDay), from: fromDay, ends: data.rep.ends || { type: 'never' }, ex: {} };
    S.series.push(sr);
    return sr;
  }

  C.series = { occursOn, occDays, ruleText, endsText, dayNames, exOf, find, occRef, blocks, SCOPES, scopeWord, split, shiftDays, change, stopFrom, ruleOf, create };
})(window.Chrona = window.Chrona || {});
