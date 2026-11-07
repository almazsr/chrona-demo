(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, svg } = C;
  const IC = C.icons, S = C.store.state;
  let root = null, showRef = null;

  // ---------- grouping and filtering ----------
  const BUCKETS = [['earlier', 'Earlier'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['next', 'Next week'], ['later', 'Later']];
  const dayBucket = d => d < C.clock.today ? 'earlier' : d === C.clock.today ? 'today' : d === C.clock.today + 1 ? 'tomorrow' : d <= C.clock.weekEnd ? 'week' : d <= C.clock.weekEnd + 7 ? 'next' : 'later';
  const dlBucket = t => t == null ? 'none' : t < C.clock.now ? 'earlier' : dayBucket(dayOf(t));
  const netBucket = t => t == null ? 'none' : dayBucket(dayOf(t));
  const prKey = p => prName(p) || 'other';
  const CAT_ICON = svg('<circle cx="8" cy="8" r="4.5"/>');
  const GROUPS = [['time', 'Time', IC.clock], ['cat', 'Category', CAT_ICON], ['pr', 'Priority', IC.flag], ['dl', 'Deadline', IC.deadline], ['net', 'Not earlier than', IC.net]];
  const timef = () => {
    const { today, weekStart, weekEnd } = C.clock, ma = today + 1 - dateOf(today).getDate(), mb = ma + new Date(dateOf(today).getFullYear(), dateOf(today).getMonth() + 1, 0).getDate() - 1;
    return {
      today: { label: 'Today', a: today, b: today },
      tt: { label: 'Today & tomorrow', a: today, b: today + 1 },
      week: { label: 'This week', a: weekStart, b: weekEnd },
      '2w': { label: 'Current 2 weeks', a: weekStart, b: weekEnd + 7 },
      month: { label: 'This month', a: ma, b: mb },
    };
  };
  const PR_OPTS = [['asap', 'asap'], ['next', 'next'], ['normal', 'normal'], ['low', 'low'], ['other', 'Other numbers']];
  const DL_OPTS = [['earlier', 'Overdue'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['next', 'Next week'], ['later', 'Later'], ['none', 'No deadline']];
  const NET_OPTS = [['earlier', 'Earlier'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['next', 'Next week'], ['later', 'Later'], ['none', 'Not set']];
  // an empty set means "All"
  const defFilters = () => ({ time: '2w', cats: new Set(), prs: new Set(), dl: new Set(), net: new Set() });
  let groupBy = 'time', filters = defFilters(), openSec = new Set(['time']), collapsed = new Set(['time:earlier']);
  const inTime = it => { const d = dayOf(it.s), f = timef()[filters.time]; return d >= f.a && d <= f.b; };
  const pass = (set, v) => !set.size || set.has(v);
  const passOthers = it => pass(filters.cats, it.cat) && pass(filters.prs, prKey(it.pr)) && pass(filters.dl, dlBucket(it.dl)) && pass(filters.net, netBucket(it.net));
  const othersActive = () => ['cats', 'prs', 'dl', 'net'].some(k => filters[k].size);

  function groupsOf(rows) {
    const g = new Map(), add = (k, label, it) => { if (!g.has(k)) g.set(k, { key: k, label, rows: [] }); g.get(k).rows.push(it); };
    let order;
    if (groupBy === 'time') { order = BUCKETS.map(x => x[0]); for (const it of rows) { const b = dayBucket(dayOf(it.s)); add(b, BUCKETS.find(x => x[0] === b)[1], it); } }
    else if (groupBy === 'cat') { order = [...new Set([...S.cats.map(c => c.id), ...rows.map(it => it.cat)])]; for (const it of rows) add(it.cat, C.catOf(it.cat).name, it); }
    else if (groupBy === 'pr') { for (const it of rows) add(String(it.pr), prName(it.pr) ? `${prName(it.pr)}` : `Priority ${it.pr}`, it); order = [...g.keys()].sort((a, b) => a - b); }
    else if (groupBy === 'dl') { order = DL_OPTS.map(x => x[0]); for (const it of rows) { const b = dlBucket(it.dl); add(b, DL_OPTS.find(x => x[0] === b)[1], it); } }
    else { order = NET_OPTS.map(x => x[0]); for (const it of rows) { const b = netBucket(it.net); add(b, NET_OPTS.find(x => x[0] === b)[1], it); } }
    return order.filter(k => g.has(k)).map(k => { const gr = g.get(k); gr.rows.sort((x, y) => x.s - y.s || x.e - y.e); return gr; });
  }

  // ---------- row parts ----------
  const PR_EMOJI = { 1: '🔥', 2: '⚡', 10: '💤' };
  const prCell = p => PR_EMOJI[p] || (p === DEF_PR ? '' : `<span class="pn">${p}</span>`);
  function dlChip(it) {
    if (it.dl == null) return '';
    const d = dayOf(it.dl), over = it.dl < C.clock.now;
    if (!over && d > C.clock.today + 1) return '';
    const cls = it.done ? 'met' : over || d === C.clock.today ? 'today' : 'tmr', txt = over ? `overdue ${fmtDay(d).slice(0, 5)} ${hm(it.dl)}` : `${d === C.clock.today ? 'today' : 'tmr'} ${hm(it.dl)}`;
    return `<span class="dlc ${cls}" title="Deadline ${fmtWhen(it.dl)}">${IC.deadline}${txt}</span>`;
  }
  const MORE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>';
  const RB = (a, icon, tip, cls = '') => `<button class="rb${cls}" data-ract="${a}" data-tip="${tip}">${icon}</button>`;
  function rowHtml(it) {
    const bad = it.unmet && it.unmet.length, pn = prName(it.pr);
    const cls = ['lrow', it.done ? 'done' : '', bad ? 'bad' : '', C.actions.isTbd(it) ? 'tbd' : '', !$('#cx-cmenu').hidden && $('#cx-cmenu').dataset.k === it.key ? 'sel' : ''].filter(Boolean).join(' ');
    const pc = prCell(it.pr);
    return `<div class="${cls}" data-k="${it.key}" data-s="${it.s}">`
      + `<span class="cb${it.done ? ' on' : ''}" data-cb="1" title="${it.done ? 'Mark as not done' : 'Mark as done'}"></span>`
      + `<i class="cdot" style="background:${C.catOf(it.cat).color}" title="${esc(C.catOf(it.cat).name)}"></i>`
      + dlChip(it)
      + `<span class="tt">${esc(it.title)}</span><span class="du">(${fmtDur(it.e - it.s)})</span>${it.part ? `<span class="pt">· part ${it.part}</span>` : ''}`
      + (it.kind === 'fixed' ? `<span class="lk" title="Fixed">${IC.lock}</span>` : '')
      + (pc ? `<span class="pe" title="Priority: ${esc(pn ? `${pn} (${it.pr})` : it.pr)}">${pc}</span>` : '')
      + (bad ? '<span class="warn" data-warn="1" title="Unmet constraints">!</span>' : '')
      + `<span class="gap"></span><span class="rbs">${RB('edit', IC.edit, 'Edit')}${RB('delete', IC.trash, 'Delete', ' del')}${RB('more', MORE, 'Actions')}</span></div>`;
  }

  // ---------- render ----------
  let form = null, fhEl = null, focusRef = null, rowRefs = new Map();
  function render() {
    const all = C.solver.items(), timed = all.filter(inTime), rows = timed.filter(passOthers), hidden = timed.length - rows.length;
    const f = timef()[filters.time];
    $('#l-sub').textContent = f.a === f.b ? `${f.label} · ${fmtDay(f.a)}` : `${f.label} · ${fmtDay(f.a).slice(0, 5)} – ${fmtDay(f.b)}`;
    $('#l-info').innerHTML = `${rows.length} time block${rows.length === 1 ? '' : 's'}${hidden ? ` · ${hidden} hidden by filters · <span data-reset="1">Reset filters</span>` : ''}`;
    rowRefs = new Map(all.map(it => [it.key, it.ref]));
    let h = '', editShown = false;
    const groups = groupsOf(rows);
    for (const g of groups) {
      const ck = `${groupBy}:${g.key}`, coll = collapsed.has(ck), total = g.rows.reduce((a, it) => a + it.e - it.s, 0);
      const icon = groupBy === 'pr' ? `<span class="pe">${prCell(+g.key) || ''}</span>` : groupBy === 'cat' ? `<i style="width:9px;height:9px;border-radius:50%;background:${C.catOf(g.key).color}"></i>` : '';
      h += `<div class="grp${coll ? ' coll' : ''}"><div class="ghead" data-grp="${esc(ck)}"><span class="car">▸</span>${icon}<b>${esc(g.label)}</b><span class="gc">${g.rows.length}</span><span class="gd">${fmtDur(total)}</span></div><div class="rows">`;
      let nowShown = false;
      for (const it of g.rows) {
        if (groupBy === 'time' && g.key === 'today' && !nowShown && it.s >= C.clock.now) { h += `<div class="nowl"><span>${hm(C.clock.now)}</span></div>`; nowShown = true; }
        if (form && form.mode === 'edit' && form.key === it.key) { h += '<div data-fh="1"></div>'; editShown = true; continue; }
        h += rowHtml(it);
      }
      h += '</div></div>';
    }
    if (!groups.length) h += `<div class="empty">No time blocks match these filters.${othersActive() || filters.time !== '2w' ? ' <span data-reset="1" style="color:#4a9ee8;cursor:pointer;font-weight:600">Reset filters</span>' : ''}</div>`;
    if (form && form.mode === 'new') h += '<div data-fh="1"></div>';
    else h += '<div class="addrow" data-addrow="1"><span class="pl">+</span>Add time block</div>';
    $('#cx-list').innerHTML = h;
    if (form && form.mode === 'edit' && !editShown) { form = null; fhEl = null; }
    const ph = $('#cx-list [data-fh]'); if (ph && fhEl) ph.replaceWith(fhEl);
    renderSide();
  }
  function renderAnimated() {
    const first = new Map();
    $$('#cx-list .lrow').forEach(r => { const rc = r.getBoundingClientRect(); if (rc.height) first.set(r.dataset.k, { top: rc.top, s: r.dataset.s }); });
    render();
    $$('#cx-list .lrow').forEach(r => {
      const f = first.get(r.dataset.k), rc = r.getBoundingClientRect();
      if (!rc.height) return;
      if (!f) { r.classList.add('appear'); return; }
      if (r.dataset.s !== f.s) r.classList.add('moved');
      const dy = f.top - rc.top; if (Math.abs(dy) < 1) return;
      r.style.transition = 'none'; r.style.transform = `translateY(${dy}px)`; r.style.zIndex = 2;
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; r.style.transform = ''; setTimeout(() => { r.style.zIndex = ''; }, 750); }));
    });
    if (focusRef) { const ref = focusRef; focusRef = null; if (!focusRows(ref)) missingRef = ref; }
  }
  let missingRef = null;
  function focusRows(ref) {
    const rows = $$('#cx-list .lrow').filter(r => rowRefs.get(r.dataset.k) === ref && r.getBoundingClientRect().height);
    if (!rows.length) return false;
    rows.forEach(r => { r.classList.remove('focus'); void r.offsetWidth; r.classList.add('focus'); });
    rows[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return true;
  }
  function revealRef(ref) {
    C.ui.hideToast(); if (!ref) return;
    if (focusRows(ref)) return;
    const it = C.solver.items().find(x => x.ref === ref); if (!it) return;
    if (!inTime(it) || !passOthers(it)) { filters = defFilters(); if (!inTime(it)) filters.time = 'month'; }
    collapsed = new Set([...collapsed].filter(k => !k.startsWith(groupBy + ':')));
    render(); focusRows(ref);
  }
  function adjustSchedule(msg, after) {
    C.actions.closeAll();
    $('#cx-progress').classList.add('on');
    setTimeout(() => {
      const moved = C.solver.replan();
      missingRef = null; renderAnimated(); $('#cx-progress').classList.remove('on');
      if (after) after(moved); else C.ui.toast(`${msg ? msg + ' · ' : ''}Schedule adjusted${moved ? ` · ${moved} time block${moved > 1 ? 's' : ''} moved` : ''}${missingRef ? ' · hidden by filters <span data-reveal="1">Show</span>' : ''}`, missingRef ? 6000 : 3200);
    }, 700);
  }


  // ---------- unmet constraints popover ----------
  const pop = () => $('#cx-pop');
  function openDetails(key, anchor) {
    const it = C.actions.byKey(key); if (!it || !it.unmet) return;
    C.actions.closeMenu();
    pop().innerHTML = `<span class="ib x" data-close="1">✕</span><h6><i style="background:${C.catOf(it.cat).color}"></i>${esc(it.title)}</h6><div style="font-weight:600;color:#b4232a">Unmet constraints</div><ul class="wlist">${it.unmet.map(u => `<li>${esc(u)}</li>`).join('')}</ul><div class="muted" style="margin-top:6px">Chrona placed it as close as it could. Edit, postpone, or free up time to fix this.</div>`;
    const r = anchor.getBoundingClientRect();
    C.ui.placeAt(pop(), r.left - 8, r.bottom + 6);
  }
  const closePop = () => { pop().hidden = true; };


  // ---------- sidebar: group by + filters ----------
  function renderSide() {
    const all = C.solver.items(), timed = all.filter(inTime), d = defFilters();
    let h = '<div class="sh">Group by</div>' + GROUPS.map(([k, label, icon]) => `<div class="gopt${groupBy === k ? ' on' : ''}" data-gb="${k}"><span class="ic">${icon}</span>${label}</div>`).join('');
    const anyActive = filters.time !== d.time || othersActive();
    h += `<div class="sdiv"></div><div class="sh">Filter<span class="rst" data-reset="1"${anyActive ? '' : ' hidden'}>Reset</span></div>`;
    const sec = (k, label, summary, act, body) => `<div class="fsec${openSec.has(k) ? ' open' : ''}"><div class="fhead" data-sec="${k}"><span class="car">▸</span><span class="fl">${label}</span><span class="fv${act ? ' act' : ''}">${esc(summary)}</span></div><div class="fbody">${body}</div></div>`;
    const opt = (radio, k, v, label, on, n, lead = '', tip = '') => `<div class="fopt${on ? ' on' : ''}" data-f="${k}" data-v="${esc(v)}"${tip ? ` title="${tip}"` : ''}><span class="bx${radio ? ' rd' : ''}"></span>${lead}<span class="lab">${label}</span>${n != null ? `<span class="n">${n}</span>` : ''}</div>`;
    const summary = (set, opts) => !set.size ? 'All' : set.size === 1 ? opts.find(o => set.has(o[0]))[1] : `${set.size} selected`;
    const span = f => f.a === f.b ? fmtDay(f.a).slice(0, 5) : `${fmtDay(f.a).slice(0, 5)}–${fmtDay(f.b).slice(0, 5)}`;
    const multi = (k, opts, countOf, lead = () => '') => opt(false, k, '__all', 'All', !filters[k].size, timed.length) + opts.map(([v, l]) => opt(false, k, v, l, filters[k].has(v), timed.filter(it => countOf(it) === v).length, lead(v))).join('');
    h += sec('time', 'Time', timef()[filters.time].label, filters.time !== d.time, Object.entries(timef()).map(([k, f]) => opt(true, 'time', k, f.label, filters.time === k, all.filter(it => { const dd = dayOf(it.s); return dd >= f.a && dd <= f.b; }).length, '', span(f))).join(''));
    const catOpts = S.cats.map(c => [c.id, esc(c.name)]);
    h += sec('cats', 'Category', summary(filters.cats, catOpts), filters.cats.size, multi('cats', catOpts, it => it.cat, c => `<i class="dot" style="background:${C.catOf(c).color}"></i>`));
    h += sec('prs', 'Priority', summary(filters.prs, PR_OPTS), filters.prs.size, multi('prs', PR_OPTS, it => prKey(it.pr), k => `<span style="width:16px;text-align:center">${k === 'other' ? '<span class="pn" style="font-size:9px;padding:0 3px">3</span>' : prCell(PRN[k])}</span>`));
    h += sec('dl', 'Deadline', summary(filters.dl, DL_OPTS), filters.dl.size, multi('dl', DL_OPTS, it => dlBucket(it.dl)));
    h += sec('net', 'Not earlier than', summary(filters.net, NET_OPTS), filters.net.size, multi('net', NET_OPTS, it => netBucket(it.net)));
    $('#cx-side').innerHTML = h;
  }
  function onSideClick(e) {
    e.stopPropagation(); C.actions.closeAll();
    const gb = e.target.closest('[data-gb]'); if (gb) { groupBy = gb.dataset.gb; render(); return; }
    if (e.target.closest('[data-reset]')) { filters = defFilters(); render(); return; }
    const sh = e.target.closest('[data-sec]'); if (sh) { const k = sh.dataset.sec; openSec.has(k) ? openSec.delete(k) : openSec.add(k); renderSide(); return; }
    const fo = e.target.closest('[data-f]'); if (!fo) return;
    const k = fo.dataset.f, v = fo.dataset.v;
    const total = { cats: S.cats.length, prs: PR_OPTS.length, dl: DL_OPTS.length, net: NET_OPTS.length };
    if (k === 'time') filters.time = v;
    else if (v === '__all') filters[k].clear();
    else { const set = filters[k]; set.has(v) ? set.delete(v) : set.add(v); if (set.size === total[k]) set.clear(); }
    render();
  }



  // ---------- form inline: below the list (new) or in place of the row (edit) ----------
  function openForm(mode, it, values) {
    C.actions.closeAll();
    form = { mode, key: it ? it.key : null };
    const host = document.createElement('div'); host.className = 'formhost'; fhEl = host;
    const close = silent => { form = null; fhEl = null; if (!silent) render(); };
    C.form.mount(host, {
      mode, occ: it && it.occ ? it.occ : null, values: it ? C.actions.valuesOf(it) : (values || {}), onCancel: () => close(),
      onSave: (data, scope) => { close(true); if (it && it.occ) C.actions.editOcc(it, data, scope); else C.actions.commitForm(data, it ? it.ref : null); },
    });
    render();
    setTimeout(() => host.scrollIntoView({ block: 'nearest' }), 40);
  }

  // ---------- events ----------
  function onClick(e) {
    if (e.target.closest('#cx-ov') || e.target.closest('#cx-cmenu') || e.target.closest('.formhost') || e.target.closest('.hdr')) return;
    if (e.target.closest('#cx-toast [data-show]')) { revealRef(showRef); return; }
    if (e.target.closest('#cx-toast [data-reveal]')) { revealRef(missingRef); return; }
    if (!root.contains(e.target) && !e.target.closest('#cx-pop')) return;
    if (e.target.closest('[data-reset]')) { filters = defFilters(); render(); return; }
    if (e.target.closest('#cx-pop [data-close]')) { closePop(); return; }
    const cb = e.target.closest('.lrow [data-cb]'); if (cb) { C.actions.toggleDone(cb.closest('.lrow').dataset.k); return; }
    const ra = e.target.closest('[data-ract]');
    if (ra) {
      const k = ra.closest('.lrow').dataset.k, a = ra.dataset.ract;
      if (a === 'more') { if (!$('#cx-cmenu').hidden && $('#cx-cmenu').dataset.k === k) { C.actions.closeMenu(); return; } const r = ra.getBoundingClientRect(); C.actions.openMenu(k, r.right - 210, r.bottom + 4); }
      else C.actions.runAction(a, k);
      return;
    }
    const warn = e.target.closest('.lrow [data-warn]'); if (warn) { openDetails(warn.closest('.lrow').dataset.k, warn); return; }
    const gh = e.target.closest('[data-grp]'); if (gh) { const k = gh.dataset.grp; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); C.actions.closeAll(); render(); return; }
    if (e.target.closest('[data-addrow]')) { openForm('new', null, {}); return; }
    if (e.target.closest('#cx-pop')) return;
    C.actions.closeAll();
  }

  C.screen('list', {
    mount(el) {
      root = el; form = null; fhEl = null;
      el.innerHTML = `<div class="lv"><aside class="side" id="cx-side"></aside><div class="lmain" id="cx-lmain">
        <div class="lbar"><h3>List</h3><span class="muted" id="l-sub"></span><span class="sp"></span><span class="muted" id="l-info"></span></div>
        <div class="progress" id="cx-progress"></div>
        <div class="lscroll" id="cx-scroll"><div id="cx-list"></div></div></div></div>`;
      Object.assign(C.view, {
        render: animated => (animated ? renderAnimated() : render()),
        adjust: adjustSchedule, openForm,
        showLink: (first, ref) => { if (!first || !ref) return ''; showRef = ref; return ' <span data-show="1">Show</span>'; },
        closePop,
      });
      Object.defineProperty(C.view, 'focusRef', { get: () => focusRef, set: v => { focusRef = v; }, configurable: true });
      $('#cx-side', el).addEventListener('click', onSideClick);
      $('#cx-list', el).addEventListener('contextmenu', e => { const row = e.target.closest('.lrow'); if (!row) return; e.preventDefault(); C.actions.openMenu(row.dataset.k, e.clientX, e.clientY); });
      $('#cx-scroll', el).addEventListener('scroll', () => { closePop(); C.actions.closeMenu(); });
      $('#cx-app').addEventListener('click', onClick);
      render();
    },
    unmount() { $('#cx-app').removeEventListener('click', onClick); C.actions.resetView(); root = null; },
    refresh() { if (!form) render(); },
  });
})(window.Chrona = window.Chrona || {});
