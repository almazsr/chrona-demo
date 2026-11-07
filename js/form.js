(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, parseWhen, isHuman, whenLabel, humanWhen, placeText, norm, clip, subtract, WDS } = C;
  const IC = C.icons, S = C.store.state;
  const defCat = () => (C.store.defaultCat() || {}).id;
  function mountForm(host, opts) {
    const isNew = opts.mode === 'new', v = opts.values || {};
    const st = {
      title: v.title || '',
      manual: { cat: v.cat || defCat(), dur: v.dur || '', pr: v.pr ?? DEF_PR, flex: v.fixed ? 'fixed' : 'flexible', start: v.start || '', net: v.net || '', dl: v.dl || '', rep: v.rep || null },
      shown: new Set(), userSet: new Set(), mk: {}, mkSig: {}, ovr: {}, catTouched: !isNew, errs: new Set(), msg: '', msgKind: '', aiOff: false, aiBusy: false, aiReq: 0, aiFilled: new Set(), flash: new Set(), toks: [], pop: null
    };
    if (v.fixed) st.shown.add('flex');
    if (v.rep) st.shown.add('rep');
    let pendingSave = null;
    const eff = f => (isNew && st.mk[f] != null && !st.ovr[f]) ? st.mk[f] : st.manual[f];
    const isFixed = () => !!C.catOf(eff('cat')).fixed || eff('flex') === 'fixed';
    const defStart = () => toLocal(Math.ceil(C.clock.now / 30) * 30 + 30);
    const visible = f => f === 'cat' || f === 'dur' || (f === 'flex' && (st.shown.has('flex') || isFixed())) || (f === 'start' && isFixed())
      || (f === 'pr' && (st.shown.has('pr') || eff('pr') !== DEF_PR)) || ((f === 'dl' || f === 'net') && !isFixed() && !eff('rep') && (st.shown.has(f) || !!eff(f))) || (f === 'rep' && isFixed() && (st.shown.has('rep') || !!eff('rep')));
    const OPTIONAL = [['flex', 'Flexibility', IC.swap, '!'], ['pr', 'Priority', IC.flag, '#p:'], ['dl', 'Deadline', IC.deadline, ']'], ['net', 'Not earlier than', IC.net, '['], ['rep', 'Repeat', IC.repeat, '*']];
    const available = () => OPTIONAL.filter(([k]) => !visible(k) && !((k === 'dl' || k === 'net') && isFixed()) && !(k === 'rep' && !isFixed()));
    const FNAME = { cat: 'Category', dur: 'Duration', flex: 'Flexibility', start: 'Start', pr: 'Priority', dl: 'Deadline', net: 'Not earlier than', rep: 'Repeat' };
    const repBase = () => v.repBase ?? (isFixed() && eff('start') ? dayOf(fromLocal(eff('start'))) : C.clock.today);
    const repShort = r => { const bd = repBase(), fd = dateOf(bd); const b = r.freq === 'daily' ? 'Daily' : r.freq === 'weekdays' ? 'Weekdays' : r.freq === 'weekly' ? `Weekly on ${C.series.dayNames(r.days || [dow(bd)])}` : r.freq === 'custom' ? `${(r.every || 1) > 1 ? `Every ${r.every} weeks on ` : ''}${C.series.dayNames(r.days)}` : r.freq === 'monthly' ? `Monthly on day ${fd.getDate()}` : `Yearly on ${p2(fd.getDate())}/${p2(fd.getMonth() + 1)}`; const en = r.ends || { type: 'never' }; return b + (en.type === 'count' ? ` · ${en.n} times` : en.type === 'date' ? ` · until ${fmtDay(en.day).slice(0, 5)}` : ''); };

    host.innerHTML = `<div class="tbf"><h5>${isNew ? 'New time block' : 'Edit time block'}</h5>
      <div class="trow"><div class="hl-wrap"><div class="hl-mirror"><div></div></div><input class="hl-in" placeholder="${isNew ? 'Task name' : 'Title'}" spellcheck="false"></div></div>
      <div class="frow"></div><div class="fmsg"></div><div class="fpop" hidden></div></div>`;
    const root = host.querySelector('.tbf'), ti = root.querySelector('.hl-in'), wrap = root.querySelector('.hl-wrap'), frow = root.querySelector('.frow'), pop = root.querySelector('.fpop');
    ti.value = st.title;
    const syncMirror = C.markers.attach(wrap, isNew, () => isFixed());

    function fb(f, inner, cls = '') {
      const c = ['fb', cls, st.errs.has(f) ? 'err' : '', st.flash.has(f) ? 'flash' : '', st.pop === f ? 'on' : ''].filter(Boolean).join(' ');
      const removable = ['flex', 'pr', 'dl', 'net', 'rep'].includes(f) && !(f === 'flex' && C.catOf(eff('cat')).fixed);
      const tip = FNAME[f] + ((f === 'dl' || f === 'net') && eff(f) && isHuman(eff(f)) && !Number.isNaN(parseWhen(eff(f), f)) ? ' · ' + fmtWhen(parseWhen(eff(f), f)) : '');
      return `<span class="${c}" data-fb="${f}" data-tip="${tip}">${inner}${removable ? `<span class="rm" data-rm="${f}" title="Remove">✕</span>` : ''}</span>`;
    }
    function renderRow() {
      const cat = eff('cat'), fx = isFixed();
      let h = available().length ? `<button class="plus${st.pop === '+' ? ' on' : ''}" data-a="plus" data-tip="Add a field">+</button>` : '';
      if (st.pop === '+' && !available().length) { st.pop = null; pop.hidden = true; }
      h += `<button class="aib${st.aiOff ? ' off' : ''}" data-a="ai" data-tip="${st.aiOff ? 'Auto-Fill has no suggestion for this title' : 'Auto-Fill with AI'}">${st.aiBusy ? '<span class="spin"></span>' : IC.spark}</button>`;
      h += fb('cat', `<i class="dot" style="background:${C.catOf(cat).color}"></i>${esc(C.catOf(cat).name)}`);
      const d = eff('dur'); h += fb('dur', `${IC.clock}${d ? esc(d) : '<span class="ph">Duration</span>'}`);
      if (visible('flex')) h += fb('flex', fx ? `${IC.lock}Fixed` : `${IC.swap}Flexible`);
      if (visible('start')) h += fb('start', `${IC.cal}${eff('start') ? esc(fmtWhen(fromLocal(eff('start')))) : '<span class="ph">Start</span>'}`);
      if (visible('rep')) h += fb('rep', `${IC.repeat}${eff('rep') ? esc(repShort(eff('rep'))) : '<span class="ph">Repeat</span>'}`);
      if (visible('pr')) { const p = eff('pr'); h += fb('pr', `${IC.flag}${esc(prLabel(p))}`, p === 1 ? 'pr-asap' : ''); }
      if (visible('dl')) h += fb('dl', `${IC.deadline}${eff('dl') ? esc(whenLabel(eff('dl'), 'dl')) : ''}`);
      if (visible('net')) h += fb('net', `${IC.net}${eff('net') ? esc(whenLabel(eff('net'), 'net')) : ''}`);
      h += `<span class="sp"></span><button class="xb" data-a="cancel" data-tip="Close">${IC.close}</button><button class="sendb" data-a="save" data-tip="Save">${IC.send}</button>`;
      frow.innerHTML = h; st.flash.clear();
      if (isNew && typeof syncMirror === 'function') syncMirror();
      wrap.classList.toggle('err', st.errs.has('title'));
      if (st.pop) positionPop();
    }
    function renderAi() { renderRow(); const m = root.querySelector('.fmsg'); m.textContent = st.msg; m.className = 'fmsg ' + st.msgKind; }
    function reparse() {
      if (!isNew) { st.toks = []; return; }
      const { toks, fields } = C.markers.parse(st.title); st.toks = toks;
      for (const f of ['dur', 'cat', 'pr', 'net', 'dl', 'flex', 'start', 'rep']) {
        const nv = fields[f] ? (f === 'rep' ? { ...fields[f].v, ends: { type: 'never' } } : fields[f].v) : null, sig = fields[f] ? fields[f].sig : null;
        if (sig !== st.mkSig[f]) { st.ovr[f] = false; if (nv != null && nv !== st.mk[f]) st.flash.add(f); }
        st.mk[f] = nv; st.mkSig[f] = sig;
      }
      if (fields.cat && C.catOf(fields.cat.v).fixed && !st.manual.start) st.manual.start = defStart();
      if (st.mk.rep && fields.rep && fields.rep.needFix && !isFixed()) { st.mk.rep = null; C.markers.checkRep(st.toks, false); }
    }
    const setField = (f, val) => { st.manual[f] = val; st.userSet.add(f); if (isNew && st.mk[f] != null) st.ovr[f] = true; st.errs.delete(f); st.aiFilled.delete(f); if (f === 'cat') { st.catTouched = true; if (C.catOf(val).fixed && !st.manual.start) st.manual.start = defStart(); } if (f === 'flex' && val === 'fixed' && !st.manual.start) st.manual.start = defStart(); if (isNew && (f === 'flex' || f === 'cat')) reparse(); };

    function positionPop() {
      const anchor = st.pop === '+' ? frow.querySelector('.plus') : st.pop === 'scope' ? frow.querySelector('.sendb') : frow.querySelector(`[data-fb="${st.pop}"]`);
      if (!anchor) { closeFPop(); return; }
      const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      pop.style.left = Math.min(ar.left - rr.left, rr.width - pop.offsetWidth - 4) + 'px';
      pop.style.top = (ar.bottom - rr.top + 6) + 'px';
    }
    function closeFPop() {
      const was = st.pop; st.pop = null; pop.hidden = true; frow.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
      if (was === 'rep' && !eff('rep') && st.shown.has('rep')) { st.shown.delete('rep'); renderRow(); }
    }
    function openFPop(f) {
      st.pop = f; let h = '';
      if (f === '+') h = available().map(([k, label, icon, kbd]) => `<div class="mi" data-add="${k}"><span class="ic">${icon}</span><span class="lab">${label}</span><span class="kbd">${esc(kbd)}</span></div>`).join('');
      else if (f === 'cat') h = S.cats.map(x => x.id).map(c => `<div class="mi${c === eff('cat') ? ' sel' : ''}" data-pick="${esc(c)}"><span class="ic"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${C.catOf(c).color}"></i></span><span class="lab">${esc(C.catOf(c).name)}${C.catOf(c).fixed ? ' <span class="muted">· fixed</span>' : ''}</span>${C.catOf(c).def ? '<span class="kbd">default</span>' : ''}</div>`).join('');
      else if (f === 'dur') h = `<input class="pin" data-pin="dur" placeholder="e.g. 45m, 1h 30m" value="${esc(eff('dur'))}"><div class="prev" data-prev="dur"></div><div class="psep"></div>` + ['15m', '30m', '45m', '1h', '1h 30m', '2h', '3h', '4h'].map(x => `<div class="mi${x === eff('dur') ? ' sel' : ''}" data-pick="${x}"><span class="lab">${x}</span></div>`).join('');
      else if (f === 'flex') { const lockCat = C.catOf(eff('cat')).fixed; h = `<div class="mi${!isFixed() ? ' sel' : ''}${lockCat ? ' dis' : ''}" data-pick="flexible"><span class="ic">${IC.swap}</span><span class="lab">Flexible<span class="sub2">Chrona picks the time and may move it</span></span></div><div class="mi${isFixed() ? ' sel' : ''}" data-pick="fixed"><span class="ic">${IC.lock}</span><span class="lab">Fixed<span class="sub2">Stays at the start time you set</span></span></div>${lockCat ? `<div class="muted" style="padding:4px 9px">${esc(C.catOf(eff('cat')).name)} is a fixed category, so its time blocks are always fixed.</div>` : ''}`; }
      else if (f === 'scope') h = '<div class="plabel">Save changes for</div>' + C.series.SCOPES.map(([k, l]) => `<div class="mi" data-scope="${k}"><span class="ic">${IC.repeat}</span><span class="lab">${l}</span></div>`).join('');
      else if (f === 'rep') {
        const r = eff('rep'), bd = repBase(), fd = dateOf(bd), cur = r ? r.freq : 'none';
        h = '<div class="plabel">Repeat</div>' + [['daily', 'Daily'], ['weekdays', 'Every weekday (Mon\u2013Fri)'], ['weekly', `Weekly on ${WDS[dow(bd)]}`], ['monthly', `Monthly on day ${fd.getDate()}`], ['yearly', `Yearly on ${p2(fd.getDate())}/${p2(fd.getMonth() + 1)}`], ['custom', 'Custom\u2026']]
          .map(([k, l]) => `<div class="mi${cur === k ? ' sel' : ''}" data-rep="${k}"><span class="ic">${IC.repeat}</span><span class="lab">${l}</span></div>`).join('');
        if (r && r.freq === 'custom') h += `<div class="dayrow">${WDS.map((w, i) => `<span class="dtog${r.days.includes(i) ? ' on' : ''}" data-day="${i}" title="${w}">${w.slice(0, 2)}</span>`).join('')}</div><div class="everyrow">Every <input class="pin small" data-pin="every" value="${r.every || 1}"> week(s)</div>`;
        if (r) { const en = r.ends || { type: 'never' }; h += '<div class="psep"></div><div class="plabel">Ends</div>' + [['never', 'Never'], ['date', 'On a date'], ['count', 'After']].map(([k, l]) => `<div class="mi${en.type === k ? ' sel' : ''}" data-ends="${k}"><span class="lab">${l}${k === 'count' ? ` <input class="pin small" data-pin="ends-count" value="${en.type === 'count' ? en.n : 10}"> times` : ''}</span></div>`).join('')
          + (en.type === 'date' ? `<div class="dfbox"><input class="pin" data-pin="ends-date" placeholder="eow, next week, 30/11" value="${fmtDay(en.day)}" spellcheck="false"><div class="df-cal" data-dfcal="ends-date"></div></div>` : '') + '<div class="prev" data-prev="ends"></div>'; }
      }
      else if (f === 'start') h = `<div class="plabel">Start</div><input class="pin" data-pin="start-tx" placeholder="tmr 15:00, 05/11 14:00" value="${eff('start') ? fmtWhen(fromLocal(eff('start'))) : ''}" spellcheck="false"><div class="df-cal" data-dfcal="start-tx"></div><div class="prev" data-prev="start-tx"></div>`;
      else if (f === 'pr') h = `<div class="plabel">Priority</div><input class="pin" data-pin="pr" placeholder="asap, next, normal, low or a number" value="${esc(prLabel(eff('pr')))}"><div class="prev" data-prev="pr"></div><div class="psep"></div>` + [['asap', 1], ['next', 2], ['normal', 5], ['low', 10]].map(([n, num]) => `<div class="mi${eff('pr') === num ? ' sel' : ''}" data-pick="${num}"><span class="ic">${IC.flag}</span><span class="lab">${n}</span><span class="kbd">${num}</span></div>`).join('');
      else if (f === 'dl' || f === 'net') {
        const quick = [['tmr', 'Tomorrow'], ['eod', 'End of day'], ['eotmr', 'End of tomorrow'], ['eow', 'End of week'], ['next week', 'Next week']];
        h = `<div class="dfwrap"><div class="dfmain"><div class="plabel">${FNAME[f]}</div><input class="pin" data-pin="${f}" placeholder="tmr, eow, next week, 30/11 15:00" value="${esc(eff(f) || '')}" spellcheck="false"><div class="df-cal" data-dfcal="${f}"></div><div class="prev" data-prev="${f}"></div></div><div class="dfquick">`
          + quick.map(([q, label]) => `<div class="mi" data-pick="${q}"><span class="ic">${IC.cal}</span><span class="lab">${label}<span class="sub2">${esc(fmtWhen(parseWhen(q, f)))}</span></span><span class="kbd">${q}</span></div>`).join('') + '</div></div>';
      }
      pop.innerHTML = h; pop.classList.toggle('wide', f === 'dl' || f === 'net');
      pop.querySelectorAll('[data-dfcal]').forEach(c => C.datefield.attach(pop.querySelector(`[data-pin="${c.dataset.dfcal}"]`), c, { 'start-tx': 'start', 'ends-date': 'day' }[c.dataset.dfcal] || c.dataset.dfcal));
      pop.hidden = false; renderRow(); positionPop(); updatePrev();
      const first = pop.querySelector('input.pin'); if (first && f !== 'rep') setTimeout(() => first.focus(), 20);
    }
    function updatePrev() {
      for (const el of pop.querySelectorAll('[data-prev]')) {
        const f = el.dataset.prev, inp = pop.querySelector(`[data-pin="${f}"]`); if (!inp) continue; const val = inp.value; let txt = '', bad = false;
        if (f === 'dur') { const d = parseDur(val); if (val.trim()) { if (d == null || Number.isNaN(d) || d <= 0) { txt = 'Try 45m, 2h or 1h 30m'; bad = true; } else txt = `= ${fmtDur(d)}`; } }
        else if (f === 'start-tx') { if (val.trim()) { const t = parseWhen(val, 'net'); if (Number.isNaN(t)) { txt = 'Couldn\u2019t read this. Try tmr 15:00 or 05/11 14:00'; bad = true; } else if (!/\d{1,2}:\d{2}$/.test(val.trim())) { txt = 'Add a time, e.g. tmr 15:00'; bad = true; } else txt = `\u2192 ${fmtWhen(t)}`; } }
        else if (f === 'pr') { if (val.trim()) { const p = parsePr(val); if (!p) { txt = 'Use asap, next, normal, low or a number from 1'; bad = true; } else txt = `= ${p}${prName(p) ? ' (' + prName(p) + ')' : ''} · 1 is the highest`; } }
        else if (val.trim()) { const t = parseWhen(val, f); if (Number.isNaN(t)) { txt = 'Couldn\u2019t read this date. Try tmr, eod, eow, 17:00 or 05/11 15:00'; bad = true; } else txt = `→ ${fmtWhen(t)}${isHuman(val) ? ' (saved as this date)' : ''}`; }
        el.textContent = txt; el.className = 'prev' + (bad ? ' bad' : ''); inp.classList.toggle('err', bad);
      }
    }
    const setRep = r => { st.manual.rep = r; st.userSet.add('rep'); if (isNew && st.mk.rep != null) st.ovr.rep = true; st.aiFilled.delete('rep'); st.errs.delete('rep'); };
    const curRep = () => { const r = eff('rep'); return r ? { ...r, days: r.days ? [...r.days] : r.days, ends: { ...(r.ends || { type: 'never' }) } } : null; };
    pop.addEventListener('input', e => {
      const k = e.target.dataset.pin; if (!k) return;
      if (k === 'every' || k === 'ends-count' || k === 'ends-date' || k === 'ends-dt') {
        const r = curRep(); if (!r) return; const val = e.target.value.trim(), pv = pop.querySelector('[data-prev="ends"]');
        if (k === 'every') { const n = parseInt(val, 10); if (n >= 1) r.every = n; }
        else if (k === 'ends-count') { const n = parseInt(val, 10); r.ends = { type: 'count', n: n >= 1 ? n : 1 }; }
        else if (k === 'ends-dt') { const t = fromLocal(val ? val + 'T00:00' : ''); if (t != null) { r.ends = { type: 'date', day: dayOf(t) }; const ti2 = pop.querySelector('[data-pin="ends-date"]'); if (ti2) ti2.value = fmtDay(dayOf(t)); if (pv) { pv.textContent = `\u2192 last on or before ${fmtDay(dayOf(t))}`; pv.className = 'prev'; } } }
        else { const t = parseWhen(val, 'dl'); if (val && !Number.isNaN(t) && t != null) { r.ends = { type: 'date', day: dayOf(t) }; const dp = pop.querySelector('[data-pin="ends-dt"]'); if (dp) dp.value = toLocal(at(dayOf(t), 0)).slice(0, 10); if (pv) { pv.textContent = `\u2192 last on or before ${fmtDay(dayOf(t))}`; pv.className = 'prev'; } } else if (pv) { pv.textContent = val ? 'Couldn\u2019t read this date' : ''; pv.className = 'prev bad'; } }
        setRep(r); pop.querySelectorAll('[data-ends]').forEach(m => m.classList.toggle('sel', m.dataset.ends === r.ends.type)); renderRow(); return;
      }
      if (k === 'start-tx') { updatePrev(); const v = e.target.value.trim(), t = parseWhen(v, 'net'); if (t != null && !Number.isNaN(t) && /\d{1,2}:\d{2}$/.test(v)) { setField('start', toLocal(t)); renderRow(); } return; }
      if (k.endsWith('-dt')) { const f = k.slice(0, -3), t = fromLocal(e.target.value); if (t != null) { setField(f, toLocal(t).replace('T', ' ')); pop.querySelector(`[data-pin="${f}"]`).value = st.manual[f]; updatePrev(); renderRow(); } return; }
      updatePrev(); const val = e.target.value;
      if (k === 'dur') { const d = parseDur(val); if (!val.trim() || (d && !Number.isNaN(d) && d > 0)) { setField('dur', val.trim() ? fmtDur(d) : ''); renderRow(); } }
      else if (k === 'pr') { const p = parsePr(val); if (p) { setField('pr', p); renderRow(); } }
      else if (k === 'dl' || k === 'net') { const t = parseWhen(val, k); if (!val.trim() || !Number.isNaN(t)) { setField(k, val.trim()); renderRow(); } }
    });
    pop.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeFPop(); ti.focus(); } if (e.key === 'Escape') { e.stopPropagation(); closeFPop(); } });
    pop.addEventListener('click', e => {
      e.stopPropagation();
      const sc = e.target.closest('[data-scope]'); if (sc) { const d = pendingSave; closeFPop(); pendingSave = null; if (d) opts.onSave(d, sc.dataset.scope); return; }
      const rp = e.target.closest('[data-rep]');
      if (rp) { const k = rp.dataset.rep, old = curRep(); setRep({ freq: k, days: k === 'custom' ? (old && old.days && old.freq === 'custom' ? old.days : [dow(repBase())]) : null, every: k === 'custom' ? (old && old.every) || 1 : undefined, ends: old ? old.ends : { type: 'never' } }); openFPop('rep'); return; }
      const dt = e.target.closest('[data-day]'); if (dt) { const r = curRep(); const d = +dt.dataset.day; r.days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d].sort(); setRep(r); openFPop('rep'); return; }
      const en = e.target.closest('[data-ends]');
      if (en) { const r = curRep(); const k = en.dataset.ends; if (e.target.tagName === 'INPUT') { if (r.ends.type !== k) { const inp = e.target; if (k === 'count') r.ends = { type: 'count', n: parseInt(inp.value, 10) || 10 }; else { const t = parseWhen(inp.value, 'dl'); if (t != null && !Number.isNaN(t)) r.ends = { type: 'date', day: dayOf(t) }; } setRep(r); pop.querySelectorAll('[data-ends]').forEach(m => m.classList.toggle('sel', m.dataset.ends === r.ends.type)); renderRow(); } return; }
        if (k === 'never') r.ends = { type: 'never' }; else if (k === 'count') r.ends = { type: 'count', n: parseInt(en.querySelector('input').value, 10) || 10 }; else r.ends = { type: 'date', day: C.clock.weekEnd };
        setRep(r); openFPop('rep'); return; }
      const add = e.target.closest('[data-add]'); if (add) { st.shown.add(add.dataset.add); openFPop(add.dataset.add); return; }
      const pk = e.target.closest('[data-pick]'); if (!pk || pk.classList.contains('dis')) return;
      const val = pk.dataset.pick, f = st.pop;
      if (f === 'pr') setField('pr', +val); else setField(f, val);
      if (f === 'flex' && val === 'fixed') { renderRow(); openFPop('start'); return; }
      closeFPop(); renderRow();
    });
    ti.addEventListener('input', () => { st.title = ti.value; st.errs = new Set(); st.aiOff = false; st.aiBusy = false; st.aiReq++; st.msg = ''; st.msgKind = ''; reparse(); renderAi(); });
    ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); if (st.pop) closeFPop(); else opts.onCancel(); } });
    root.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('.fpop')) return;
      const rm = e.target.closest('[data-rm]');
      if (rm) { const f = rm.dataset.rm; st.shown.delete(f); setField(f, f === 'pr' ? DEF_PR : f === 'flex' ? 'flexible' : f === 'rep' ? null : ''); if (isNew && st.mk[f] != null) st.ovr[f] = true; closeFPop(); renderRow(); return; }
      const a = e.target.closest('[data-a]'), fbx = e.target.closest('[data-fb]');
      if (fbx) { const f = fbx.dataset.fb; if (st.pop === f) closeFPop(); else openFPop(f); return; }
      if (!a) { closeFPop(); return; }
      if (a.dataset.a === 'plus') { if (st.pop === '+') closeFPop(); else openFPop('+'); }
      else if (a.dataset.a === 'cancel') opts.onCancel();
      else if (a.dataset.a === 'save') save();
      else if (a.dataset.a === 'ai') autofill();
    });

    function autofill() {
      if (st.aiOff || st.aiBusy) return;
      const title = isNew ? C.markers.clean(st.title, st.toks) : st.title.trim();
      if (!title) { st.msg = 'Enter a task name first'; st.msgKind = 'bad'; st.errs.add('title'); renderAi(); return; }
      closeFPop(); st.aiBusy = true; st.msg = ''; renderAi();
      const req = ++st.aiReq;
      setTimeout(() => {
        if (req !== st.aiReq) return;
        st.aiBusy = false;
        const p = C.autofill.predict(title), ok = f => p[f] && p[f].c >= 0.7;
        const DEFAULTS = { dur: '', cat: defCat(), pr: DEF_PR, flex: 'flexible', start: '', dl: '', net: '', rep: null };
        for (const f of st.aiFilled) st.manual[f] = DEFAULTS[f]; st.aiFilled.clear();
        if (!Object.keys(p).some(ok)) { st.aiOff = true; st.msg = 'Auto-Fill couldn\u2019t suggest anything for this title'; st.msgKind = 'bad'; renderAi(); return; }
        const fromUser = f => st.userSet.has(f) || (isNew && st.mk[f] != null && !st.ovr[f]);
        const apply = (f, val) => { st.manual[f] = val; if (isNew && st.mk[f] != null) st.ovr[f] = true; st.aiFilled.add(f); st.flash.add(f); };
        const filled = [];
        if (ok('dur') && !fromUser('dur') && !String(eff('dur')).trim()) { apply('dur', p.dur.v); filled.push(p.dur.v); }
        if (ok('cat') && !fromUser('cat') && !st.catTouched && eff('cat') !== p.cat.v) { apply('cat', p.cat.v); filled.push(C.catOf(p.cat.v).name); if (C.catOf(p.cat.v).fixed && !st.manual.start) st.manual.start = defStart(); }
        if (ok('pr') && !fromUser('pr') && p.pr.v !== DEF_PR && eff('pr') !== p.pr.v) { apply('pr', p.pr.v); filled.push(prLabel(p.pr.v)); }
        if (ok('start') && !fromUser('flex') && !fromUser('start')) { apply('flex', 'fixed'); apply('start', p.start.v); filled.push('fixed ' + fmtWhen(fromLocal(p.start.v))); }
        if (ok('rep') && isFixed() && !fromUser('rep') && !eff('rep')) { apply('rep', p.rep.v); st.shown.add('rep'); filled.push(repShort(p.rep.v).toLowerCase()); }
        if (!isFixed() && !eff('rep')) { if (ok('dl') && !fromUser('dl') && !eff('dl')) { apply('dl', p.dl.v); filled.push('deadline ' + p.dl.v); } if (ok('net') && !fromUser('net') && !eff('net')) { apply('net', p.net.v); filled.push('not earlier than ' + p.net.v); } }
        st.msg = filled.length ? `Auto-Fill: ${filled.join(' · ')}` : 'Nothing to change: the fields are already set'; st.msgKind = filled.length ? 'ok' : '';
        st.errs.delete('dur'); renderAi();
      }, 700);
    }
    function save() {
      closeFPop(); st.errs = new Set(); const msgs = [];
      const title = isNew ? C.markers.clean(st.title, st.toks) : st.title.trim();
      if (!title) { st.errs.add('title'); msgs.push('Please, enter a task name'); }
      if (!C.store.cat(eff('cat'))) { st.errs.add('cat'); msgs.push('Please, select a category'); }
      if (isNew && st.toks.some(t => t.t === 'bad')) { st.errs.add('title'); msgs.push('Fix the highlighted marker, or put \\ before it to keep it as text'); }
      const d = parseDur(eff('dur'));
      if (d == null) { st.errs.add('dur'); msgs.push('Please, enter a duration'); } else if (Number.isNaN(d) || d <= 0) { st.errs.add('dur'); msgs.push('Unrecognized duration. Try 45m, 2h or 1h 30m'); }
      const fx = isFixed(), rp = fx ? eff('rep') : null, start = fromLocal(eff('start')), net = fx || rp ? null : parseWhen(eff('net'), 'net'), dl = fx || rp ? null : parseWhen(eff('dl'), 'dl');
      if (rp && rp.freq === 'custom' && !rp.days.length) { st.errs.add('rep'); msgs.push('Pick at least one day to repeat on'); }
      if (fx && start == null) { st.errs.add('start'); msgs.push('Please, enter a start date and time'); }
      if (Number.isNaN(net)) { st.errs.add('net'); msgs.push('Couldn\u2019t read "Not earlier than"'); }
      if (Number.isNaN(dl)) { st.errs.add('dl'); msgs.push('Couldn\u2019t read the deadline'); }
      if (net != null && dl != null && !Number.isNaN(net) && !Number.isNaN(dl) && dl <= net) { st.errs.add('net'); st.errs.add('dl'); msgs.push('Deadline must be later than "Not earlier than"'); }
      if (st.errs.size) { st.msg = msgs[0]; st.msgKind = 'bad'; renderAi(); return; }
      const data = { title, cat: eff('cat'), dur: d, pr: eff('pr'), fixed: fx, start: fx ? start : null, net, dl, rep: rp ? { ...rp, ends: rp.ends || { type: 'never' } } : null };
      if (opts.occ) { pendingSave = data; openFPop('scope'); return; }
      opts.onSave(data);
    }
    reparse(); renderAi(); syncMirror();
    setTimeout(() => { ti.focus(); ti.setSelectionRange(ti.value.length, ti.value.length); syncMirror(); }, 30);
  }

  C.form = { mount: mountForm };
})(window.Chrona = window.Chrona || {});
