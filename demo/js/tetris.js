// Chrona "tetris" preview: time blocks fall into day columns and stack like Tetris.
// When a day fills up, its blocks are crossed out from the top and the day empties.
// Standalone, no dependencies; include css/tetris.css and js/tetris.js, then:
//
//   const stop = ChronaTetris.mount(element, {
//     days: ['Mon', 'Tue', 'Wed'], hours: [9 * 60, 14 * 60], step: 60, rowHeight: 36,
//     tasks: [{ cat: 'work', title: 'Deep work', dur: 120 }, ...],
//     start: [[0, 1], [2], []],
//   });
//   stop(); // stops timers and listeners, leaves the current picture in place
//
// All times are minutes from midnight. A block's time always matches its position.
(function (global) {
  'use strict';

  const COLORS = {
    work: ['#bfe0fb', '#4a9ee8'], fam: ['#fde2c8', '#f08a2e'], gym: ['#cdeedb', '#2fa866'], side: ['#e4dcfb', '#7c5ce6'],
  };
  const DEFAULTS = {
    days: ['Mon', 'Tue', 'Wed'],
    hours: [9 * 60, 14 * 60],       // range of every column
    step: 60,                        // grid step; block lengths and bounds are multiples of it
    rowHeight: null,                 // px per step; null lets the column fill its container
    grid: true,                      // draw a faint line under each step
    tasks: [],                       // [{ cat, title, dur }], cycled in order
    start: [],                       // per day: task indexes, stacked bottom first
    next: null,                      // first task to drop; by default the one after the last start task
    bounds: null,                    // per day: { top, bottom }; nothing is drawn outside them
    onClear: null,                   // (day) => new { top, bottom } for that day, or nothing
    balance: true,                   // no day completes while another is busy or nearly empty
    interval: [1000, 2500],          // ms between drops
    fall: px => 150 + 7 * Math.sqrt(px),
    squash: 120,
    strike: { delay: 200, stagger: 110, hold: 300, fade: 175 },
    shortBelow: 30,                  // px: shorter blocks show only their title
    colors: COLORS,                  // cat => [background, stripe]
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  function mount(el, options) {
    const o = Object.assign({}, DEFAULTS, options);
    o.strike = Object.assign({}, DEFAULTS.strike, options && options.strike);
    const [H0, H1] = o.hours, ROWS = (H1 - H0) / o.step;
    const rowsOf = dur => Math.max(1, Math.round(dur / o.step));
    const toRow = m => Math.round((m - H0) / o.step);
    const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set();
    let columns = [], task = 0, last = null;
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    const free = c => c.bottom - c.top - c.filled;

    function setBounds(column, b) {
      column.top = b ? toRow(b.top) : 0;
      column.bottom = b ? toRow(b.bottom) : ROWS;
    }

    // place a time block on top of the day's stack, shortened to the space left
    function stack(column, { cat, title, dur }) {
      const rows = Math.min(rowsOf(dur), free(column));
      const row = column.bottom - column.filled - rows;
      const [bg, stripe] = o.colors[cat] || ['#e8edf3', '#8a96a6'];
      const card = document.createElement('div');
      const px = (o.rowHeight || column.el.clientHeight / ROWS) * rows - 2;
      card.className = `tt-blk${px < o.shortBelow ? ' tt-short' : ''}`;
      card.style.cssText = `top:calc(${row / ROWS * 100}% + 1px);height:calc(${rows / ROWS * 100}% - 2px);background:${bg};border-left-color:${stripe}`;
      card.innerHTML = `<span>${esc(title)}</span><small>${hm(H0 + row * o.step)}–${hm(H0 + (row + rows) * o.step)}</small>`;
      column.el.appendChild(card);
      column.filled += rows;
      return { card, rows, row };
    }

    // the next task whose title is not in the day yet
    function nextFor(column) {
      const titles = [...column.el.children].map(card => card.firstChild.textContent);
      for (let i = 0; i < o.tasks.length; i++) {
        const t = (task + i) % o.tasks.length;
        if (!titles.includes(o.tasks[t].title)) return t;
      }
      return task;
    }

    function drop() {
      const fills = c => rowsOf(o.tasks[nextFor(c)].dur) >= free(c);
      const waiting = o.balance && columns.some(c => c.busy || c.filled < 2);
      const open = columns.filter(c => !c.busy && free(c) > 0 && !(waiting && fills(c)));
      const pool = open.length > 1 ? open.filter(c => c !== last) : open;
      if (pool.length) {
        // emptier days are much more likely to get the next block
        const weight = c => free(c) ** 2;
        let pick = Math.random() * pool.reduce((n, c) => n + weight(c), 0);
        const column = pool.find(c => (pick -= weight(c)) < 0) || pool[pool.length - 1];
        const next = nextFor(column);
        const { card, rows, row } = stack(column, o.tasks[next]);
        task = (next + 1) % o.tasks.length;
        last = column;
        column.busy = true;
        const dist = column.el.clientHeight * (row + rows) / ROWS + 4;
        const fall = Math.round(o.fall(dist));
        card.animate([{ transform: `translateY(${-dist}px)` }, { transform: 'translateY(0)' }], { duration: fall, easing: 'cubic-bezier(.55, 0, 1, .45)' });
        later(() => {
          card.animate([{ transform: 'scaleY(.84)' }, { transform: 'scaleY(1.04)', offset: 0.6 }, { transform: 'scaleY(1)' }], { duration: o.squash, easing: 'ease-out' });
          column.busy = false;
          if (!free(column)) clear(column);
        }, fall);
      }
      later(drop, o.interval[0] + Math.random() * (o.interval[1] - o.interval[0]));
    }

    // a full day is done: cross its blocks out in time order, then empty it
    function clear(column) {
      const { delay, stagger, hold, fade } = o.strike;
      column.busy = true;
      const cards = [...column.el.children].sort((a, b) => a.offsetTop - b.offsetTop);
      cards.forEach((card, i) => later(() => card.classList.add('tt-done'), delay + i * stagger));
      later(() => {
        cards.forEach(card => card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.92)' }], { duration: fade, easing: 'ease-in', fill: 'forwards' }));
        later(() => {
          column.el.replaceChildren();
          column.filled = 0;
          const b = o.onClear && o.onClear(columns.indexOf(column));
          if (b) setBounds(column, b);
          column.busy = false;
        }, fade);
      }, delay + cards.length * stagger + hold);
    }

    function reset() {
      timers.forEach(clearTimeout);
      timers.clear();
      el.innerHTML = `<div class="tt-root" style="--tt-days:${o.days.length};--tt-rows:${ROWS}">${o.days.map(d => `<div class="tt-day"><div class="tt-label">${esc(d)}</div><div class="tt-col${o.grid ? ' tt-grid' : ''}"${o.rowHeight ? ` style="flex:none;height:${o.rowHeight * ROWS}px"` : ''}></div></div>`).join('')}</div>`;
      columns = [...el.querySelectorAll('.tt-col')].map((colEl, i) => {
        const column = { el: colEl, filled: 0, busy: false };
        setBounds(column, o.bounds && o.bounds[i]);
        (o.start[i] || []).forEach(t => stack(column, o.tasks[t]));
        return column;
      });
      const used = o.start.flat();
      task = o.next != null ? o.next : used.length ? (Math.max(...used) + 1) % o.tasks.length : 0;
      last = null;
      if (!reducedMotion.matches && o.tasks.length) later(drop, o.interval[0] + Math.random() * (o.interval[1] - o.interval[0]));
    }

    reducedMotion.addEventListener('change', reset);
    reset();
    return function stop() {
      timers.forEach(clearTimeout);
      timers.clear();
      reducedMotion.removeEventListener('change', reset);
    };
  }

  global.ChronaTetris = { mount, defaults: DEFAULTS };
})(window);
