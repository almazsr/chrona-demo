(function (C) {
  'use strict';
  const { at, dayOf, dateOf, dow, fmtWhen, fmtDur, norm, clip, subtract } = C;
  const S = C.store.state, MIN_PIECE = 30;
  const isTbd = it => typeof C.isTbd === 'function' && C.isTbd(it);

  // end of the plan-ahead period (glossary: Plan-ahead period)
  function horizon() {
    const { today, weekEnd } = C.clock, p = S.settings.planAhead;
    return p === 'week' ? at(weekEnd + 1, 0) : p === 'nextweek' ? at(weekEnd + 8, 0) : p === 'month' ? at(today + 31, 0) : at(weekEnd + 15, 0);
  }
  // free-standing time of a category between a and b, from its linked time spaces
  function spaceOf(catId, a, b) {
    const cat = C.store.cat(catId); if (!cat || !(b > a)) return [];
    const out = [];
    for (let d = dayOf(a); d <= dayOf(b - 1); d++) for (const sid of cat.spaces) {
      const sp = C.store.space(sid); if (!sp) continue;
      for (const [w, s, e] of sp.ranges) if (w === dow(d)) out.push([at(d, 0) + s, at(d, 0) + e]);
    }
    return clip(norm(out), a, b);
  }
  const contiguous = (ivs, d) => { for (const [s, e] of ivs) if (e - s >= d) return [[s, s + d]]; return null; };
  const fill = (ivs, d) => { const pieces = []; let rem = d; for (const [s, e] of ivs) { const len = e - s; if (len < MIN_PIECE) continue; let take = Math.min(len, rem); if (rem - take > 0 && rem - take < MIN_PIECE) take = rem - MIN_PIECE; if (take < MIN_PIECE) continue; pieces.push([s, s + take]); rem -= take; if (!rem) break; } return { pieces, rem }; };

  // one list of everything the screens show
  function items() {
    const out = [];
    for (const b of S.fixed) out.push({ key: b.id, ref: b, kind: 'fixed', s: b.s, e: b.e, title: b.title, cat: b.cat, done: !!b.done, part: null, unmet: null, pr: b.pr ?? C.DEF_PR, dl: null, net: null });
    for (const b of S.locked) out.push({ key: b.id, ref: b, kind: 'flex', s: b.s, e: b.e, title: b.title, cat: b.cat, done: !!b.done, part: b.part || null, unmet: b.unmet || null, pr: b.pr ?? C.DEF_PR, dl: b.dl ?? null, net: b.net ?? null });
    for (const t of S.tasks) { const p = S.placement[t.id]; if (!p) continue; p.pieces.forEach(([s, e], j) => out.push({ key: p.keys[j], ref: t, kind: 'flex', s, e, title: t.title, cat: t.cat, done: false, part: p.labels ? p.labels[j] : null, unmet: p.unmet, pr: t.pr, dl: t.dl, net: t.net })); }
    for (const b of C.series.blocks()) out.push({ key: b.id, ref: b.ref, kind: 'fixed', s: b.s, e: b.e, title: b.title, cat: b.cat, done: b.done, part: null, unmet: null, occ: { sid: b.sid, day: b.day }, pr: b.pr ?? C.DEF_PR, dl: null, net: null });
    return out;
  }

  // Design doc "Freezing started work": a started piece stays where it was planned
  function freeze() {
    const now = C.clock.now; let n = 0;
    for (const t of [...S.tasks]) {
      const p = S.placement[t.id]; if (!p) continue;
      for (let j = p.pieces.length - 1; j >= 0; j--) {
        const [s, e] = p.pieces[j]; if (s > now) continue;
        S.locked.push({ id: p.keys[j], title: t.title, cat: t.cat, s, e, done: false, part: p.labels ? p.labels[j] : null, pr: t.pr, dl: t.dl, net: t.net, unmet: p.unmet && p.unmet.length ? [...p.unmet] : null });
        p.pieces.splice(j, 1); p.keys.splice(j, 1); if (p.labels) p.labels.splice(j, 1);
        t.dur -= e - s; n++;
      }
      if (t.dur <= 0) { S.tasks = S.tasks.filter(x => x !== t); delete S.placement[t.id]; }
    }
    return n;
  }

  // Design doc "Solver stand-in": re-plan all flexible future work; returns how many tasks moved
  function adjust() {
    const H = horizon(), now = Math.ceil(C.clock.now / 15) * 15, before = S.placement;
    const occ = [...S.fixed, ...S.locked].filter(b => !isTbd(b)).map(b => [b.s, b.e]).concat(C.series.blocks().filter(b => !isTbd(b)).map(b => [b.s, b.e]));
    const order = S.tasks.filter(t => !isTbd(t)).map((t, i) => ({ t, i }))
      .sort((x, y) => x.t.pr - y.t.pr || (x.t.dl ?? Infinity) - (y.t.dl ?? Infinity) || (x.t.order ?? x.i) - (y.t.order ?? y.i)).map(x => x.t);
    const res = {}, used = new Set([...S.fixed, ...S.locked].map(b => String(b.id)));
    for (const t of order) {
      const old = before[t.id], keep = old ? old.pieces.filter(([s]) => s >= H) : [];
      const need = t.dur - keep.reduce((a, [s, e]) => a + e - s, 0);
      let pieces = [], unmet = [];
      const cat = C.store.cat(t.cat);
      if (need > 0 && (!cat || !cat.spaces.length)) unmet.push('Its category has no time spaces');
      else if (need > 0) {
        const from = Math.max(now, t.net ?? -Infinity);
        // work that may not start before the plan-ahead period ends is placed right after its start, without warnings
        const end = from >= H ? from + 31 * C.D : H, until = Math.min(t.dl ?? end, end);
        const free = to => subtract(spaceOf(t.cat, from, to), norm(occ));
        let pc = contiguous(free(until), need);
        if (!pc && S.settings.split) { const r = fill(free(until), need); if (!r.rem) pc = r.pieces; }
        if (!pc) {
          if (S.settings.split) { const r = fill(free(end), need); pc = r.pieces; if (r.rem) unmet.push(`Only ${fmtDur(need - r.rem)} of ${fmtDur(need)} fits in its time spaces within the plan-ahead period`); }
          else { pc = contiguous(free(end), need) || []; if (!pc.length) unmet.push(`No free ${fmtDur(need)} in one piece within the plan-ahead period`); }
          if (t.dl != null && pc.some(([, e]) => e > t.dl)) unmet.unshift(`Finishes after its deadline (${fmtWhen(t.dl)})`);
        }
        pieces = pc;
      }
      pieces = [...pieces, ...keep].sort((a, b) => a[0] - b[0]);
      for (const p of pieces) occ.push(p);
      res[t.id] = { pieces, unmet, keys: pieces.map((_, j) => { let k = `${t.id}-${j}`, n = 0; while (used.has(k)) k = `${t.id}-${j}x${++n}`; used.add(k); return k; }), labels: pieces.length > 1 ? pieces.map((_, j) => `${j + 1}/${pieces.length}`) : null };
    }
    for (const t of S.tasks) if (isTbd(t) && before[t.id]) res[t.id] = before[t.id];
    let moved = 0; for (const id in res) if (before[id] && JSON.stringify(before[id].pieces) !== JSON.stringify(res[id].pieces)) moved++;
    S.placement = res;
    return moved;
  }
  function replan() { freeze(); const moved = adjust(); C.store.save(); return moved; }

  // review queue: not done, ended before now, within max review period; newest first
  function reviewFrom() {
    const { now, today, weekStart } = C.clock, p = S.settings.review.period;
    return p === 'thisweek' ? at(weekStart, 0) : p === 'lastweek' ? at(weekStart - 7, 0) : p === '2w' ? at(weekStart - 14, 0) : p === 'thismonth' ? at(today - dateOf(today).getDate() + 1, 0) : now - 30 * C.D;
  }
  const reviewQueue = () => { const from = reviewFrom(), now = C.clock.now; return items().filter(it => !it.done && it.e <= now && it.s >= from && !isTbd(it)).sort((a, b) => b.s - a.s); };

  // glossary: Fixed category — its time blocks are fixed where they are now
  function fixCategory(catId) {
    freeze();
    for (const t of S.tasks.filter(x => x.cat === catId)) {
      const p = S.placement[t.id];
      if (p) p.pieces.forEach(([s, e]) => S.fixed.push({ id: C.store.id('f'), title: t.title, cat: t.cat, s, e, done: false, pr: t.pr, byCat: true }));
      delete S.placement[t.id];
    }
    S.tasks = S.tasks.filter(x => x.cat !== catId);
    adjust(); C.store.save();
  }
  function unfixCategory(catId) {
    const now = C.clock.now, back = S.fixed.filter(b => b.byCat && b.cat === catId && b.s > now && !b.done);
    S.fixed = S.fixed.filter(b => !back.includes(b));
    for (const b of back) S.tasks.push({ id: C.store.id('t'), title: b.title, cat: b.cat, dur: b.e - b.s, pr: b.pr ?? C.DEF_PR, net: null, dl: null, order: ++S.seq });
    replan();
  }

  C.solver = { items, freeze, adjust, replan, horizon, spaceOf, reviewFrom, reviewQueue, fixCategory, unfixCategory, MIN_PIECE };
})(window.Chrona = window.Chrona || {});
