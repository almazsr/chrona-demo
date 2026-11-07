(function (C) {
  'use strict';
  // Time spaces and categories: presets, chips, week preview, popups, color rules.
  // Shared by setup (mockups 02, 03) and settings (mockup 04).
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SH = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const LIGHT_BLUE = '#8ec5f5';
  const PALETTE = [LIGHT_BLUE, '#f4a09c', '#f7b77a', '#f2d675', '#9fd89a', '#86d3c9', '#b9a6ef', '#f2a7d0', '#c8ad8f', '#b4bfca'];
  const PENCIL = '<svg width="12" height="12" viewBox="0 0 16 16"><path fill="currentColor" d="M11.3 1.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-8.5 8.5-3.4.9a.5.5 0 0 1-.6-.6l.9-3.4 8.2-8.8zM10.6 3.4 3.9 10.1l-.5 1.9 1.9-.5 6.7-6.7-1.4-1.4z"/></svg>';
  const st = () => C.store.state;
  const esc = s => C.esc(s);
  const norm = s => String(s || '').trim().toLowerCase();
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- time ----------
  const toM = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); if (!m) return null; const h = +m[1], mi = +m[2]; if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null; return h * 60 + mi; };
  const fmt = m => C.p2(Math.floor(m / 60)) + ':' + C.p2(m % 60);
  // weekday hours for Mon–Fri, weekend hours for Sat–Sun, as store ranges [[dow, start, end]]
  const week = (wd, we) => { const out = []; for (let d = 0; d < 7; d++) { const p = d < 5 ? wd : we; if (p) out.push([d, toM(p[0]), toM(p[1])]); } return out; };
  const daysOf = ranges => { const d = [[], [], [], [], [], [], []]; [...(ranges || [])].sort((a, b) => a[1] - b[1]).forEach(([dow, s, e]) => { if (d[dow]) d[dow].push([fmt(s), fmt(e)]); }); return d; };
  const rangesOf = days => { const out = []; days.forEach((r, dow) => r.map(([a, b]) => [toM(a), toM(b)]).sort((x, y) => x[0] - y[0]).forEach(([s, e]) => out.push([dow, s, e]))); return out; };
  function summary(sp) {
    const per = daysOf(sp.ranges).map(r => r.map(([a, b]) => `${a}\u2013${b}`).join(', '));
    const out = []; let i = 0;
    while (i < 7) { if (!per[i]) { i++; continue; } let j = i; while (j + 1 < 7 && per[j + 1] === per[i]) j++; out.push(`${j > i ? SH[i] + '\u2013' + SH[j] : SH[i]} ${per[i]}`); i = j + 1; }
    return out.join(' \u00b7 ') || 'No hours';
  }

  // ---------- presets (setup.feature) ----------
  const PRE_SPACES = [
    { key: 'business hours', ranges: week(['09:00', '18:00'], null) },
    { key: 'free time', ranges: week(['18:00', '22:00'], ['09:00', '22:00']) },
    { key: 'family time', ranges: week(['18:00', '21:00'], ['09:00', '21:00']) },
    { key: 'personal time', ranges: week(['07:00', '09:00'], ['07:00', '09:00']) },
    { key: 'meetings', ranges: week(['10:00', '14:00'], null) },
  ];
  const PRE_CATS = [
    { key: 'Work', rel: ['business hours'] }, { key: 'Family', rel: ['family time'] }, { key: 'Side hustle', rel: ['free time'] },
    { key: 'Gym', rel: ['personal time'] }, { key: 'Selfcare', rel: ['personal time'] }, { key: 'Other', rel: ['free time'] },
  ];
  // a saved item belongs to a preset by the key it was added with, or by its name
  const presetKey = (item, list) => { const k = item.key && list.find(p => norm(p.key) === norm(item.key)); if (k) return k.key; const n = list.find(p => norm(p.key) === norm(item.name)); return n ? n.key : null; };
  const spaceOfPreset = key => st().spaces.find(s => presetKey(s, PRE_SPACES) === key) || null;
  const catOfPreset = key => st().cats.find(c => presetKey(c, PRE_CATS) === key) || null;
  const spaceSuggestions = () => PRE_SPACES.filter(p => !spaceOfPreset(p.key)).map(p => p.key);
  const catSuggestions = () => PRE_CATS.filter(p => !catOfPreset(p.key)).map(p => p.key);
  const catsOfSpace = id => st().cats.filter(c => (c.spaces || []).includes(id));

  // ---------- colors and default (category.feature) ----------
  const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const near = (a, b) => { const x = rgb(a), y = rgb(b); return !!x && !!y && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 24; };
  function pickColor(exceptId) {
    const others = st().cats.filter(c => c.id !== exceptId);
    if (!others.length) return LIGHT_BLUE;
    const rest = PALETTE.filter(c => c !== LIGHT_BLUE);
    const free = rest.filter(c => !others.some(o => near(o.color, c)));
    const pool = free.length ? free : rest;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function ensureDefault() {
    const cs = st().cats; if (!cs.length) return;
    const defs = cs.filter(c => c.def);
    if (!defs.length) cs[0].def = true;
    else defs.slice(1).forEach(c => { c.def = false; });
  }

  // ---------- one-click add, remove with undo ----------
  function addPresetSpace(key) {
    const p = PRE_SPACES.find(x => x.key === key); if (!p) return null;
    const had = spaceOfPreset(key); if (had) return had;
    const sp = { id: C.store.id('s'), key: p.key, name: p.key, ranges: clone(p.ranges) };
    st().spaces.push(sp); C.store.save();
    return sp;
  }
  function presetCatValues(key) {
    const p = PRE_CATS.find(x => x.key === key); if (!p) return null;
    const spaces = p.rel.map(spaceOfPreset).filter(Boolean).map(s => s.id);
    return {
      id: null, key: p.key, name: p.key, color: pickColor(), spaces, def: !st().cats.length,
      note: spaces.length ? '' : `${p.key} is usually linked to \u201c${p.rel.join(', ')}\u201d, which you haven't added. Pick a time space for it.`,
    };
  }
  // returns { cat } when added, or { values } when the category needs the popup (no related time spaces)
  function addPresetCat(key) {
    const had = catOfPreset(key); if (had) return { cat: had };
    const v = presetCatValues(key); if (!v) return {};
    if (!v.spaces.length) return { values: v };
    const cat = { id: C.store.id('c'), key: v.key, name: v.name, color: v.color, def: v.def, fixed: false, spaces: v.spaces };
    st().cats.push(cat); ensureDefault(); C.store.save();
    return { cat };
  }
  const snapshot = () => clone({ spaces: st().spaces, cats: st().cats });
  function removeSpace(id) {
    const snap = snapshot(), sp = C.store.space(id); if (!sp) return null;
    st().spaces = st().spaces.filter(s => s.id !== id);
    st().cats.forEach(c => { c.spaces = (c.spaces || []).filter(x => x !== id); });
    C.store.save();
    return { snapshot: snap, name: sp.name };
  }
  function removeCat(id) {
    const snap = snapshot(), cat = C.store.cat(id); if (!cat) return null;
    st().cats = st().cats.filter(c => c.id !== id);
    ensureDefault(); C.store.save();
    return { snapshot: snap, name: cat.name };
  }
  function restore(snap) { if (!snap) return; st().spaces = snap.spaces; st().cats = snap.cats; C.store.save(); }

  // ---------- chips (setup chat) ----------
  const spaceChip = (s, live) => live
    ? `<span class="sc-chip saved" data-sc="rm-space" data-id="${esc(s.id)}" title="Click to remove">\u2713 ${esc(s.name)}<span class="sc-edit" data-sc="edit-space" data-id="${esc(s.id)}" title="Edit">${PENCIL}</span></span>`
    : `<span class="sc-chip saved static">\u2713 ${esc(s.name)}</span>`;
  const catChip = (c, live) => {
    const inner = `\u2713 <i class="sc-cdot" style="background:${esc(c.color)}"></i>${esc(c.name)}${c.def ? ' <em class="sc-def">default</em>' : ''}`;
    return live
      ? `<span class="sc-chip saved" data-sc="rm-cat" data-id="${esc(c.id)}" title="Click to remove">${inner}<span class="sc-edit" data-sc="edit-cat" data-id="${esc(c.id)}" title="Edit">${PENCIL}</span></span>`
      : `<span class="sc-chip saved static">${inner}</span>`;
  };
  function chips(presets, saved, ofPreset, chip, kind, live) {
    const shown = new Set(); let h = '';
    for (const p of presets) {
      const s = ofPreset(p.key);
      if (s) { shown.add(s.id); h += chip(s, live); } else if (live) h += `<span class="sc-chip" data-sc="pre-${kind}" data-key="${esc(p.key)}" title="Click to add">${esc(p.key)}</span>`;
    }
    for (const s of saved) if (!shown.has(s.id)) h += chip(s, live);
    if (live) h += `<span class="sc-chip add" data-sc="custom-${kind}">custom (+)</span>`;
    return h;
  }
  const spaceChips = live => chips(PRE_SPACES, st().spaces, spaceOfPreset, spaceChip, 'space', live);
  const catChips = live => chips(PRE_CATS, st().cats, catOfPreset, catChip, 'cat', live);

  // ---------- week preview ----------
  function dayItems(day) {
    const items = [];
    for (const sp of st().spaces) for (const [dow, a, b] of sp.ranges || []) if (dow === day && b > a) items.push({ id: sp.id, name: sp.name, A: a, B: b, cats: catsOfSpace(sp.id) });
    return items.sort((x, y) => x.A - y.A || y.B - x.B);
  }
  // render the week preview into el; opts.onBand(spaceId) makes bands clickable
  function weekPreview(el, opts = {}) {
    let min = 24 * 60;
    for (const sp of st().spaces) for (const r of sp.ranges || []) if (r[2] > r[1]) min = Math.min(min, r[1]);
    const H0 = Math.min(6, Math.floor(min / 180) * 3), SPAN = (24 - H0) * 60;
    el.classList.add('sc-wkwrap');
    el._sc = { H0, SPAN, opts };
    let h = '<div></div>' + SH.map(d => `<div class="sc-hd">${d}</div>`).join('');
    const marks = []; for (let x = Math.ceil(H0 / 3) * 3; x <= 24; x += 3) marks.push(x);
    h += '<div class="sc-hrs">' + marks.map(x => `<span style="top:${(x - H0) / (24 - H0) * 100}%">${C.p2(x)}</span>`).join('') + '</div>';
    for (let i = 0; i < 7; i++) {
      const items = dayItems(i), clusters = []; let cl = [], end = -1;
      for (const it of items) { if (cl.length && it.A >= end) { clusters.push(cl); cl = []; end = -1; } cl.push(it); end = Math.max(end, it.B); }
      if (cl.length) clusters.push(cl);
      for (const c of clusters) { const lanes = []; for (const it of c) { let l = lanes.findIndex(e => e <= it.A); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = it.B; it.lane = l; } for (const it of c) it.n = lanes.length; }
      h += `<div class="sc-col" data-day="${i}" style="background-size:100% calc(100% / ${24 - H0})">` + items.map(it => {
        const top = Math.max(it.A, H0 * 60), bot = Math.min(it.B, 24 * 60); if (bot <= top) return '';
        return `<div class="sc-band${opts.onBand ? ' click' : ''}" data-band="${esc(it.id)}" style="top:${(top - H0 * 60) / SPAN * 100}%;height:${(bot - top) / SPAN * 100}%;left:calc(${it.lane * 100 / it.n}% + 2px);width:calc(${100 / it.n}% - 4px)">${esc(it.name)}<div class="sc-bd">${it.cats.map(c => `<i style="background:${esc(c.color)}"></i>`).join('')}</div></div>`;
      }).join('') + '</div>';
    }
    el.innerHTML = `<div class="sc-wk">${h}</div><div class="sc-tip"></div>`;
    if (!el._scBound) { bindWeek(el); el._scBound = true; }
  }
  function bindWeek(el) {
    const line = document.createElement('div'); line.className = 'sc-hline';
    const hide = () => { const tip = el.querySelector('.sc-tip'); if (tip) tip.style.display = 'none'; line.remove(); };
    el.addEventListener('mousemove', e => {
      const col = e.target.closest('.sc-col'), tip = el.querySelector('.sc-tip'); if (!col || !tip) { hide(); return; }
      const { H0, SPAN, opts } = el._sc, r = col.getBoundingClientRect(), i = +col.dataset.day;
      let m = H0 * 60 + (e.clientY - r.top) / r.height * SPAN;
      m = Math.max(H0 * 60, Math.min(24 * 60, Math.round(m / 15) * 15));
      if (line.parentNode !== col) col.appendChild(line);
      line.style.top = ((m - H0 * 60) / SPAN * 100) + '%';
      const here = dayItems(i).filter(it => it.A <= m && m < it.B);
      tip.innerHTML = `<b>${DAYS[i]} ${fmt(m)}</b><br>` + (here.length
        ? here.map(it => `${esc(it.name)} \u00b7 ${fmt(it.A)}\u2013${fmt(it.B)}` + (st().cats.length ? '<br>&nbsp;&nbsp;' + (it.cats.length ? it.cats.map(c => `<i style="background:${esc(c.color)}"></i>${esc(c.name)}`).join(' ') : '<span class="sc-dim">no categories</span>') : '')).join('<br>') + (opts.onBand ? '<br><span class="sc-dim">Click to edit</span>' : '')
        : '<span class="sc-dim">No time space</span>');
      tip.style.display = 'block';
      const pr = el.getBoundingClientRect();
      let x = e.clientX - pr.left + 14, y = e.clientY - pr.top + 14;
      if (x + tip.offsetWidth > pr.width - 6) x = e.clientX - pr.left - tip.offsetWidth - 14;
      if (y + tip.offsetHeight > pr.height - 6) y = e.clientY - pr.top - tip.offsetHeight - 10;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-band]'), o = el._sc.opts;
      if (b && o.onBand) { hide(); o.onBand(b.dataset.band); }
    });
  }

  // ---------- popups ----------
  // P: the open popup { kind: 'space' | 'cat', v: values, errs, msg, addOpen, opts, el }
  let P = null;
  function persist() { if (P && P.opts.persist) { st().session.draft = { kind: P.kind, values: clone(P.v) }; C.store.save(); } }
  function close() {
    const o = P ? P.opts : {};
    if (o.persist) { st().session.draft = null; C.store.save(); }
    P = null; C.ui.closeModal();
    if (o.onClose) o.onClose();
  }
  function open(kind, values, opts = {}) {
    const v = clone(values || {});
    if (kind === 'space') {
      if (!Array.isArray(v.days) || v.days.length !== 7) v.days = daysOf(week(['09:00', '18:00'], null));
      v.days = v.days.map(r => (Array.isArray(r) ? r : []).map(p => [String(p[0] ?? ''), String(p[1] ?? '')]));
      v.cats = (v.cats || []).filter(id => C.store.cat(id));
    } else {
      v.spaces = (v.spaces || []).filter(id => C.store.space(id));
      v.def = !!v.def;
    }
    v.name = String(v.name ?? '');
    if (v.id && !(kind === 'space' ? C.store.space(v.id) : C.store.cat(v.id))) v.id = null;
    const ov = C.ui.modal(`<div class="modal sc-pop sc-${kind}"></div>`);
    ov.onclick = null;
    P = { kind, v, errs: new Set(), msg: '', addOpen: false, opts, el: ov.querySelector('.sc-pop') };
    P.el.addEventListener('input', onInput);
    P.el.addEventListener('click', onClick);
    P.el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    render(); persist();
    const name = P.el.querySelector('[data-f="name"]');
    if (name && !v.name) name.focus();
  }
  const render = () => { if (P) (P.kind === 'space' ? renderSpace : renderCat)(); };

  function parsed(r) { return r.map(([a, b]) => [toM(a), toM(b)]).filter(([a, b]) => a != null && b != null && b > a).sort((x, y) => x[0] - y[0]); }
  function fullyCovered(r) { let end = 0; for (const [a, b] of parsed(r)) { if (a > end) return false; end = Math.max(end, b); } return end >= 1440; }
  function nextRange(r) {
    if (!r.length) return ['09:00', '18:00'];
    const v = parsed(r), gaps = []; let end = 0;
    for (const [a, b] of v) { if (a > end) gaps.push([end, a]); end = Math.max(end, b); }
    if (end < 1440) gaps.push([end, 1440]);
    const last = v.length ? Math.max(...v.map(x => x[1])) : 0;
    const g = gaps.find(([a]) => a >= last) || gaps[0] || [0, 60];
    return [fmt(g[0]), fmt(Math.min(g[0] + 60, g[1]))];
  }

  function renderSpace() {
    const { v, errs } = P, editing = v.id ? C.store.space(v.id) : null, cats = st().cats;
    const rows = v.days.map((r, i) => {
      const on = r.length > 0;
      const ranges = on ? r.map(([a, b], j) => `<div class="sc-rg"><input class="sc-tm${errs.has(`${i}-${j}-a`) ? ' sc-err' : ''}" data-day="${i}" data-r="${j}" data-k="0" value="${esc(a)}" placeholder="hh:mm">\u2013<input class="sc-tm${errs.has(`${i}-${j}-b`) ? ' sc-err' : ''}" data-day="${i}" data-r="${j}" data-k="1" value="${esc(b)}" placeholder="hh:mm"><span class="sc-ib" data-m="rm" data-day="${i}" data-r="${j}" title="Remove range">\u2212</span></div>`).join('') : '<span class="muted">None</span>';
      const plus = fullyCovered(r) ? '<span></span>' : `<span class="sc-ib" data-m="add" data-day="${i}" title="Add range">+</span>`;
      return `<div class="sc-day"><span class="sc-tg${on ? ' on' : ''}" data-m="tg" data-day="${i}" title="${on ? 'Not available' : 'Available'}"></span><span class="sc-dn${on ? '' : ' off'}">${DAYS[i]}</span><div class="sc-ranges">${ranges}</div>${plus}</div>`;
    }).join('');
    let links;
    if (!cats.length) links = '<span class="muted">Categories can be linked after you add them</span>';
    else {
      const free = cats.filter(c => !v.cats.includes(c.id));
      links = (v.cats.length ? v.cats.map((id, j) => { const c = C.store.cat(id); return `<div class="sc-lrow"><span class="sc-cd"><i style="background:${esc(c.color)}"></i>${esc(c.name)}</span><span class="sc-ib" data-m="rml" data-j="${j}" title="Unlink">\u2212</span></div>`; }).join('') : '<span class="muted">No categories linked</span>')
        + (free.length ? `<div class="sc-addl"><span class="sc-ib" data-m="addl" title="Link category">+</span>${P.addOpen ? free.map(c => `<span class="sc-opt" data-m="pickl" data-id="${esc(c.id)}"><i style="background:${esc(c.color)}"></i>${esc(c.name)}</span>`).join('') : ''}</div>` : '');
    }
    P.el.innerHTML = `<h5>${editing ? 'Edit time space' : 'New time space'}</h5>
      ${P.msg ? `<div class="sc-etoast">\u26a0 ${esc(P.msg)}</div>` : ''}
      <div class="sc-field"><label>Name</label><input class="sc-tin${errs.has('name') ? ' sc-err' : ''}" data-f="name" value="${esc(v.name)}" placeholder="e.g. Deep work mornings"></div>
      <div class="sc-field sc-tight"><label class="sc-lab2">Weekly availability <span class="sc-link" data-m="all">Apply to all days</span></label></div>
      <div class="sc-days">${rows}</div>
      <div class="sc-field sc-links${errs.has('links') ? ' sc-err sc-errbox' : ''}"><label>Linked categories</label>${links}</div>
      <div class="actions"><span class="b" data-m="cancel">Cancel</span><span class="b p" data-m="save">Save</span></div>`;
  }

  function renderCat() {
    const { v, errs } = P, editing = v.id ? C.store.cat(v.id) : null, cats = st().cats, spaces = st().spaces;
    const locked = (editing && editing.def) || (!editing && !cats.length);
    if (locked) v.def = true;
    const hint = locked ? (editing ? 'Mark another category as default to change it' : 'The first category is the default') : 'Used when a task has no category';
    const usedBy = col => cats.find(k => k.color === col && (!editing || k.id !== editing.id));
    const free = spaces.filter(s => !v.spaces.includes(s.id));
    P.el.innerHTML = `<h5>${editing ? 'Edit category' : 'New category'}</h5>
      ${P.msg ? `<div class="sc-etoast">\u26a0 ${esc(P.msg)}</div>` : ''}
      ${v.note && !P.msg ? `<div class="muted sc-note">${esc(v.note)}</div>` : ''}
      <div class="sc-field"><label>Name</label><input class="sc-tin${errs.has('name') ? ' sc-err' : ''}" data-f="name" value="${esc(v.name)}" placeholder="e.g. Learning"></div>
      <div class="sc-field"><label>Color</label><div class="sc-sw${errs.has('color') ? ' sc-err sc-errbox' : ''}">${PALETTE.map(c => { const u = usedBy(c); return `<span data-m="color" data-c="${c}" class="${c === v.color ? 'sel' : ''}${u ? ' used' : ''}" style="background:${c}" title="${u ? `Used by ${esc(u.name)}` : ''}"></span>`; }).join('')}</div></div>
      <div class="sc-field"><label>Linked time spaces</label><div class="${errs.has('ts') ? 'sc-err sc-errbox' : ''}">
        ${v.spaces.length ? v.spaces.map((id, j) => `<div class="sc-lrow"><span>${esc(C.store.space(id).name)}</span><span class="sc-ib" data-m="rml" data-j="${j}" title="Unlink">\u2212</span></div>`).join('') : `<span class="muted">${spaces.length ? 'No time spaces linked' : 'Add a time space first'}</span>`}
        ${free.length ? `<div class="sc-addl"><span class="sc-ib" data-m="addl" title="Link time space">+</span>${P.addOpen ? free.map(s => `<span class="sc-opt" data-m="pickl" data-id="${esc(s.id)}">${esc(s.name)}</span>`).join('') : ''}</div>` : ''}
      </div></div>
      <div class="sc-field sc-last"><div class="sc-tgrow"><span class="sc-tg${v.def ? ' on' : ''}${locked ? ' dis' : ''}" data-m="${locked ? '' : 'def'}"></span><b>Default</b><span class="muted">${hint}</span></div></div>
      <div class="actions"><span class="b" data-m="cancel">Cancel</span><span class="b p" data-m="save">Save</span></div>`;
  }

  function onInput(e) {
    if (!P) return;
    const t = e.target;
    if (t.dataset.f === 'name') P.v.name = t.value;
    else if (t.dataset.day != null && t.dataset.k != null) { const r = P.v.days[+t.dataset.day][+t.dataset.r]; if (r) r[+t.dataset.k] = t.value; }
    else return;
    persist();
  }
  function onClick(e) {
    if (!P) return;
    const t = e.target.closest('[data-m]'); if (!t || !t.dataset.m) return;
    const m = t.dataset.m, v = P.v;
    if (m === 'cancel') { close(); return; }
    if (m === 'save') { if (P.kind === 'space') saveSpace(); else saveCat(); return; }
    if (m === 'addl') P.addOpen = !P.addOpen;
    else if (P.kind === 'space') {
      const i = +t.dataset.day;
      if (m === 'tg') v.days[i] = v.days[i].length ? [] : [['09:00', '18:00']];
      else if (m === 'add') v.days[i].push(nextRange(v.days[i]));
      else if (m === 'rm') v.days[i].splice(+t.dataset.r, 1);
      else if (m === 'all') { const src = v.days[0]; v.days = v.days.map(() => src.map(p => [p[0], p[1]])); }
      else if (m === 'pickl') { if (!v.cats.includes(t.dataset.id)) v.cats.push(t.dataset.id); P.addOpen = false; }
      else if (m === 'rml') v.cats.splice(+t.dataset.j, 1);
      else return;
      P.errs = new Set(); P.msg = '';
    } else {
      if (m === 'color') v.color = t.dataset.c;
      else if (m === 'pickl') { if (!v.spaces.includes(t.dataset.id)) v.spaces.push(t.dataset.id); P.addOpen = false; }
      else if (m === 'rml') v.spaces.splice(+t.dataset.j, 1);
      else if (m === 'def') v.def = !v.def;
      else return;
    }
    render(); persist();
  }

  function finish(item, info) {
    const o = P.opts;
    if (o.persist) st().session.draft = null;
    C.store.save();
    P = null; C.ui.closeModal();
    if (o.onSave) o.onSave(item, info);
  }

  function saveSpace() {
    const v = P.v, errs = new Set(), msgs = [];
    if (!v.name.trim()) { errs.add('name'); msgs.push('Please, enter a name'); }
    v.days.forEach((r, i) => {
      const ok = [];
      r.forEach(([a, b], j) => {
        const A = toM(a), B = toM(b);
        if (A == null) { errs.add(`${i}-${j}-a`); msgs.push(String(a).trim() ? 'Please, correct the time range' : 'Please, enter a start time'); }
        if (B == null) { errs.add(`${i}-${j}-b`); msgs.push(String(b).trim() ? 'Please, correct the time range' : 'Please, enter an end time'); }
        if (A != null && B != null) { if (B <= A) { errs.add(`${i}-${j}-a`); errs.add(`${i}-${j}-b`); msgs.push('Please, correct the time range'); } else ok.push([A, B, j]); }
      });
      ok.sort((x, y) => x[0] - y[0]);
      for (let k = 1; k < ok.length; k++) if (ok[k][0] < ok[k - 1][1]) { for (const q of [ok[k], ok[k - 1]]) { errs.add(`${i}-${q[2]}-a`); errs.add(`${i}-${q[2]}-b`); } msgs.push('Please, correct the time range'); }
    });
    const editing = v.id ? C.store.space(v.id) : null;
    if (editing) for (const c of st().cats) if (!v.cats.includes(c.id) && (c.spaces || []).length === 1 && c.spaces[0] === editing.id) { errs.add('links'); msgs.push(`\u201c${c.name}\u201d must keep at least one time space`); }
    if (errs.size) { P.errs = errs; P.msg = msgs[0]; render(); return; }
    const ranges = rangesOf(v.days);
    let sp = editing;
    const isNew = !sp, before = sp ? JSON.stringify(sp.ranges) : '';
    if (sp) { sp.name = v.name.trim(); sp.ranges = ranges; } else { sp = { id: C.store.id('s'), key: v.key || null, name: v.name.trim(), ranges }; st().spaces.push(sp); }
    let linksChanged = false;
    for (const c of st().cats) {
      c.spaces = c.spaces || [];
      const has = c.spaces.includes(sp.id), want = v.cats.includes(c.id);
      if (want && !has) { c.spaces.push(sp.id); linksChanged = true; }
      if (!want && has) { c.spaces = c.spaces.filter(x => x !== sp.id); linksChanged = true; }
    }
    finish(sp, { isNew, rangesChanged: isNew || before !== JSON.stringify(ranges), linksChanged });
  }

  function saveCat() {
    const v = P.v, errs = new Set(), msgs = [];
    v.spaces = v.spaces.filter(id => C.store.space(id));
    if (!v.name.trim()) { errs.add('name'); msgs.push('Please, enter a name'); }
    if (!v.spaces.length) { errs.add('ts'); msgs.push('Please, select at least one time space'); }
    if (!v.color) { errs.add('color'); msgs.push('Please, select a color'); }
    if (errs.size) { P.errs = errs; P.msg = msgs[0]; render(); return; }
    const cats = st().cats, editing = v.id ? C.store.cat(v.id) : null;
    const wasDef = !!(editing && editing.def);
    if (v.def) cats.forEach(c => { c.def = false; });
    let cat = editing;
    const isNew = !cat, before = cat ? [...(cat.spaces || [])].sort().join() : '';
    if (cat) Object.assign(cat, { name: v.name.trim(), color: v.color, spaces: [...v.spaces], def: v.def || wasDef });
    else { cat = { id: C.store.id('c'), key: v.key || null, name: v.name.trim(), color: v.color, def: v.def, fixed: false, spaces: [...v.spaces] }; cats.push(cat); }
    ensureDefault();
    finish(cat, { isNew, spacesChanged: isNew || before !== [...cat.spaces].sort().join() });
  }

  const newSpaceValues = () => ({ id: null, key: null, name: '', days: daysOf(week(['09:00', '18:00'], null)), cats: [] });
  const newCatValues = () => ({ id: null, key: null, name: '', color: pickColor(), spaces: [], def: !st().cats.length, note: '' });

  C.sc = {
    DAYS, SH, LIGHT_BLUE, PALETTE, PENCIL, PRE_SPACES, PRE_CATS,
    toM, fmt, daysOf, rangesOf, summary, catsOfSpace,
    spaceSuggestions, catSuggestions, pickColor, ensureDefault,
    addPresetSpace, addPresetCat, removeSpace, removeCat, restore,
    spaceChips, catChips, week: weekPreview,
    // opts: { persist: keep values in session.draft (setup), onSave(item, info), onClose() }
    newSpace: opts => open('space', newSpaceValues(), opts),
    editSpace(id, opts) { const sp = C.store.space(id); if (sp) open('space', { id, key: sp.key || null, name: sp.name, days: daysOf(sp.ranges), cats: catsOfSpace(id).map(c => c.id) }, opts); },
    newCat: (opts, values) => open('cat', values || newCatValues(), opts),
    editCat(id, opts) { const c = C.store.cat(id); if (c) open('cat', { id, key: c.key || null, name: c.name, color: c.color, spaces: [...(c.spaces || [])], def: !!c.def, note: '' }, opts); },
    openDraft(opts) { const d = st().session.draft; if (!d || !d.values || (d.kind !== 'space' && d.kind !== 'cat')) return false; open(d.kind, d.values, opts); return true; },
    isOpen: () => !!(P && P.el && P.el.isConnected),
  };
})(window.Chrona = window.Chrona || {});
