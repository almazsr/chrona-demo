(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, parseWhen, isHuman, whenLabel, humanWhen, placeText, norm, clip, subtract, WDS } = C;
  const IC = C.icons, S = C.store.state;
  // ---------- date field: one control = text input for humanized dates + calendar under it ----------
  // kind: 'net' | 'dl' | 'start' (needs a time) | 'day' (date only). Picking a day keeps the typed time.
  function dfAttach(inp, cal, kind) {
    let view = null;
    const cur = () => { const v = inp.value.trim(); if (!v) return null; const t = parseWhen(v, kind === 'day' ? 'dl' : kind === 'start' ? 'net' : kind); return t == null || Number.isNaN(t) ? null : t; };
    const draw = () => {
      const t = cur(), sel = t != null ? dayOf(t) : null;
      if (!view) { const d0 = dateOf(sel ?? C.clock.today); view = { y: d0.getFullYear(), m: d0.getMonth() }; }
      const first = new Date(view.y, view.m, 1), fi = C.dayIndex(first), lead = C.dow(fi), dim = new Date(view.y, view.m + 1, 0).getDate();
      let h = `<div class="df-head"><span class="df-nav" data-dfnav="-1">\u2039</span><b>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><span class="df-nav" data-dfnav="1">\u203a</span></div><div class="df-grid">`
        + ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => `<span class="df-wd">${w}</span>`).join('');
      for (let i = 0; i < Math.ceil((lead + dim) / 7) * 7; i++) { const d = fi - lead + i, dt = dateOf(d); h += `<span class="df-d${dt.getMonth() !== view.m ? ' out' : ''}${d < C.clock.today ? ' past' : ''}${d === C.clock.today ? ' today' : ''}${d === sel ? ' sel' : ''}" data-d="${d}">${dt.getDate()}</span>`; }
      cal.innerHTML = h + '</div>';
    };
    inp.addEventListener('input', () => { const t = cur(); if (t != null) { const d0 = dateOf(dayOf(t)); view = { y: d0.getFullYear(), m: d0.getMonth() }; } draw(); });
    cal.addEventListener('mousedown', e => e.preventDefault());
    cal.addEventListener('click', e => {
      e.stopPropagation();
      const nv = e.target.closest('[data-dfnav]');
      if (nv) { const m = view.m + +nv.dataset.dfnav; view = { y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; draw(); return; }
      const dd = e.target.closest('[data-d]'); if (!dd) return;
      const prevT = cur(), tm = kind === 'day' ? '' : ((/(\d{1,2}:\d{2})\s*$/.exec(inp.value) || [])[1] || (kind === 'start' ? (prevT != null ? hm(prevT) : '09:00') : ''));
      inp.value = fmtDay(+dd.dataset.d) + (tm ? ' ' + tm : '');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.focus();
    });
    draw();
  }

  C.datefield = { attach: dfAttach };
})(window.Chrona = window.Chrona || {});
