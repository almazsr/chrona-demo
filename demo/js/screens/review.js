(function (C) {
  'use strict';
  const { $, $$, esc, hm, wd, dayOf, fmtDay, fmtDur, endLabel, range, prName, humanWhen, placeText, norm, subtract } = C;
  const IC = C.icons, S = C.store.state, A = () => C.actions;
  const PERIOD = { thisweek: 'earlier this week', lastweek: 'last week', '2w': 'last 2 weeks', thismonth: 'earlier this month', month: 'last month' };
  const PR_EMOJI = { 1: '\ud83d\udd25', 2: '\u26a1', 10: '\ud83d\udca4' };
  const prCell = p => PR_EMOJI[p] || (p === C.DEF_PR ? '' : `<span class="pn">${p}</span>`);
  const ICON_OK = '<svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
  let root = null, queue = [], cur = 0, prevSts = null, animateCard = true;
  const dd = () => $('#rv-dd');
  const relDay = d => { const n = C.clock.today - d; return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
  const postponeLabel = net => net == null ? 'to the nearest free time' : `to ${humanWhen(net)}`;

  // ---------- review result of each queued time block ----------
  function occState(q) { const sr = C.series.find(q.occ.sid); if (!sr || !C.series.occDays(sr, q.occ.day, q.occ.day).length) return null; return sr.ex[q.occ.day] || {}; }
  function status(q) {
    if (A().isTbd(q)) return 'deleting';
    if (S.tasks.some(t => t.from === q.ref)) return 'postponed';
    if (q.occ) { const x = occState(q); if (!x || x.deleted) return 'deleted'; return x.done ? 'done' : 'pending'; }
    if (!S.fixed.includes(q.ref) && !S.locked.includes(q.ref)) return 'deleted';
    if (q.ref.done) return S.tasks.some(t => t.partOf === q.ref) || q.ref.partial ? 'partial' : 'done';
    return 'pending';
  }
  function resultText(q, st) {
    const firstOf = t => { const p = t && S.placement[t.id]; return p && p.pieces[0] ? placeText(p.pieces[0][0]) : null; };
    if (st === 'done') return 'Marked as done';
    if (st === 'postponed') { const t = S.tasks.find(x => x.from === q.ref), w = firstOf(t); return `Postponed ${postponeLabel(t ? t.net : null)}${w ? ` \u00b7 now ${w}` : ''}`; }
    if (st === 'partial') { const t = S.tasks.find(x => x.partOf === q.ref), w = firstOf(t); return `Partially done${t ? ` \u00b7 ${fmtDur(t.dur)} left, postponed ${postponeLabel(t.net)}${w ? ` \u00b7 now ${w}` : ''}` : ''}`; }
    if (st === 'deleting') return 'Will be deleted in a few seconds';
    if (st === 'deleted') return 'Deleted';
    return '';
  }
  const nextPending = (from, sts) => { for (let i = from + 1; i < sts.length; i++) if (sts[i] === 'pending') return i; for (let i = 0; i < from; i++) if (sts[i] === 'pending') return i; return -1; };

  // ---------- render ----------
  function render() {
    if (!root) return;
    const sts = queue.map(status), pending = sts.filter(s => s === 'pending').length, label = PERIOD[S.settings.review.period] || 'last month';
    if (prevSts && prevSts[cur] === 'pending' && sts[cur] !== 'pending') { const n = nextPending(cur, sts); if (n >= 0) { cur = n; animateCard = true; } }
    prevSts = sts;
    let h = `<div class="rvcol"><div class="rvhead"><h3>Review</h3><span class="muted">Not-done time blocks from the ${label} (max review period in Settings)</span><span class="sp"></span>${pending ? `<span class="cnt">${pending} left</span>` : ''}</div>`;
    if (!pending) {
      const c = k => sts.filter(s => s === k).length, parts = [[c('done'), 'done'], [c('partial'), 'partially done'], [c('postponed'), 'postponed'], [c('deleted') + c('deleting'), 'deleted']].filter(x => x[0]).map(x => `${x[0]} ${x[1]}`);
      h += `<div class="caught"><span class="big">${ICON_OK}</span><h4>You're all caught up</h4><p>${queue.length ? `Reviewed ${queue.length} time block${queue.length > 1 ? 's' : ''}: ${parts.join(', ')}.` : `No not-done time blocks from the ${label}.`}</p></div>`;
    } else {
      h += `<div class="rvbar">${queue.map((q, i) => `<span class="st-${sts[i]}${i === cur ? ' cur' : ''}" data-go="${i}" title="${esc(q.title)} \u00b7 ${sts[i] === 'pending' ? 'not reviewed yet' : sts[i]}"></span>`).join('')}</div>`;
      h += cardHtml(queue[cur], sts[cur]);
      h += `<div class="rnav"><span class="ib${cur === 0 ? ' off' : ''}" data-nav="-1" title="Previous">\u2039</span><span class="muted">${cur + 1} of ${queue.length}</span><span class="ib${cur === queue.length - 1 ? ' off' : ''}" data-nav="1" title="Next">\u203a</span><span class="sp"></span><span class="rhint"><b>D</b> Done \u00b7 <b>H</b> Partially Done \u00b7 <b>P</b> Postpone \u00b7 <b>\u2190</b> <b>\u2192</b> Previous / next</span></div>`;
    }
    h += aheadHtml() + '</div>';
    $('#cx-review', root).innerHTML = h;
    if (animateCard) { const c = $('#cx-review .rcard', root); if (c) c.classList.add('st-in'); animateCard = false; }
  }
  function cardHtml(q, st) {
    const fx = q.kind === 'fixed', d = dayOf(q.s), pn = prName(q.pr), pc = prCell(q.pr), cat = C.catOf(q.cat), now = C.clock.now;
    const dis = fx ? 'Fixed time blocks can\u2019t be partially done or postponed' : '';
    const sr = q.occ ? C.series.find(q.occ.sid) : null;
    let h = '<div class="rcard">';
    if (st !== 'pending') h += `<div class="rres st-${st}"><span>${esc(resultText(q, st))}</span><span class="sp"></span>${st === 'done' ? '<span class="b" data-rv="undone">Undone</span>' : st === 'deleting' ? '<span class="b" data-rv="undo-delete">Undo</span>' : ''}</div>`;
    h += `<div class="rtitle${st === 'done' || st === 'partial' ? ' done' : ''}"><i class="cdot" style="background:${cat.color}" title="${esc(cat.name)}"></i><span class="tx">${esc(q.title)}</span>${q.part ? `<span class="pt">part ${q.part}</span>` : ''}${q.occ ? `<span class="lk" title="Repeats">${IC.repeat}</span>` : ''}${fx ? `<span class="lk" title="Fixed">${IC.lock}</span>` : ''}${pc ? `<span title="Priority ${esc(pn || q.pr)}">${pc}</span>` : ''}</div>`;
    h += `<div class="rgrid">
      <span class="k">${IC.clock}</span><span>Planned ${wd(d)} ${fmtDay(d)}, ${hm(q.s)}\u2013${endLabel(q.s, q.e)} <span class="muted2">\u00b7 ${relDay(d)}</span></span>
      <span class="k"><i style="width:9px;height:9px;border-radius:50%;background:${cat.color}"></i></span><span>${esc(cat.name)} \u00b7 ${fmtDur(q.e - q.s)}</span>
      <span class="k">${IC.flag}</span><span>Priority ${esc(pn || q.pr)}</span>
      ${q.dl != null ? `<span class="k">${IC.deadline}</span><span class="${q.dl < now ? 'over' : ''}">Deadline ${humanWhen(q.dl)}${q.dl < now ? ' \u00b7 overdue' : ''}</span>` : ''}
      ${q.net != null ? `<span class="k">${IC.net}</span><span>Not earlier than ${humanWhen(q.net)}</span>` : ''}
      ${sr ? `<span class="k">${IC.repeat}</span><span>${esc(C.series.ruleText(sr.rule, sr.from))} \u00b7 ${esc(C.series.endsText(sr.ends))}</span>` : ''}
      <span class="k">${fx ? IC.lock : IC.swap}</span><span>${fx ? 'Fixed' : 'Flexible'}</span>
    </div>`;
    if (q.unmet && q.unmet.length) h += `<div class="runmet"><span class="warn">!</span><span>${q.unmet.map(esc).join('<br>')}</span></div>`;
    if (st === 'pending') h += `<div class="racts">
      <span class="rb2 pri" data-rv="done">${IC.check}Done <span class="kb">D</span></span>
      <span class="rb2${fx ? ' dis' : ''}" data-rv="partial"${dis ? ` title="${dis}"` : ''}>${IC.half}Partially Done \u25be <span class="kb">H</span></span>
      <span class="rb2${fx ? ' dis' : ''}" data-rv="postpone"${dis ? ` title="${dis}"` : ''}>${IC.later}Postpone \u25be <span class="kb">P</span></span>
      <span class="sp"></span><span class="rb2 ghost" data-rv="delete">${IC.trash}Delete</span></div>`;
    return h + '</div>';
  }
  // review-workflow.feature "Move time blocks completed ahead of time into free past slots"
  function aheadHtml() {
    const now = C.clock.now, today = C.clock.today, ahead = C.solver.items().filter(it => it.done && it.s >= now).sort((a, b) => a.s - b.s);
    if (!ahead.length) return '';
    return `<div class="ahead"><h4>Done ahead of time \u00b7 ${ahead.length}</h4><p>Marked done, but planned for later. Move them into free time before now to give their planned time back to the schedule.</p>`
      + ahead.map(it => { const d = dayOf(it.s), cat = C.catOf(it.cat); return `<div class="arow" data-ak="${esc(it.key)}"><span class="cbx"></span><i class="cdot" style="background:${cat.color}" title="${esc(cat.name)}"></i><span class="tt">${esc(it.title)}</span><span class="du">(${fmtDur(it.e - it.s)})</span><span class="sp"></span><span class="wh">planned ${d === today ? 'today' : d === today + 1 ? 'tomorrow' : `${wd(d)} ${fmtDay(d).slice(0, 5)}`}, ${hm(it.s)}</span><span class="b" data-past="${esc(it.key)}">Move to past</span></div>`; }).join('')
      + '</div>';
  }
  function moveToPast(key) {
    const it = A().byKey(key); if (!it) return;
    const r = it.ref, len = it.e - it.s, from = C.solver.reviewFrom(), now = C.clock.now;
    const occ = norm(C.solver.items().filter(x => x.key !== it.key && x.e > from && x.s < now).map(x => [x.s, x.e]));
    const latest = base => { const free = subtract(base, occ); for (let i = free.length - 1; i >= 0; i--) { const [s, e] = free[i]; if (e - s >= len) return [e - len, e]; } return null; };
    const slot = latest(C.solver.spaceOf(it.cat, from, now)) || latest([[from, now]]);
    if (!slot) { C.ui.toast(`No free time before now fits \u201c${esc(it.title)}\u201d`); return; }
    if (it.occ) C.series.change(it, 'this', { s: slot[0], e: slot[1] }); else { r.s = slot[0]; r.e = slot[1]; }
    adjustSchedule(`Moved \u201c${esc(it.title)}\u201d to ${range(slot[0], slot[1])}`);
  }
  function adjustSchedule(msg, after) {
    A().closeAll();
    setTimeout(() => {
      const moved = C.solver.replan();
      render();
      if (after) after(moved); else C.ui.toast(`${msg ? msg + ' \u00b7 ' : ''}Schedule adjusted${moved ? ` \u00b7 ${moved} time block${moved > 1 ? 's' : ''} moved` : ''}`, 4500);
    }, 400);
  }

  // ---------- Partially Done / Postpone menus under their buttons (same steps as the actions menu) ----------
  function closeDD() { const el = dd(); if (!el) return; el.hidden = true; el.classList.remove('staged'); delete el.dataset.kind; A().setStage(null); $$('.rb2.on').forEach(b => b.classList.remove('on')); }
  function openDD(kind, anchor) {
    const q = queue[cur], it = A().byKey(q.key), el = dd(); if (!it || !el) return;
    if (!el.hidden && el.dataset.kind === kind) { closeDD(); return; }
    closeDD();
    el.innerHTML = kind === 'partial' ? A().remHtml() : A().ppHtml(it, null);
    el.dataset.kind = kind; anchor.classList.add('on');
    A().setStage(el, it);
    const r = anchor.getBoundingClientRect(); C.ui.placeAt(el, r.left, r.bottom + 4);
  }

  // ---------- review actions ----------
  function rvDone() { const q = queue[cur], it = A().byKey(q.key); if (!it) return; A().closeAll(); A().markDone(it); C.store.save(); render(); C.ui.toast(`Marked \u201c${esc(q.title)}\u201d as done`); }
  function rvUndone() { const q = queue[cur]; if (q.occ) { const x = occState(q); if (x) delete x.done; } else q.ref.done = false; C.store.save(); render(); C.ui.toast(`Marked \u201c${esc(q.title)}\u201d as not done`); }
  function nav(dir) { const n = cur + dir; if (n < 0 || n >= queue.length) return; cur = n; animateCard = true; A().closeAll(); render(); }

  function onClick(e) {
    if (!root || e.target.closest('#cx-ov') || e.target.closest('#cx-cmenu') || e.target.closest('.hdr')) return;
    if (e.target.closest('#rv-dd')) { A().stagedClick(dd(), e); return; }
    if (!root.contains(e.target)) return;
    const go = e.target.closest('[data-go]'); if (go) { cur = +go.dataset.go; animateCard = true; A().closeAll(); render(); return; }
    const nv = e.target.closest('[data-nav]'); if (nv) { nav(+nv.dataset.nav); return; }
    const rv = e.target.closest('[data-rv]');
    if (rv) {
      const a = rv.dataset.rv;
      if (rv.classList.contains('dis')) return;
      if (a === 'done') rvDone();
      else if (a === 'undone') rvUndone();
      else if (a === 'partial' || a === 'postpone') openDD(a, rv);
      else if (a === 'delete') { const q = queue[cur]; if (q.occ) A().askScope(`Delete \u201c${esc(q.title)}\u201d`, sc => A().startDelete(q.key, sc)); else A().startDelete(q.key); }
      else if (a === 'undo-delete') A().undoDelete();
      return;
    }
    const mp = e.target.closest('[data-past]'); if (mp) { moveToPast(mp.dataset.past); return; }
    A().closeAll();
  }
  function onKey(e) {
    if (!root || e.key === 'Escape' || A().hasDialog() || !$('#cx-ov').hidden || (e.target && e.target.tagName === 'INPUT') || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = dd();
    if (el && !el.hidden) {
      const opts = [...el.querySelectorAll('.ci[data-st]')], i = opts.findIndex(o => o.classList.contains('kbsel'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = (i + (e.key === 'ArrowDown' ? 1 : opts.length - 1 + (i < 0 ? 1 : 0))) % opts.length; opts.forEach((o, j) => o.classList.toggle('kbsel', j === n)); return; }
      if (e.key === 'Enter' && i >= 0) { e.preventDefault(); opts[i].dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    }
    const sts = queue.map(status); if (!sts.includes('pending')) return;
    if (e.key === 'ArrowRight') nav(1);
    else if (e.key === 'ArrowLeft') nav(-1);
    else if ((e.key === 'd' || e.key === 'D') && sts[cur] === 'pending') rvDone();
    else if ((e.key === 'p' || e.key === 'P') && sts[cur] === 'pending' && queue[cur].kind !== 'fixed') { const b = $('[data-rv="postpone"]', root); if (b) openDD('postpone', b); }
    else if ((e.key === 'h' || e.key === 'H') && sts[cur] === 'pending' && queue[cur].kind !== 'fixed') { const b = $('[data-rv="partial"]', root); if (b) openDD('partial', b); }
  }

  C.screen('review', {
    mount(el) {
      root = el; cur = 0; prevSts = null; animateCard = true;
      queue = C.solver.reviewQueue();
      el.innerHTML = '<div class="progress" id="cx-progress"></div><div class="rvwrap"><div class="rvscroll" id="cx-scroll"><div id="cx-review"></div></div></div>';
      const menu = document.createElement('div'); menu.className = 'cmenu rdd'; menu.id = 'rv-dd'; menu.hidden = true; $('#cx-app').appendChild(menu);
      A().wireStaged(menu);
      Object.assign(C.view, { render: () => render(), adjust: adjustSchedule, closeDD, closePop: closeDD });
      $('#cx-scroll', el).addEventListener('scroll', () => A().closeAll());
      $('#cx-app').addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      render();
    },
    unmount() {
      $('#cx-app').removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      A().resetView();
      const m = dd(); if (m) m.remove();
      root = null;
    },
    refresh() { render(); },
  });
})(window.Chrona = window.Chrona || {});
