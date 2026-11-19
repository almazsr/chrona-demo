(function (C) {
  'use strict';
  // Settings (mockup 04, settings.feature, category.feature, review-workflow.feature)
  const HORIZON = [['week', 'this week'], ['nextweek', 'next week'], ['2w', 'next 2 weeks'], ['month', '1 month']];
  const REVIEW_P = [['thisweek', 'earlier this week'], ['lastweek', 'last week'], ['2w', 'last 2 weeks'], ['thismonth', 'earlier this month'], ['month', 'last month']];
  const FREQ = [['day', 'every day'], ['3days', 'every 3 days'], ['week', 'every week']];
  const SECS = [['cat', 'Categories'], ['ts', 'Time spaces'], ['adj', 'Schedule adjustment'], ['rev', 'Review']];
  const TZS = ['Europe/London', 'Europe/Prague', 'Europe/Moscow', 'Asia/Almaty', 'Asia/Tokyo', 'America/New_York', 'America/Los_Angeles', 'UTC'];
  const EXAMPLES = { work: 'Prepare report', meetings: 'Team sync', family: 'Dinner with kids', 'side hustle': 'Landing page', gym: 'Workout', selfcare: 'Meditation', other: 'Errands' };
  const EXAMPLE_TIMES = ['Mon 10:00\u201312:00', 'Tue 09:30\u201310:00', 'Wed 19:00\u201320:00', 'Sat 10:00\u201313:00', 'Thu 18:00\u201319:00'];
  const SLIDERS = {
    planAhead: { opts: HORIZON, get: s => s.planAhead, set: (s, v) => { s.planAhead = v; }, replan: true },
    period: { opts: REVIEW_P, get: s => s.review.period, set: (s, v) => { s.review.period = v; } },
    freq: { opts: FREQ, get: s => s.review.freq, set: (s, v) => { s.review.freq = v; } },
  };
  const st = () => C.store.state;
  const esc = s => C.esc(s);
  const q = (sel, r) => (r || root).querySelector(sel);
  let root = null, main = null, fixOpen = false, popFor = null, navLock = null;

  // ---------- save + feedback ----------
  function commit(msg, replan) {
    if (replan && C.solver) { try { C.solver.replan(); } catch (e) { console.error(e); } }
    C.store.save();
    if (msg) C.ui.toast('\u2713 ' + esc(msg), 2400);
    C.refresh();
  }
  const catOpts = () => ({ onSave: (cat, info) => commit(info.isNew ? 'Category added' : 'Category updated', !info.isNew && info.spacesChanged) });
  const spaceOpts = () => ({ onSave: (sp, info) => commit(info.isNew ? 'Time space added' : 'Time space updated', info.isNew || info.rangesChanged || info.linksChanged) });

  // ---------- sections ----------
  const sugHtml = (list, a) => (list.length ? `<span class="st-sugs"><span class="muted">Suggestions:</span>${list.map(n => `<span class="st-sug" data-a="${a}" data-n="${esc(n)}">+ ${esc(n)}</span>`).join('')}</span>` : '');

  function samples() {
    const cats = st().cats; if (!cats.length) return '';
    let items = [];
    try { if (C.solver && C.solver.items) items = C.solver.items() || []; } catch (e) { items = []; }
    const now = C.clock.now;
    const out = cats.slice(0, 5).map((c, i) => {
      const mine = items.filter(it => it.cat === c.id && it.e > it.s);
      const it = mine.filter(x => x.s >= now).sort((a, b) => a.s - b.s)[0] || mine.sort((a, b) => b.s - a.s)[0];
      const when = it ? `${C.wd(C.dayOf(it.s))} ${C.hm(it.s)}\u2013${C.endLabel(it.s, it.e)}` : EXAMPLE_TIMES[i % EXAMPLE_TIMES.length];
      const title = it ? it.title : (EXAMPLES[c.name.trim().toLowerCase()] || 'Example task');
      return `<span class="st-blk" style="background:${esc(c.color)}">${esc(title)}<small>${when} \u00b7 ${esc(c.name)}</small></span>`;
    });
    return `<div class="st-samples"><span class="muted">Time blocks use their category's color:</span>${out.join('')}</div>`;
  }

  function renderCats() {
    const cats = st().cats;
    q('#st-sec-cat').innerHTML = `<div class="st-ch"><h4>Categories</h4><div class="st-chr">${sugHtml(C.sc.catSuggestions(), 'sugcat')}<span class="b" data-a="addcat">+ Add category</span></div></div>
      <div>${cats.map(c => `<div class="st-row"><span class="st-cbtn" data-a="color" data-id="${esc(c.id)}" style="background:${esc(c.color)}" title="Change color"></span>
        <span><b>${esc(c.name)}</b>${c.def ? '<em class="st-def">default</em>' : ''}${c.fixed ? '<em class="st-fixt">fixed</em>' : ''}</span>
        <span>${(c.spaces || []).map(id => C.store.space(id)).filter(Boolean).map(s => `<span class="st-tsx">${esc(s.name)}</span>`).join('') || '<span class="muted">No time spaces</span>'}</span>
        <span class="st-ib" data-a="editcat" data-id="${esc(c.id)}" title="Edit">${C.sc.PENCIL}</span></div>`).join('') || '<div class="st-empty muted">No categories yet.</div>'}</div>
      ${samples()}`;
  }

  function renderSpaces() {
    const spaces = st().spaces;
    q('#st-sec-ts').innerHTML = `<div class="st-ch"><h4>Time spaces</h4><div class="st-chr">${sugHtml(C.sc.spaceSuggestions(), 'sugts')}<span class="b" data-a="addts">+ Add time space</span></div></div>
      <div class="st-wkwrap"></div>
      <div>${spaces.map(s => { const cs = C.sc.catsOfSpace(s.id); return `<div class="st-row ts"><b>${esc(s.name)}</b><span class="muted">${esc(C.sc.summary(s))}</span>
        <span>${cs.map(c => `<span class="st-cd"><i style="background:${esc(c.color)}"></i>${esc(c.name)}</span>`).join('') || '<span class="muted">No categories</span>'}</span>
        <span class="st-ib" data-a="editts" data-id="${esc(s.id)}" title="Edit">${C.sc.PENCIL}</span></div>`; }).join('') || '<div class="st-empty muted">No time spaces yet.</div>'}</div>`;
    C.sc.week(q('.st-wkwrap'), { onBand: id => C.sc.editSpace(id, spaceOpts()) });
  }

  function slider(key, label, hint, disabled) {
    const d = SLIDERS[key], s = st().settings, n = d.opts.length - 1;
    const i = Math.max(0, d.opts.findIndex(o => o[0] === d.get(s)));
    return `<div class="st-set stack"><div class="st-slh"><b>${label}</b><span class="st-val">${esc(d.opts[i][1])}</span></div>
      <input type="range" class="st-range" min="0" max="${n}" step="1" value="${i}" data-s="${key}" style="--p:${i / n * 100}%"${disabled ? ' disabled' : ''} aria-label="${label}">
      <div class="st-ticks">${d.opts.map(o => `<span>${esc(o[1])}</span>`).join('')}</div>${hint ? `<div class="muted">${hint}</div>` : ''}</div>`;
  }

  function tzLabel(tz) {
    if (tz === 'UTC') return 'UTC';
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName');
      return p ? `${tz} (${p.value.replace(/^GMT/, 'UTC')})` : tz;
    } catch (e) { return tz; }
  }

  function renderAdj() {
    const s = st().settings, cats = st().cats, fx = cats.filter(c => c.fixed), free = cats.filter(c => !c.fixed);
    const tzs = [...new Set([s.tz, ...TZS].filter(Boolean))];
    q('#st-sec-adj').innerHTML = `<div class="st-ch"><h4>Schedule adjustment</h4></div>
      <p class="st-lead">Chrona automatically rearranges flexible time blocks to fit your time spaces, priorities and deadlines. Fixed time blocks never move.</p>
      ${slider('planAhead', 'Plan ahead', 'Shorter: faster schedule adjustment. Longer: Chrona plans further ahead, but schedule adjustment takes longer.')}
      <div class="st-set stack"><div><b>Fixed categories</b><div class="muted">Categories are flexible by default. Time blocks in a fixed category, such as Meetings, keep their time and are never moved by schedule adjustment.</div></div>
        <div class="st-fixlist">${fx.map(c => `<span class="st-fx"><i style="background:${esc(c.color)}"></i>${esc(c.name)}<span class="st-x" data-a="fixrm" data-id="${esc(c.id)}" title="Make flexible">\u2212</span></span>`).join('') || '<span class="muted">None, so all categories are flexible.</span>'}
          ${free.length ? `<span class="st-ib" data-a="fixadd" title="Add fixed category">+</span>${fixOpen ? free.map(c => `<span class="st-opt" data-a="fixpick" data-id="${esc(c.id)}"><i style="background:${esc(c.color)}"></i>${esc(c.name)}</span>`).join('') : ''}` : ''}</div></div>
      <div class="st-set"><div><b>Split long tasks</b><div class="muted">Chrona may split a task into pieces of at least 30 minutes to fit free time</div></div><span class="st-tg${s.split ? ' on' : ''}" data-a="split" role="switch" aria-checked="${!!s.split}"></span></div>
      <div class="st-set"><div><b>Time zone</b><div class="muted">Used by the calendar, the list, and scheduling</div></div>
        <select class="st-sel" data-tz="1">${tzs.map(z => `<option value="${esc(z)}"${z === s.tz ? ' selected' : ''}>${esc(tzLabel(z))}</option>`).join('')}</select></div>`;
  }

  function renderRev() {
    const r = st().settings.review;
    q('#st-sec-rev').innerHTML = `<div class="st-ch"><h4>Review</h4></div>
      <p class="st-lead">Keep your tasks under control with the review feature.</p>
      ${slider('period', 'Max review period', 'How far back the Review screen looks for time blocks that aren\u2019t done.')}
      <div class="st-set"><div><b>Remind about review</b><div class="muted">Get a reminder when any time blocks up to now aren't done</div></div><span class="st-tg${r.remind ? ' on' : ''}" data-a="remind" role="switch" aria-checked="${!!r.remind}"></span></div>
      <div class="st-subset${r.remind ? '' : ' dis'}">${slider('freq', 'How often', '', !r.remind)}</div>`;
  }

  function renderAll() { if (!root) return; closePop(); renderCats(); renderSpaces(); renderAdj(); renderRev(); }

  // ---------- color popover ----------
  function openColor(id, anchor) {
    const c = C.store.cat(id); if (!c) return;
    popFor = id;
    const pop = q('.st-cpop');
    pop.innerHTML = `<div class="st-cpt">Color of ${esc(c.name)}</div>
      <div class="sc-sw">${C.sc.PALETTE.map(col => { const u = st().cats.find(k => k.color === col && k.id !== id); return `<span data-a="pick" data-c="${col}" class="${col === c.color ? 'sel' : ''}${u ? ' used' : ''}" style="background:${col}" title="${u ? `Used by ${esc(u.name)}` : ''}"></span>`; }).join('')}</div>
      <div class="muted st-cpn">Applies to all of its time blocks. A category always keeps a color.</div>`;
    const ar = anchor.getBoundingClientRect(), mr = main.getBoundingClientRect();
    pop.style.left = (ar.left - mr.left + main.scrollLeft) + 'px';
    pop.style.top = (ar.bottom - mr.top + main.scrollTop + 8) + 'px';
    pop.hidden = false;
  }
  function closePop() { const p = root && q('.st-cpop'); if (p) p.hidden = true; popFor = null; }

  // ---------- section navigation ----------
  function highlight(key) { root.querySelectorAll('.st-side a').forEach(a => a.classList.toggle('on', a.dataset.sec === key)); }
  function onScroll() {
    closePop();
    if (navLock) return;
    let cur = SECS[0][0];
    for (const [k] of SECS) if (q('#st-sec-' + k).offsetTop - 40 <= main.scrollTop) cur = k;
    if (main.scrollTop + main.clientHeight >= main.scrollHeight - 4) cur = SECS[SECS.length - 1][0];
    highlight(cur);
  }

  // ---------- events ----------
  function onClick(e) {
    const nav = e.target.closest('.st-side a[data-sec]');
    if (nav) { const sec = q('#st-sec-' + nav.dataset.sec); navLock = nav.dataset.sec; highlight(navLock); main.scrollTo({ top: Math.max(0, sec.offsetTop - 18), behavior: 'smooth' }); return; }
    const t = e.target.closest('[data-a]');
    if (!t) { if (!e.target.closest('.st-cpop')) closePop(); return; }
    const a = t.dataset.a, id = t.dataset.id, s = st().settings;
    if (a === 'color') { if (popFor === id) closePop(); else openColor(id, t); return; }
    if (a === 'pick') {
      const c = C.store.cat(popFor); closePop(); if (!c) return;
      if (c.color !== t.dataset.c) { c.color = t.dataset.c; commit(`Color of \u201c${c.name}\u201d updated for all its time blocks`); }
      return;
    }
    closePop();
    if (a === 'editcat') C.sc.editCat(id, catOpts());
    else if (a === 'addcat') C.sc.newCat(catOpts());
    else if (a === 'editts') C.sc.editSpace(id, spaceOpts());
    else if (a === 'addts') C.sc.newSpace(spaceOpts());
    else if (a === 'sugts') { if (C.sc.addPresetSpace(t.dataset.n)) commit(`Added \u201c${t.dataset.n}\u201d`); }
    else if (a === 'sugcat') { const r = C.sc.addPresetCat(t.dataset.n); if (r.values) C.sc.newCat(catOpts(), r.values); else if (r.cat) commit(`Added \u201c${r.cat.name}\u201d`); }
    else if (a === 'split') { s.split = !s.split; commit('Saved', true); }
    else if (a === 'remind') { s.review.remind = !s.review.remind; commit('Saved'); }
    else if (a === 'fixadd') { fixOpen = !fixOpen; renderAdj(); }
    else if (a === 'fixpick' || a === 'fixrm') {
      const c = C.store.cat(id); if (!c) return;
      const fix = a === 'fixpick';
      c.fixed = fix; fixOpen = false;
      try { if (C.solver) C.solver[fix ? 'fixCategory' : 'unfixCategory'](c.id); } catch (err) { console.error(err); }
      commit(fix ? `\u201c${c.name}\u201d is now fixed` : `\u201c${c.name}\u201d is flexible again`, true);
    }
  }
  function onInput(e) {
    const k = e.target.dataset.s; if (!k) return;
    const d = SLIDERS[k], i = +e.target.value, n = d.opts.length - 1;
    e.target.closest('.st-set').querySelector('.st-val').textContent = d.opts[i][1];
    e.target.style.setProperty('--p', (i / n * 100) + '%');
  }
  function onChange(e) {
    const t = e.target, s = st().settings;
    if (t.dataset.tz) { s.tz = t.value; commit('Saved'); return; }
    const k = t.dataset.s; if (!k) return;
    const d = SLIDERS[k], v = d.opts[+t.value][0];
    if (d.get(s) === v) return;
    d.set(s, v);
    commit('Saved', !!d.replan);
  }

  C.screen('settings', {
    mount(el) {
      fixOpen = false; popFor = null; navLock = null;
      el.innerHTML = `<div class="st">
        <aside class="st-side"><div class="st-t">Settings</div>${SECS.map(([k, l], i) => `<a data-sec="${k}" class="${i ? '' : 'on'}">${l}</a>`).join('')}</aside>
        <div class="st-main">${SECS.map(([k]) => `<section class="st-card" id="st-sec-${k}"></section>`).join('')}<div class="st-cpop" hidden></div></div>
      </div>`;
      root = el.firstElementChild;
      main = q('.st-main');
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      main.addEventListener('scroll', onScroll);
      const unlock = () => { navLock = null; };
      ['wheel', 'touchstart', 'mousedown', 'keydown'].forEach(ev => main.addEventListener(ev, unlock, { passive: true }));
      renderAll();
    },
    refresh() { renderAll(); },
    unmount() { root = null; main = null; popFor = null; },
  });
})(window.Chrona = window.Chrona || {});
