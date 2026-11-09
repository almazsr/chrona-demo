(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, parseWhen, isHuman, whenLabel, humanWhen, placeText, norm, clip, subtract, WDS } = C;
  const IC = C.icons, S = C.store.state;

  // screen hooks (C.view): render(animated), adjust(msg, after), openForm(mode, it, values), moveResize(act, it), showLink(first, ref), closePop(), closeDD(), focusRef, onTbd
  const defaultView = () => ({ render() {}, adjust(msg, after) { const moved = C.solver.replan(); C.view.render(true); if (after) after(moved); else C.ui.toast(`${msg ? msg + ' \u00b7 ' : ''}Schedule adjusted${moved ? ` \u00b7 ${moved} time block${moved > 1 ? 's' : ''} moved` : ''}`); } });
  C.view = defaultView();
  // every action changes the state first, then redraws: save in between so a reload keeps it
  const rerender = animated => { C.store.save(); C.view.render(animated); };
  // screens add their hooks on mount and call this on unmount
  const resetView = () => { flushDelete(); closeAll(); closeDialog(); C.view = defaultView(); };
  const MIN_PIECE = C.solver.MIN_PIECE;
  const byKey = k => C.solver.items().find(it => it.key === k);
  let tbd = null, tbdTimer = null, pendingDrop = null, dialog = null;
  // a time block marked for deletion; a repeating one may be marked with its scope
  function isTbd(it) {
    if (!tbd) return false;
    const ref = it.ref || it;
    if (ref === tbd) return true;
    if (!tbd.scope) return false;
    const o = it.occ || (it.sid ? { sid: it.sid, day: it.day } : null);
    return !!o && o.sid === tbd.sid && (tbd.scope === 'following' ? o.day >= tbd.day : o.day === tbd.day);
  }
  C.isTbd = isTbd;
  const closePop = () => { const p = $('#cx-pop'); if (p) p.hidden = true; if (C.view.closePop) C.view.closePop(); };
  const showLink = (first, ref) => C.view.showLink ? C.view.showLink(first, ref) : '';

  // ---------- context menu ----------
  const cmenu = $('#cx-cmenu');
  const closeMenu = () => { cmenu.hidden = true; cmenu.classList.remove('staged'); delete cmenu.dataset.k; if (stage && stage.el === cmenu) stage = null; $$('.lrow.sel').forEach(r => r.classList.remove('sel')); };
  const closeAll = () => { closePop(); closeMenu(); };
  const POSTPONE = [['nearest', 'Nearest later'], ['tomorrow', 'Tomorrow'], ['nextweek', 'Next week'], ['other', 'Other…']];
  const netFor = (v, it) => v === 'nearest' ? (it && it.e > C.clock.now ? it.e : null) : v === 'tomorrow' ? parseWhen('tmr', 'net') : v === 'nextweek' ? parseWhen('next week', 'net') : null;
  const postponeHint = (v, it) => v === 'nearest' ? 'next free time' : v === 'other' ? 'pick a date' : `${v === 'tomorrow' ? 'tmr' : 'next week'} · ${fmtDay(dayOf(netFor(v, it)))}`;
  const postponeLabel = net => net == null ? 'to the nearest free time' : `to ${humanWhen(net)}`;
  function openMenu(key, x, y, keepPop) {
    const it = byKey(key); if (!it || isTbd(it)) return;
    if (!keepPop) closePop();
    const fx = it.kind === 'fixed', done = it.done;
    const partialWhy = done ? 'Already done' : fx ? 'Only flexible time blocks can be partially done' : '';
    const postponeWhy = done ? 'Already done' : fx ? 'Fixed time blocks don\u2019t move by themselves. Drag it in the calendar or edit its start' : '';
    const cat = C.catOf(it.cat);
    const flipWhy = done ? 'Already done' : it.s <= C.clock.now ? 'Already started' : !fx ? '' : it.occ ? 'Repeating time blocks are always fixed' : cat.fixed ? `${cat.name} is a fixed category, so its time blocks are always fixed` : '';
    const ci = (act, icon, label, extra = '', v = '', tip = '') => `<div class="ci${extra}" data-act="${act}" data-k="${key}"${v !== '' ? ` data-v="${v}"` : ''}${tip ? ` title="${esc(tip)}"` : ''}><span class="ic">${icon}</span><span class="lab">${label}</span></div>`;
    cmenu.classList.remove('staged');
    cmenu.innerHTML =
      ci('done', done ? IC.undo : IC.check, done ? 'Undone' : 'Done')
      + `<div class="ci${partialWhy ? ' dis' : ''}" data-parent="1"${partialWhy ? ` title="${esc(partialWhy)}"` : ''}><span class="ic">${IC.half}</span><span class="lab">Partially Done</span><span class="arr">›</span><div class="sub">${remHtml()}</div></div>`
      + `<div class="ci${postponeWhy ? ' dis' : ''}" data-parent="1"${postponeWhy ? ` title="${esc(postponeWhy)}"` : ''}><span class="ic">${IC.later}</span><span class="lab">Postpone</span><span class="arr">›</span><div class="sub">${ppHtml(it, null)}</div></div>`
      + (fx ? ci('unfix', IC.swap, 'Make Flexible', flipWhy ? ' dis' : '', '', flipWhy) : ci('fix', IC.lock, 'Make Fixed', flipWhy ? ' dis' : '', '', flipWhy))
      + '<div class="csep"></div>'
      + ci('edit', IC.edit, 'Edit')
      + '<div class="csep"></div>'
      + (it.occ
        ? `<div class="ci danger" data-parent="1"><span class="ic">${IC.trash}</span><span class="lab">Delete</span><span class="arr">›</span><div class="sub">${C.series.SCOPES.map(([v, l]) => ci('delete', IC.repeat, l, '', v)).join('')}</div></div>`
        : ci('delete', IC.trash, 'Delete', ' danger'));
    const pos = C.ui.placeAt(cmenu, x, y);
    cmenu.querySelectorAll('.sub').forEach(s => s.classList.toggle('left', pos.left + 210 + 260 > pos.width));
    cmenu.dataset.k = key;
    stage = { el: cmenu, it, remaining: null };
    $$('.lrow').forEach(r => r.classList.toggle('sel', r.dataset.k === key));
  }
  cmenu.addEventListener('click', e => {
    e.stopPropagation();
    if (stagedClick(cmenu, e)) return;
    const parent = e.target.closest('[data-parent]');
    const a = e.target.closest('[data-act]');
    if (!a) { if (parent && !parent.classList.contains('dis') && !e.target.closest('.sub')) { cmenu.querySelectorAll('.ci.open').forEach(x => x !== parent && x.classList.remove('open')); parent.classList.toggle('open'); } return; }
    if (a.classList.contains('dis')) return;
    closeMenu();
    runAction(a.dataset.act, a.dataset.k, a.dataset.v);
  });
  function runAction(act, key, v) {
    const it = byKey(key); if (!it) return;
    if (act === 'done') toggleDone(key);
    else if (act === 'fix') makeFixed(it);
    else if (act === 'unfix') makeFlexible(it);
    else if (act === 'edit') C.view.openForm('edit', it);
    else if (act === 'delete') { if (it.occ && !v) askScope(`Delete \u201c${esc(it.title)}\u201d`, sc => startDelete(key, sc)); else startDelete(key, v); }
  }

  // ---------- Partially Done and Postpone, step by step inside the same menu ----------
  // stage = { el, it, remaining }: remaining is set once "time still needed" is chosen.
  // Closing the menu before a postpone option is chosen cancels the whole action.
  let stage = null;
  const remHtml = () => '<div class="chead">Time still needed</div>'
    + [[30, '30 minutes'], [60, '1 hour'], [120, '2 hours']].map(([m, l]) => `<div class="ci" data-st="rem" data-v="${m}"><span class="ic">${IC.clock}</span><span class="lab">${l}</span></div>`).join('')
    + `<div class="ci" data-st="rem-other"><span class="ic">${IC.edit}</span><span class="lab">Other\u2026</span></div>`;
  const ppHtml = (it, remaining) => `<div class="chead">${remaining ? `${fmtDur(remaining)} left \u00b7 not earlier than` : 'Not earlier than'}</div>`
    + POSTPONE.map(([v, l]) => v === 'other'
      ? `<div class="ci" data-st="pp-other"><span class="ic">${IC.edit}</span><span class="lab">${l}</span><span class="val">pick a date</span></div>`
      : `<div class="ci" data-st="pp" data-v="${v}"><span class="ic">${IC.cal}</span><span class="lab">${l}</span><span class="val">${postponeHint(v, it)}</span></div>`).join('');
  function restage(el, html) {
    const left = parseFloat(el.style.left) || 0, top = parseFloat(el.style.top) || 0, cr = $('#cx-app').getBoundingClientRect();
    el.classList.add('staged'); el.innerHTML = html; C.ui.placeAt(el, cr.left + left, cr.top + top);
  }
  function showInline(el, kind) {
    const row = el.querySelector(`[data-st="${kind}-other"]`); if (!row) return;
    row.outerHTML = `<div class="mrow"><input class="pin" data-min="${kind}" placeholder="${kind === 'rem' ? 'e.g. 45m, 1h 30m' : 'tmr 15:00, eow, next week, 05/11'}" spellcheck="false"><span class="b p" data-mok="${kind}">OK</span></div>${kind === 'pp' ? '<div class="df-cal" data-mcal="pp"></div>' : ''}<div class="prev" data-mprev="${kind}"></div>`;
    if (kind === 'pp') C.datefield.attach(el.querySelector('[data-min="pp"]'), el.querySelector('[data-mcal="pp"]'), 'net');
    const cr = $('#cx-app').getBoundingClientRect(); C.ui.placeAt(el, cr.left + (parseFloat(el.style.left) || 0), cr.top + (parseFloat(el.style.top) || 0));
    setTimeout(() => el.querySelector('[data-min]').focus(), 20);
  }
  function readInline(el, kind, show) {
    const inp = el.querySelector(`[data-min="${kind}"]`), pv = el.querySelector(`[data-mprev="${kind}"]`), val = inp.value.trim();
    let out = null, msg = '', bad = false;
    if (kind === 'rem') { const d = parseDur(val); if (!val) { msg = show ? 'Enter how much time is still needed' : ''; bad = show; } else if (d == null || Number.isNaN(d) || d <= 0) { msg = 'Try 45m, 2h or 1h 30m'; bad = true; } else { out = d; msg = `= ${fmtDur(d)}`; } }
    else { const t = parseWhen(val, 'net'); if (!val) { msg = show ? 'Enter a date, e.g. tmr 15:00' : ''; bad = show; } else if (Number.isNaN(t)) { msg = 'Couldn\u2019t read this date. Try tmr, eod, eow or 05/11 15:00'; bad = true; } else if (t <= C.clock.now) { msg = `${fmtWhen(t)} is in the past`; bad = true; } else { out = t; msg = `\u2192 ${fmtWhen(t)}`; } }
    pv.textContent = msg; pv.className = 'prev' + (bad ? ' bad' : ''); inp.classList.toggle('err', bad);
    return out;
  }
  function stagedClick(el, e) {
    const st = e.target.closest('[data-st]'), ok = e.target.closest('[data-mok]');
    if (!st && !ok) return !!e.target.closest('.mrow, [data-mprev]');
    if (!stage || stage.el !== el) return true;
    const it = stage.it;
    if (ok) { submitInline(el, ok.dataset.mok); return true; }
    const k = st.dataset.st;
    if (k === 'rem') toPostponeStep(el, +st.dataset.v);
    else if (k === 'rem-other') { if (st.closest('.sub')) restage(el, remHtml()); showInline(el, 'rem'); }
    else if (k === 'pp') finishStaged(el, netFor(st.dataset.v, it));
    else if (k === 'pp-other') { if (st.closest('.sub')) restage(el, ppHtml(it, stage.remaining)); showInline(el, 'pp'); }
    return true;
  }
  function submitInline(el, kind) { const v = readInline(el, kind, true); if (v == null) return; if (kind === 'rem') toPostponeStep(el, v); else finishStaged(el, v); }
  function toPostponeStep(el, remaining) { stage.remaining = remaining; restage(el, ppHtml(stage.it, remaining)); }
  function finishStaged(el, net) {
    const { it, remaining } = stage;
    if (el === cmenu) closeMenu(); else if (C.view.closeDD) C.view.closeDD();
    stage = null;
    if (remaining) partialDone(it, remaining, net); else postpone(it, net);
  }
  function wireStaged(el) {
    el.addEventListener('input', e => { const k = e.target.dataset.min; if (k) readInline(el, k, false); });
    el.addEventListener('keydown', e => { const k = e.target.dataset.min; if (!k) return; e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submitInline(el, k); } else if (e.key === 'Escape') { if (el === cmenu) closeMenu(); else if (C.view.closeDD) C.view.closeDD(); } });
  }
  wireStaged(cmenu);

  // ---------- done / undone (only this card changes, nothing is rescheduled) ----------
  function markDone(it) {
    const r = it.ref;
    if (r.occ) { const sr = C.series.find(r.sid), x = C.series.exOf(sr, r.day); x.done = true; if (!sr.fixed && !x.pinned) { x.s = it.s; x.e = it.e; } return; }
    if (S.tasks.includes(r)) {
      const p = S.placement[r.id], j = p.keys.indexOf(it.key), [s, e] = p.pieces[j];
      S.locked.push({ id: it.key, title: r.title, cat: r.cat, s, e, done: true, part: p.labels ? p.labels[j] : null, pr: r.pr, dl: r.dl, net: r.net, unmet: p.unmet && p.unmet.length ? [...p.unmet] : null });
      p.pieces.splice(j, 1); p.keys.splice(j, 1); if (p.labels) p.labels.splice(j, 1);
      r.dur -= e - s;
      if (!p.pieces.length || r.dur <= 0) { S.tasks = S.tasks.filter(x => x !== r); delete S.placement[r.id]; }
    } else r.done = true;
  }
  function toggleDone(key) {
    const it = byKey(key); if (!it) return; closeAll();
    if (it.done) { if (it.ref.occ) C.series.exOf(C.series.find(it.ref.sid), it.ref.day).done = false; else it.ref.done = false; rerender(); C.ui.toast(`Marked \u201c${esc(it.title)}\u201d as not done`); return; }
    markDone(it); rerender(); C.ui.toast(`Marked \u201c${esc(it.title)}${it.part ? ' \u00b7 ' + it.part : ''}\u201d as done`);
  }

  // ---------- make fixed / make flexible (glossary: Pin) ----------
  // Make Fixed pins the block where it is now; for a part of a split task only that part becomes fixed
  function makeFixed(it) {
    const r = it.ref; let nf = null, rest = 0;
    if (S.tasks.includes(r)) {
      nf = { id: C.store.id('f'), title: r.title, cat: r.cat, s: it.s, e: it.e, pr: r.pr, done: false };
      S.fixed.push(nf); r.dur -= it.e - it.s; rest = r.dur;
      if (r.dur <= 0) { S.tasks = S.tasks.filter(x => x !== r); delete S.placement[r.id]; }
    } else if (S.locked.includes(r)) { S.locked = S.locked.filter(x => x !== r); nf = { id: r.id, title: r.title, cat: r.cat, s: r.s, e: r.e, pr: r.pr, done: !!r.done }; S.fixed.push(nf); }
    if (!nf) return;
    C.view.focusRef = nf;
    C.view.adjust(`\u201c${esc(it.title)}\u201d is now fixed \u00b7 ${placeText(it.s)}\u2013${endLabel(it.s, it.e)}${it.part && rest > 0 ? ` \u00b7 the other ${fmtDur(rest)} stay flexible` : ''}`);
  }
  // Make Flexible hands the block back to schedule adjustment, keeping title, category, priority and duration
  function makeFlexible(it) {
    const r = it.ref; if (!S.fixed.includes(r)) return;
    S.fixed = S.fixed.filter(x => x !== r);
    const t = { id: C.store.id('t'), title: r.title, cat: r.cat, dur: r.e - r.s, pr: r.pr ?? DEF_PR, net: null, dl: null, order: ++S.seq };
    S.tasks.push(t); C.view.focusRef = t;
    C.view.adjust(null, () => {
      const p = S.placement[t.id], first = p && p.pieces[0];
      C.ui.toast(`\u201c${esc(t.title)}\u201d is now flexible \u00b7 placed ${first ? placeText(first[0]) : 'nowhere yet'}${showLink(first, t)}`, 6000);
    });
  }

  // ---------- partially done ----------
  function partialDone(it, remaining, net) {
    markDone(it);
    const nt = { id: ++S.seq, title: it.title, cat: it.cat, dur: remaining, pr: it.pr ?? DEF_PR, net, dl: it.dl ?? null, partOf: it.ref };
    S.tasks.push(nt); rerender();
    C.view.adjust(null, () => {
      const p = S.placement[nt.id], first = p && p.pieces[0];
      C.ui.toast(`Partially done \u201c${esc(it.title)}\u201d \u00b7 ${fmtDur(remaining)} left, postponed ${postponeLabel(net)} \u00b7 now ${first ? placeText(first[0]) : 'not scheduled'}${showLink(first, nt)}`, 6000);
    });
  }

  // ---------- postpone ----------
  function targetTask(it) {
    const r = it.ref;
    if (S.tasks.includes(r)) return r;
    if (S.locked.includes(r) && !r.done) { S.locked = S.locked.filter(x => x !== r); const t = { id: ++S.seq, title: r.title, cat: r.cat, dur: r.e - r.s, pr: r.pr ?? DEF_PR, net: null, dl: r.dl ?? null, from: r }; S.tasks.push(t); return t; }
    return null;
  }
    function postpone(it, net) {
    const t = targetTask(it); if (!t) return;
    t.net = net;
    C.view.adjust(null, () => {
      const p = S.placement[t.id], first = p && p.pieces[0];
      C.ui.toast(`Postponed \u201c${esc(t.title)}\u201d ${postponeLabel(net)} \u00b7 now ${first ? placeText(first[0]) : 'not scheduled'}${showLink(first, t)}`, 6000);
    });
  }
  function closeDialog() { const ov = $('#cx-ov'); ov.hidden = true; ov.innerHTML = ''; dialog = null; }


  // ---------- delete with undo ----------
  function startDelete(key, scope) {
    const it = byKey(key); if (!it) return; closeAll();
    if (tbd) { clearTimeout(tbdTimer); finalizeDelete(); }
    tbd = it.ref.occ ? { sid: it.ref.sid, day: it.ref.day, scope: scope || 'this', title: it.title } : it.ref; rerender();
    if (C.view.onTbd) C.view.onTbd();
    const what = !tbd.scope || tbd.scope === 'this' ? `\u201c${esc(it.title)}\u201d` : `\u201c${esc(it.title)}\u201d from ${fmtDay(tbd.day)} on`;
    let left = 5;
    const show = () => C.ui.toast(`Deleting ${what} in ${left}s <span data-undo="1">Undo</span>`, 0);
    show();
    const tick = () => { left--; if (left <= 0) { finalizeDelete(); return; } show(); tbdTimer = setTimeout(tick, 1000); };
    tbdTimer = setTimeout(tick, 1000);
  }
  function finalizeDelete() {
    const t = tbd; if (!t) return;
    if (t.scope) {
      const sr = C.series.find(t.sid);
      if (t.scope === 'this') C.series.exOf(sr, t.day).deleted = true;
      else C.series.stopFrom(sr, t.day);
      tbd = null; C.ui.hideToast();
      C.view.adjust(`Deleted ${t.scope === 'following' ? 'this and following time blocks of ' : ''}\u201c${esc(t.title)}\u201d`);
      return;
    }
    S.fixed = S.fixed.filter(x => x !== t); S.locked = S.locked.filter(x => x !== t); S.tasks = S.tasks.filter(x => x !== t); delete S.placement[t.id];
    tbd = null; C.ui.hideToast();
    C.view.adjust(`Deleted \u201c${esc(t.title)}\u201d`);
  }

  function askScope(title, onPick, onCancel) {
    closeAll();
    const ov = $('#cx-ov');
    ov.innerHTML = `<div class="modal"><h5>${title}</h5><p style="margin:0 0 6px;color:#3b4656">This time block repeats. Apply to:</p><div class="opts">${C.series.SCOPES.map(([k, l]) => `<div class="mi" data-scope="${k}"><span class="ic">${IC.repeat}</span><span class="lab">${l}</span></div>`).join('')}</div><div class="actions"><span class="b" data-dlg="cancel">Cancel</span></div></div>`;
    ov.hidden = false;
    dialog = { cancel: () => { closeDialog(); if (onCancel) onCancel(); }, scope: k => { closeDialog(); onPick(k); } };
  }
  function valuesOf(it) {
    const t = it.ref;
    if (it.occ) { const sr = C.series.find(it.occ.sid), x = sr.ex[it.occ.day] || {}, fx = true; return { title: it.title, cat: it.cat, dur: fmtDur(it.e - it.s), pr: it.pr ?? DEF_PR, fixed: fx, start: fx ? toLocal(it.s) : '', rep: { ...sr.rule, days: sr.rule.days ? [...sr.rule.days] : sr.rule.days, ends: { ...sr.ends } }, repBase: it.occ.day }; }
    if (S.tasks.includes(t)) return { title: t.title, cat: t.cat, dur: fmtDur(t.dur), pr: t.pr, fixed: false, net: t.net != null ? toLocal(t.net).replace('T', ' ') : '', dl: t.dl != null ? toLocal(t.dl).replace('T', ' ') : '' };
    return { title: t.title, cat: t.cat, dur: fmtDur(t.e - t.s), pr: t.pr ?? DEF_PR, fixed: true, start: toLocal(t.s) };
  }
  function commitForm(data, old) {
    let done = false;
    if (old) { done = !!old.done; S.fixed = S.fixed.filter(x => x !== old); S.locked = S.locked.filter(x => x !== old); S.tasks = S.tasks.filter(x => x !== old); delete S.placement[old.id]; }
    if (data.rep) { const sr = C.series.create(data); C.view.adjust(`${old ? 'Updated' : 'Created'} \u201c${esc(data.title)}\u201d \u00b7 ${esc(C.series.ruleText(sr.rule, sr.from))}`); return; }
    let obj;
    if (data.fixed) { obj = { id: old && S.fixed.includes(old) ? old.id : C.store.id('f'), title: data.title, cat: data.cat, s: data.start, e: data.start + data.dur, pr: data.pr, done }; S.fixed.push(obj); if (C.view.showWeekOf) C.view.showWeekOf(dayOf(data.start)); }
    else { obj = { id: old && old.dur != null ? old.id : C.store.id('t'), title: data.title, dur: data.dur, cat: data.cat, pr: data.pr, net: data.net, dl: data.dl, order: old && old.order != null ? old.order : ++S.seq }; S.tasks.push(obj); }
    C.view.focusRef = obj;
    C.view.adjust(`${old ? 'Updated' : 'Created'} \u201c${esc(data.title)}\u201d`);
  }
  function editOcc(it, data, scope) {
    const sr = C.series.find(it.occ.sid), day = it.occ.day;
    if (!data.rep && scope !== 'this') {
      // repeat removed: the series stops, this time block stays as a single one
      C.series.stopFrom(sr, day);
      commitForm({ ...data, start: data.fixed ? data.start : null }, null); return;
    }
    const ch = { title: data.title, cat: data.cat, dur: data.dur, pr: data.pr };
    if (data.fixed) { ch.s = data.start; ch.e = data.start + data.dur; }
    if (scope !== 'this' && data.rep) { ch.rule = C.series.ruleOf(data.rep, day); ch.ends = data.rep.ends; }
    if (scope === 'this' && !data.fixed) delete ch.s;
    C.series.change(it, scope, ch);
    C.view.adjust(`Updated ${C.series.scopeWord(scope)} of \u201c${esc(data.title)}\u201d`);
  }

  function onDrop(dd) {
    const it = dd.it, r = it.ref;
    if (r.occ) {
      const back = () => { rerender(true); C.ui.toast(`Kept \u201c${esc(it.title)}\u201d unchanged`); };
      if (dd.resize) { askScope(`Resize \u201c${esc(it.title)}\u201d to ${fmtDur(dd.e - dd.s)}`, sc => { C.series.change(it, sc, { dur: dd.e - dd.s }); C.view.adjust(`Resized ${C.series.scopeWord(sc)} of \u201c${esc(it.title)}\u201d to ${fmtDur(dd.e - dd.s)}`); }, back); return; }
      { askScope(`Move \u201c${esc(it.title)}\u201d to ${range(dd.s, dd.e)}`, sc => { C.series.change(it, sc, { s: dd.s, e: dd.e }); C.view.adjust(`Moved ${C.series.scopeWord(sc)} of \u201c${esc(it.title)}\u201d`); }, back); return; }
    }
    if (dd.resize) {
      if (S.tasks.includes(r)) r.dur = Math.max(15, r.dur + (dd.e - dd.s) - (it.e - it.s)); else r.e = dd.e;
      C.view.adjust(`\u201c${esc(it.title)}\u201d is now ${fmtDur(dd.e - dd.s)}`); return;
    }
    if (S.fixed.includes(r)) { r.s = dd.s; r.e = dd.e; C.view.adjust(`Moved \u201c${esc(r.title)}\u201d to ${range(dd.s, dd.e)}`); return; }
    pendingDrop = dd;
    const ov = $('#cx-ov');
    ov.innerHTML = `<div class="modal"><h5>Make \u201c${esc(it.title)}\u201d fixed?</h5>
      <p style="margin:0 0 6px;line-height:1.5">This time block is flexible, so Chrona chooses its time. To keep it at <b>${range(dd.s, dd.e)}</b>, it becomes fixed and schedule adjustment won't move it.</p>
      ${it.part && S.tasks.includes(r) ? `<p class="muted" style="margin:0 0 6px">Only this part (${fmtDur(it.e - it.s)}) becomes fixed. The other ${fmtDur(r.dur - (it.e - it.s))} stay flexible.</p>` : ''}
      <div class="actions"><span class="b" data-fx="no">Keep flexible</span><span class="b p" data-fx="yes">Make fixed and move</span></div></div>`;
    ov.hidden = false;
  }
  function applyFix(dd) {
    const it = dd.it, r = it.ref;
    if (S.tasks.includes(r)) { const nf = { id: C.store.id('f'), title: r.title, cat: r.cat, s: dd.s, e: dd.e, pr: r.pr }; S.fixed.push(nf); C.view.focusRef = nf; r.dur -= it.e - it.s; if (r.dur < MIN_PIECE) { S.tasks = S.tasks.filter(x => x !== r); delete S.placement[r.id]; } }
    else if (S.locked.includes(r)) { S.locked = S.locked.filter(x => x !== r); S.fixed.push({ ...r, s: dd.s, e: dd.e }); }
    C.view.adjust(`\u201c${esc(it.title)}\u201d is now fixed at ${range(dd.s, dd.e)}`);
  }


  // ---------- overlay dialogs and toast links (shared by every screen) ----------
  $('#cx-ov').addEventListener('click', e => {
    const ov = $('#cx-ov');
    const fx = e.target.closest('[data-fx]');
    if (fx) { const dd = pendingDrop; pendingDrop = null; closeDialog(); if (fx.dataset.fx === 'yes') applyFix(dd); else { rerender(true); C.ui.toast(`Kept \u201c${esc(dd.it.title)}\u201d flexible`); } return; }
    const sc = e.target.closest('[data-scope]'); if (sc && dialog && dialog.scope) { dialog.scope(sc.dataset.scope); return; }
    const dg = e.target.closest('[data-dlg]'); if (dg && dialog) { if (dg.dataset.dlg === 'ok') dialog.ok(); else dialog.cancel(); return; }
    if (e.target === ov) { if (pendingDrop) { const dd = pendingDrop; pendingDrop = null; closeDialog(); rerender(true); C.ui.toast(`Kept \u201c${esc(dd.it.title)}\u201d flexible`); } else if (dialog) dialog.cancel(); }
  });
  function undoDelete() { if (!tbd) return; clearTimeout(tbdTimer); tbd = null; C.ui.hideToast(); rerender(); C.ui.toast('Deletion cancelled'); }
  $('#cx-toast').addEventListener('click', e => { if (e.target.closest('[data-undo]')) undoDelete(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (dialog) { dialog.cancel(); return; }
    if (pendingDrop) { const dd = pendingDrop; pendingDrop = null; closeDialog(); rerender(true); return; }
    closeAll();
  });
  // leaving a screen finishes a pending deletion instead of losing it
  function flushDelete() { if (tbd) { clearTimeout(tbdTimer); finalizeDelete(); } }

  C.actions = {
    openMenu, closeMenu, closeAll, runAction, toggleDone, markDone, partialDone, postpone, makeFixed, makeFlexible, startDelete, flushDelete, undoDelete, isTbd,
    askScope, valuesOf, commitForm, editOcc, onDrop, closeDialog, byKey,
    wireStaged, stagedClick, remHtml, ppHtml, setStage: (el, it) => { stage = el ? { el, it, remaining: null } : null; }, postponeHint, POSTPONE,
    hasDialog: () => !!dialog || !!pendingDrop, resetView,
  };
})(window.Chrona = window.Chrona || {});
