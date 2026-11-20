(function (C) {
  'use strict';
  // Sign-in, style C "Split with week preview" (mockup 01, authentication.feature)
  const APPLE = '<svg width="14" height="16" viewBox="0 0 14 16"><path fill="currentColor" d="M11.6 8.5c0-1.6 1.3-2.4 1.4-2.5-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.8 4.7 3.7 5.4 3 6.5c-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.6-.9 2.2-1.8.7-1 1-2 1-2.1-.1 0-1.9-.7-1.6-3.2zM9.8 3.5c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.5-.9 1.4-.8 2.3.9.1 1.8-.5 2.3-1.1z"/></svg>';
  const PROVIDERS = [
    ['Google', '<span class="si-ico" style="color:#4285f4">G</span>'],
    ['Apple', `<span class="si-ico">${APPLE}</span>`],
    ['Microsoft', '<span class="si-ico ms"><i style="background:#f25022"></i><i style="background:#7fba00"></i><i style="background:#00a4ef"></i><i style="background:#ffb900"></i></span>'],
  ];
  // sample week shown next to the sign-in buttons: [day, start, end, category, title]
  const BLOCKS = [
    [0, '09:00', '09:45', 'work', 'Team sync'], [0, '10:00', '12:00', 'work', 'Prepare report'], [0, '13:30', '14:30', 'gym', 'Gym'], [0, '18:30', '20:00', 'fam', 'Dinner'],
    [1, '09:00', '11:30', 'work', 'Deep work'], [1, '11:45', '12:30', 'work', '1:1'], [1, '16:00', '17:45', 'side', 'Side project'],
    [2, '09:30', '10:30', 'work', 'Client call'], [2, '10:45', '12:30', 'work', 'Read emails'], [2, '13:30', '14:30', 'gym', 'Gym'], [2, '18:00', '20:00', 'fam', 'Kids'],
    [3, '09:00', '12:30', 'work', 'Prepare report'], [3, '16:00', '17:30', 'side', 'Side project'],
    [4, '09:00', '10:15', 'work', 'Review'], [4, '10:30', '12:00', 'work', 'Planning'], [4, '17:30', '20:00', 'fam', 'Family time'],
  ];
  const H0 = 8 * 60, H1 = 21 * 60;
  const mins = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
  const MOBILE_DAYS = ['Mon', 'Tue', 'Wed'];
  // Mobile preview: time blocks fall and stack like Tetris. Each column is ROWS one-hour rows
  // starting at ROW_H0; mobile.css draws the same ROW px grid.
  const ROWS = 5, ROW = 36, ROW_H0 = 9;
  const PREVIEW = [
    ['work', 'Deep work', 2], ['gym', 'Gym', 1], ['work', 'Read emails', 1], ['side', 'Side project', 2],
    ['work', 'Team call', 1], ['fam', 'Lunch', 1], ['work', 'Write report', 2], ['gym', 'Workout', 1],
    ['work', 'Planning', 1], ['side', 'Reading', 1],
  ];
  // initial stacks, bottom first, so the preview opens partly filled
  const START = [[0], [1], [3, 2]];
  let stopPreview = null;

  function weekHtml() {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<div class="si-d"><b>${d}</b><div class="si-dc">${BLOCKS.filter(b => b[0] === i).map(([, s, e, c, t]) => {
      const top = (mins(s) - H0) / (H1 - H0) * 100, h = (mins(e) - mins(s)) / (H1 - H0) * 100;
      return `<div class="si-blk si-${c}" style="top:${top}%;height:${h}%">${C.esc(t)}<small>${s}\u2013${e}</small></div>`;
    }).join('')}</div></div>`).join('');
  }

  const hh = h => `${String(h).padStart(2, '0')}:00`;

  function animatePreview(preview) {
    const columns = [...preview.querySelectorAll('.si-dc')].map(el => ({ el, filled: 0, busy: false }));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set();
    let task = 0, last = null;
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    // place a time block on top of the column's stack; its time follows its row
    function stack(column, [color, title, rows]) {
      rows = Math.min(rows, ROWS - column.filled);
      const row = ROWS - column.filled - rows, top = row * ROW + 1, height = rows * ROW - 2;
      const card = document.createElement('div');
      card.className = `si-blk si-${color}`;
      card.style.cssText = `top:${top}px;height:${height}px`;
      card.innerHTML = `<span>${C.esc(title)}</span><small>${hh(ROW_H0 + row)}\u2013${hh(ROW_H0 + row + rows)}</small>`;
      column.el.appendChild(card);
      column.filled += rows;
      return { card, top, height };
    }

    // the next time block whose title is not in the column yet
    function nextFor(column) {
      const titles = [...column.el.children].map(card => card.firstChild.textContent);
      for (let i = 0; i < PREVIEW.length; i++) {
        const t = (task + i) % PREVIEW.length;
        if (!titles.includes(PREVIEW[t][1])) return t;
      }
      return task;
    }

    function drop() {
      // fill one column at a time: none fills up while another is busy or still nearly empty
      const waiting = columns.some(c => c.busy || c.filled < 2);
      const open = columns.filter(c => !c.busy && c.filled < ROWS && !(waiting && c.filled + Math.min(PREVIEW[nextFor(c)][2], ROWS - c.filled) === ROWS));
      const pool = open.length > 1 ? open.filter(c => c !== last) : open;
      if (pool.length) {
        // emptier columns are much more likely to get the next block
        const weight = c => (ROWS - c.filled) ** 2;
        let pick = Math.random() * pool.reduce((n, c) => n + weight(c), 0);
        const column = pool.find(c => (pick -= weight(c)) < 0) || pool[pool.length - 1];
        const next = nextFor(column);
        const { card, top, height } = stack(column, PREVIEW[next]);
        task = (next + 1) % PREVIEW.length;
        last = column;
        column.busy = true;
        const fall = Math.round(150 + 7 * Math.sqrt(top + height));
        card.animate([{ transform: `translateY(${-(top + height + 4)}px)` }, { transform: 'translateY(0)' }], { duration: fall, easing: 'cubic-bezier(.55, 0, 1, .45)' });
        later(() => {
          card.animate([{ transform: 'scaleY(.84)' }, { transform: 'scaleY(1.04)', offset: 0.6 }, { transform: 'scaleY(1)' }], { duration: 120, easing: 'ease-out' });
          column.busy = false;
          if (column.filled === ROWS) clear(column);
        }, fall);
      }
      later(drop, 1000 + Math.random() * 1500);
    }

    // a full column is done: cross its time blocks out in time order, then empty it
    function clear(column) {
      column.busy = true;
      const cards = [...column.el.children];
      cards.forEach((card, i) => later(() => card.classList.add('si-done'), 200 + i * 110));
      later(() => {
        cards.forEach(card => card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.92)' }], { duration: 175, easing: 'ease-in', fill: 'forwards' }));
        later(() => { column.el.replaceChildren(); column.filled = 0; column.busy = false; }, 175);
      }, 200 + cards.length * 110 + 300);
    }

    function reset() {
      timers.forEach(clearTimeout);
      timers.clear();
      columns.forEach((column, i) => {
        column.el.replaceChildren();
        Object.assign(column, { filled: 0, busy: false });
        START[i].forEach(t => stack(column, PREVIEW[t]));
      });
      task = 4;
      last = null;
      if (C.mobileLayout.matches && !reducedMotion.matches) later(drop, 1000 + Math.random() * 1500);
    }

    C.mobileLayout.addEventListener('change', reset);
    reducedMotion.addEventListener('change', reset);
    reset();
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
      C.mobileLayout.removeEventListener('change', reset);
      reducedMotion.removeEventListener('change', reset);
    };
  }

  C.screen('signin', {
    mount(root) {
      root.innerHTML = `<div class="si">
        <div class="si-left"><div class="si-panel">
          <div class="si-logo"><span class="si-mark"></span>Chrona</div>
          <h1>Your week, arranged for you</h1>
          <p class="si-sub">Tell Chrona what needs doing. It fits your tasks around meetings and replans when the day changes.</p>
          ${PROVIDERS.map(([p, ico]) => `<button type="button" class="si-btn" data-provider="${p}">${ico}Continue with ${p}</button>`).join('')}
          <div class="si-foot">Demo mode: no real account is used</div>
        </div></div>
        <div class="si-right">
          <div class="si-wk si-desktop-week">${weekHtml()}</div>
          <div class="si-wk si-mobile-week" aria-hidden="true">${MOBILE_DAYS.map(day => `<div class="si-d"><b>${day}</b><div class="si-dc"></div></div>`).join('')}</div>
        </div>
      </div>`;
      stopPreview = animatePreview(root.querySelector('.si-mobile-week'));
      root.firstElementChild.addEventListener('click', e => {
        const b = e.target.closest('[data-provider]'); if (!b) return;
        const s = C.store.state.session;
        s.signedIn = true; s.provider = b.dataset.provider; s.email = 'you@example.com';
        C.store.save();
        C.go(s.setupDone ? '#/calendar' : (s.step === 'categories' ? '#/setup/categories' : '#/setup/time-spaces'));
      });
    },
    unmount() { stopPreview?.(); stopPreview = null; },
  });
})(window.Chrona = window.Chrona || {});
