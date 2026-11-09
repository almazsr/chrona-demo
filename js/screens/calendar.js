(function (C) {
  'use strict';
  const { $, $$, esc, D, hm, wd, p2, dayOf, dateOf, fmtWhen, fmtDur, endLabel, range, prLabel, toLocal } = C;
  const IC = C.icons, S = C.store.state, A = () => C.actions;
  const PXH = 44, MIN_H = 15 / 60 * PXH - 2;
  let root = null, week = 0, drag = null, create = null, ghost = null, lastDragEnd = 0;
  const weekStart = () => C.clock.weekStart + week * 7;
  const byKey = k => C.solver.items().find(it => it.key === k);
  const pop = () => $('#cx-pop');

  // ---------- render ----------
  function render() {
    if (!root) return;
    const d0 = weekStart(), a = dateOf(d0), b = dateOf(d0 + 6), today = C.clock.today, now = C.clock.now;
    const y = b.getFullYear();
    $('#w-title', root).textContent = a.getMonth() === b.getMonth() ? `${a.getDate()} \u2013 ${b.getDate()} ${b.toLocaleDateString('en-GB', { month: 'long' })} ${y}` : `${a.getDate()} ${a.toLocaleDateString('en-GB', { month: 'short' })} \u2013 ${b.getDate()} ${b.toLocaleDateString('en-GB', { month: 'short' })} ${y}`;
    $('#cx-heads', root).innerHTML = '<div></div>' + [0, 1, 2, 3, 4, 5, 6].map(i => `<div class="${d0 + i === today ? 'today' : ''}">${wd(d0 + i)}<b>${dateOf(d0 + i).getDate()}</b></div>`).join('');
    let h = '<div class="hours" style="height:' + 24 * PXH + 'px">' + Array.from({ length: 23 }, (_, i) => `<span style="top:${(i + 1) * PXH}px">${p2(i + 1)}:00</span>`).join('') + '</div>';
    const all = C.solver.items().filter(it => dayOf(it.s) >= d0 && dayOf(it.s) < d0 + 7);
    for (let i = 0; i < 7; i++) {
      const d = d0 + i, list = all.filter(it => dayOf(it.s) === d).sort((x, y2) => x.s - y2.s || y2.e - x.e);
      const clusters = []; let cl = [], end = -Infinity;
      for (const it of list) { if (cl.length && it.s >= end) { clusters.push(cl); cl = []; end = -Infinity; } cl.push(it); end = Math.max(end, it.e); }
      if (cl.length) clusters.push(cl);
      for (const c of clusters) { const lanes = []; for (const it of c) { let l = lanes.findIndex(x => x <= it.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = it.e; it.lane = l; } for (const it of c) it.n = lanes.length; }
      h += `<div class="daycol${d < today ? ' past' : ''}" data-day="${d}" style="height:${24 * PXH}px;background-size:100% ${PXH}px">`;
      for (const it of list) {
        // a short card grows to a readable height only if nothing starts right after it; otherwise it stays compact
        const next = list.reduce((m, o) => (o !== it && o.s >= it.e ? Math.min(m, o.s) : m), Infinity);
        const real = (Math.min(it.e, (d + 1) * D) - it.s) / 60 * PXH - 2, room = (Math.min(next, (d + 1) * D) - it.s) / 60 * PXH - 2;
        const top = (it.s - d * D) / 60 * PXH, hgt = Math.max(real, Math.min(MIN_H, room)), bad = it.unmet && it.unmet.length;
        const cls = ['blk', hgt < 15 ? 'tiny' : '', it.n > 1 ? 'narrow' : '', it.e - it.s < 60 ? 'short' : '', it.e <= now ? 'past' : '', it.done ? 'done' : '', bad ? 'bad' : '', A().isTbd(it) ? 'tbd' : ''].filter(Boolean).join(' ');
        h += `<div class="${cls}" data-k="${esc(it.key)}" title="${esc(it.title)} \u00b7 ${hm(it.s)}\u2013${endLabel(it.s, it.e)}" style="top:${top}px;height:${hgt}px;left:calc(${it.lane * 100 / it.n}% + 2px);width:calc(${100 / it.n}% - 4px);background:${C.catOf(it.cat).color}">`
          + `<span class="cb${it.done ? ' on' : ''}" data-cb="1"></span><span class="tt">${esc(it.title)}${it.part ? ` \u00b7 ${it.part}` : ''}</span>${it.occ ? IC.repeatCard : ''}${it.kind === 'fixed' ? IC.lockCard : ''}${bad ? '<span class="warn" data-warn="1" title="Unmet constraints">!</span>' : ''}<span class="rz" data-rz="1"></span></div>`;
      }
      if (d === today) h += `<div class="now" style="top:${(now - d * D) / 60 * PXH}px"></div>`;
      h += '</div>';
    }
    $('#cx-grid', root).innerHTML = h;
  }
  // blocks glide from their old to their new place (calendar-interaction.feature "Show schedule adjustment in calendar")
  function renderAnimated() {
    const first = new Map(); $$('#cx-grid .blk', root).forEach(b => first.set(b.dataset.k, b.getBoundingClientRect()));
    render();
    $$('#cx-grid .blk', root).forEach(b => {
      const f = first.get(b.dataset.k);
      if (!f) { b.classList.add('appear'); return; }
      const l = b.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) + Math.abs(dy) < 1 && Math.abs(f.height - l.height) < 1) return;
      b.style.transition = 'none'; b.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; b.style.transform = ''; b.classList.add('moved'); }));
    });
  }
  function adjustSchedule(msg, after) {
    A().closeAll();
    $('#cx-progress', root).classList.add('on');
    $('#cx-progress', root).title = 'Adjusting schedule\u2026';
    setTimeout(() => {
      const moved = C.solver.replan();
      renderAnimated(); $('#cx-progress', root).classList.remove('on');
      if (after) after(moved); else C.ui.toast(`${msg ? msg + ' \u00b7 ' : ''}Schedule adjusted${moved ? ` \u00b7 ${moved} time block${moved > 1 ? 's' : ''} moved` : ''}`);
    }, 700);
  }

  // ---------- details popup ----------
  function constraintsOf(it) { return [it.net != null && it.kind === 'flex' ? `not earlier than ${fmtWhen(it.net)}` : '', it.dl != null && it.kind === 'flex' ? `deadline ${fmtWhen(it.dl)}` : ''].filter(Boolean).join(', '); }
  function openDetails(key, anchor, warnOnly) {
    const it = byKey(key); if (!it) return;
    A().closeMenu();
    const t = it.ref, fx = it.kind === 'fixed', cat = C.catOf(it.cat), p = pop();
    if (warnOnly) {
      p.innerHTML = `<span class="ib x" data-close="1">\u2715</span><h6><i style="background:${cat.color}"></i>${esc(it.title)}</h6><div style="font-weight:600;color:#b4232a">Unmet constraints</div><ul class="wlist">${it.unmet.map(u => `<li>${esc(u)}</li>`).join('')}</ul><div class="muted" style="margin-top:6px">Chrona placed it as close as it could. Edit, postpone, or free up time to fix this.</div>`;
    } else {
      const cons = constraintsOf(it), sr = it.occ ? C.series.find(it.occ.sid) : null;
      p.innerHTML = `<span class="ib x" data-close="1" title="Close">\u2715</span>
        <h6><i style="background:${cat.color}"></i>${esc(it.title)}</h6>
        <div class="row"><span class="k">\u25cf</span>${esc(cat.name)} \u00b7 ${esc(prLabel(it.pr))}</div>
        <div class="row"><span class="k">${IC.clock}</span>${range(it.s, it.e)}${it.part ? ` \u00b7 part ${it.part.replace('/', ' of ')}${S.tasks.includes(t) ? ` (${fmtDur(t.dur)} left in total)` : ''}` : ''}</div>
        <div class="row"><span class="k">${fx ? IC.lock : IC.swap}</span>${fx ? `Fixed${cat.fixed ? ' (fixed category)' : ''}` : 'Flexible: Chrona may move it'}</div>
        ${cons ? `<div class="row"><span class="k">${IC.deadline}</span>${esc(cons)}</div>` : ''}
        ${sr ? `<div class="row"><span class="k">${IC.repeat}</span>${esc(C.series.ruleText(sr.rule, sr.from))} \u00b7 ${esc(C.series.endsText(sr.ends))}</div>` : ''}
        <div class="row"><span class="k"><input type="checkbox" disabled ${it.done ? 'checked' : ''}></span>${it.done ? 'Done' : 'Not done'}</div>
        ${it.unmet && it.unmet.length ? `<div class="row" style="color:#b4232a"><span class="k">!</span>${esc(it.unmet[0])}</div>` : ''}
        <div class="acts"><span class="b" data-act="edit" data-k="${esc(key)}">Edit</span><span class="b danger" data-act="delete" data-k="${esc(key)}">Delete</span><span class="b" data-acts="${esc(key)}">Actions \u25be</span></div>`;
    }
    const r = anchor.getBoundingClientRect(), cr = $('#cx-app').getBoundingClientRect();
    p.hidden = false;
    let x = r.right + 8; if (x - cr.left + p.offsetWidth > cr.width - 6) x = r.left - p.offsetWidth - 8;
    C.ui.placeAt(p, x, r.top);
  }

  // ---------- form in a popup ----------
  function openForm(mode, it, values) {
    A().closeAll();
    const ov = $('#cx-ov'); ov.hidden = false; ov.onclick = null; ov.classList.toggle('light', !!ghost);
    const close = () => { ov.hidden = true; ov.innerHTML = ''; ov.classList.remove('light'); clearGhost(); };
    C.form.mount(ov, {
      mode, occ: it && it.occ ? it.occ : null, values: it ? A().valuesOf(it) : values, onCancel: close,
      onSave: (data, scope) => { close(); if (it && it.occ) A().editOcc(it, data, scope); else A().commitForm(data, it ? it.ref : null); },
    });
  }

  // ---------- create by clicking or dragging over empty time (placeholder shows the range, as in Google Calendar) ----------
  const clearGhost = () => { if (ghost) { ghost.remove(); ghost = null; } };
  const timeAt = (col, y, fn = Math.round) => +col.dataset.day * D + fn((y - col.getBoundingClientRect().top) / PXH * 4) * 15;
  function ghostAt(col, s, e) {
    if (!ghost) { ghost = document.createElement('div'); ghost.className = 'blk ghost'; }
    if (ghost.parentElement !== col) col.appendChild(ghost);
    const d = +col.dataset.day;
    Object.assign(ghost.style, { top: ((s - d * D) / 60 * PXH) + 'px', height: Math.max(16, (e - s) / 60 * PXH - 2) + 'px', left: '2px', width: 'calc(100% - 4px)' });
    ghost.innerHTML = `<span class="tt">(No title)<span class="gt">${hm(s)} \u2013 ${endLabel(s, e)}</span></span>`;
  }

  // ---------- drag and drop / resize ----------
  const showDl = (e, text) => { const dl = $('#cx-dlabel', root), cr = $('#cx-cal', root).getBoundingClientRect(); dl.textContent = text; dl.style.display = 'block'; dl.style.left = (e.clientX - cr.left + 14) + 'px'; dl.style.top = (e.clientY - cr.top - 28) + 'px'; };
  function onPointerDown(e) {
    const blk = e.target.closest('.blk');
    if (!blk) {
      const col = e.target.closest('.daycol');
      if (!col || e.button !== 0 || !pop().hidden || !$('#cx-cmenu').hidden || !$('#cx-ov').hidden) return;
      const d = +col.dataset.day, s0 = Math.max(d * D, Math.min((d + 1) * D - 15, timeAt(col, e.clientY, Math.floor)));
      create = { col, d, s0, y0: e.clientY, started: false, s: s0, e: s0 + 15 };
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.target.closest('[data-cb],[data-warn]')) return;
    const it = byKey(blk.dataset.k); if (!it || A().isTbd(it)) return;
    drag = { blk, it, resize: !!e.target.closest('[data-rz]'), x0: e.clientX, y0: e.clientY, grabDy: e.clientY - blk.getBoundingClientRect().top, started: false, s: it.s, e: it.e };
  }
  function onPointerMove(e) {
    if (create) {
      if (!create.started) { if (Math.abs(e.clientY - create.y0) < 5) return; create.started = true; $('#cx-root').classList.add('creating'); A().closeAll(); }
      const { col, d, s0 } = create, t = Math.max(d * D, Math.min((d + 1) * D, timeAt(col, e.clientY)));
      create.s = Math.min(s0, t); create.e = t > s0 ? Math.max(s0 + 15, t) : s0 + 15;
      ghostAt(col, create.s, create.e);
      return;
    }
    if (!drag) return;
    if (!drag.started) { if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 5) return; drag.started = true; drag.blk.classList.add('dragging'); $('#cx-root').classList.add(drag.resize ? 'resizing' : 'grabbing'); A().closeAll(); }
    const len = drag.it.e - drag.it.s;
    if (drag.resize) {
      const col = drag.blk.parentElement, cr = col.getBoundingClientRect(), d = +col.dataset.day;
      let end = d * D + Math.round((e.clientY - cr.top) / PXH * 60 / 15) * 15;
      end = Math.max(drag.it.s + 15, Math.min((d + 1) * D, end));
      drag.s = drag.it.s; drag.e = end; drag.blk.style.height = ((end - drag.it.s) / 60 * PXH - 2) + 'px';
      showDl(e, `${fmtDur(end - drag.it.s)} \u00b7 ends ${hm(end)}`);
    } else {
      const col = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList && el.classList.contains('daycol')); if (!col) return;
      const cr = col.getBoundingClientRect(), d = +col.dataset.day;
      let start = d * D + Math.round((e.clientY - drag.grabDy - cr.top) / PXH * 60 / 15) * 15;
      start = Math.max(d * D, Math.min((d + 1) * D - len, start));
      drag.s = start; drag.e = start + len;
      if (drag.blk.parentElement !== col) col.appendChild(drag.blk);
      Object.assign(drag.blk.style, { top: ((start - d * D) / 60 * PXH) + 'px', left: '2px', width: 'calc(100% - 4px)' });
      showDl(e, range(drag.s, drag.e));
    }
  }
  function onPointerUp() {
    if (create) {
      const c = create; create = null; $('#cx-root').classList.remove('creating');
      // a plain click takes the half hour under the cursor
      if (!c.started) { const s = Math.min((c.d + 1) * D - 30, c.d * D + Math.floor((c.s0 - c.d * D) / 30) * 30); c.s = s; c.e = s + 30; }
      lastDragEnd = Date.now();
      ghostAt(c.col, c.s, c.e);
      openForm('new', null, { fixed: true, start: toLocal(c.s), dur: fmtDur(c.e - c.s) });
      return;
    }
    if (!drag) return; const dd = drag; drag = null; $('#cx-dlabel', root).style.display = 'none'; $('#cx-root').classList.remove('grabbing', 'resizing');
    if (!dd.started) return;
    lastDragEnd = Date.now(); dd.blk.classList.remove('dragging');
    if (dd.s === dd.it.s && dd.e === dd.it.e) { render(); return; }
    A().onDrop(dd);
  }

  // ---------- events ----------
  function onClick(e) {
    if (Date.now() - lastDragEnd < 350) return;
    if (e.target.closest('#cx-ov') || e.target.closest('#cx-cmenu')) return;
    const sh = e.target.closest('#cx-toast [data-show]'); if (sh) { week = +sh.dataset.show; C.ui.hideToast(); render(); return; }
    if (e.target.closest('#cx-pop [data-close]')) { pop().hidden = true; return; }
    const cb = e.target.closest('#cx-grid [data-cb]'); if (cb) { A().toggleDone(cb.closest('.blk').dataset.k); return; }
    const acts = e.target.closest('#cx-pop [data-acts]'); if (acts) { const r = acts.getBoundingClientRect(); A().openMenu(acts.dataset.acts, r.left, r.bottom + 4, true); return; }
    const act = e.target.closest('#cx-pop [data-act]'); if (act) { pop().hidden = true; A().runAction(act.dataset.act, act.dataset.k); return; }
    const warn = e.target.closest('#cx-grid [data-warn]'); if (warn) { openDetails(warn.closest('.blk').dataset.k, warn.closest('.blk'), true); return; }
    const blk = e.target.closest('#cx-grid .blk'); if (blk) { openDetails(blk.dataset.k, blk); return; }
    if (e.target.closest('#cx-pop')) return;
    if (!e.target.closest('.hdr')) A().closeAll();
  }
  function onContext(e) { const blk = e.target.closest('.blk'); if (!blk) return; e.preventDefault(); A().openMenu(blk.dataset.k, e.clientX, e.clientY); }

  C.screen('calendar', {
    mount(el) {
      root = el; week = 0; drag = null; create = null; ghost = null;
      el.innerHTML = `<div class="bar">
          <span class="ib" id="w-prev" title="Previous week">\u2039</span><span class="ib" id="w-next" title="Next week">\u203a</span>
          <span class="b" id="w-today">Today</span><span class="wtitle" id="w-title"></span>
          <div class="quick"><span class="muted">\uff0b</span><div class="hl-wrap"><div class="hl-mirror"><div></div></div><input class="hl-in" id="cx-quick" placeholder="Quick add, e.g. Call bank (1h) @Work #p:asap ]eow" spellcheck="false"></div></div>
          <span class="b p" id="b-create">Create</span></div>
        <div class="progress" id="cx-progress"></div>
        <div class="cal" id="cx-cal"><div class="heads" id="cx-heads"></div><div class="scroll" id="cx-scroll"><div class="grid" id="cx-grid"></div></div><div class="dlabel" id="cx-dlabel"></div></div>`;
      Object.assign(C.view, {
        render: animated => (animated ? renderAnimated() : render()),
        adjust: adjustSchedule, openForm,
        showLink: first => { if (!first) return ''; const wk = Math.floor((dayOf(first[0]) - C.clock.weekStart) / 7); return wk !== week ? ` <span data-show="${wk}">Show</span>` : ''; },
        showWeekOf: day => { week = Math.floor((day - C.clock.weekStart) / 7); },
      });
      const quick = $('#cx-quick', el);
      C.markers.attach($('.quick .hl-wrap', el), true);
      const quickCreate = () => { const t = quick.value; quick.value = ''; quick.dispatchEvent(new Event('input')); openForm('new', null, { title: t }); };
      quick.addEventListener('keydown', e => { if (e.key === 'Enter' && quick.value.trim()) quickCreate(); });
      $('#b-create', el).addEventListener('click', e => { e.stopPropagation(); quickCreate(); });
      $('#w-prev', el).addEventListener('click', () => { week--; A().closeAll(); render(); });
      $('#w-next', el).addEventListener('click', () => { week++; A().closeAll(); render(); });
      $('#w-today', el).addEventListener('click', () => { week = 0; A().closeAll(); render(); });
      $('#cx-grid', el).addEventListener('pointerdown', onPointerDown);
      $('#cx-grid', el).addEventListener('contextmenu', onContext);
      $('#cx-scroll', el).addEventListener('scroll', () => { pop().hidden = true; A().closeMenu(); });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      $('#cx-app').addEventListener('click', onClick);
      render();
      $('#cx-scroll', el).scrollTop = 7 * PXH;
    },
    unmount() {
      clearGhost();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      $('#cx-app').removeEventListener('click', onClick);
      A().resetView();
      root = null;
    },
    refresh() { if (!drag && !create && !ghost) render(); },
  });
})(window.Chrona = window.Chrona || {});
