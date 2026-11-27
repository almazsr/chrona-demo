/* Benefit animations (features/landing.feature, "Show each benefit with its own looping animation").
   Each scene is a small calendar drawn with the demo's look (blocks, lock, actions menu, time block
   form) and a short script. js/loop.js plays it while visible, holds the last frame for 5 s and
   starts over; with reduced motion it shows the last frame. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var SVG = function (p) { return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    check: SVG('<path d="M3 8.5l3.2 3L13 4.5"/>'),
    half: SVG('<circle cx="8" cy="8" r="6"/><path d="M8 2v12A6 6 0 0 0 8 2z" fill="currentColor"/>'),
    later: SVG('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8h3"/><path d="M12.8 2.8l1.2 2.4-2.6.4"/>'),
    cal: SVG('<rect x="2.3" y="3.2" width="11.4" height="10.3" rx="1.6"/><path d="M2.3 6.5h11.4M5.5 2v2.4M10.5 2v2.4"/>'),
    clock: SVG('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/>'),
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.2 5.2 1.9-5.2 1.9L12 16.7l-1.9-5.2L4.9 9.6l5.2-1.9z"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" opacity=".75"/><path d="M5.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" opacity=".6"/></svg>',
    send: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.6 7.2 13.9 1.9c.5-.2 1 .3.8.8L9.4 15c-.2.5-.9.5-1.1 0L6.6 9.9 1.6 8.3c-.5-.2-.5-.9 0-1.1zm5.6 2.3 1.2 3.6 4.3-10-10 4.3 3.6 1.2 3.5-3.5.8.8-3.4 3.6z"/></svg>',
  };
  var LOCK = '<svg class="lk" width="10" height="11" viewBox="0 0 10 11" aria-hidden="true"><path fill="currentColor" d="M2.5 4.5V3a2.5 2.5 0 0 1 5 0v1.5H8a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h.5zm1.2 0h2.6V3a1.3 1.3 0 0 0-2.6 0v1.5z"/></svg>';

  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---------- small calendar ----------
  function Mini(root, o) {
    var from = o.from * 60, to = o.to * 60, span = to - from, n = o.days.length;
    root.innerHTML = '<div class="mini" style="--cols:' + n + '">'
      + '<div class="mini-days"><div></div>' + o.days.map(function (d) { return '<div>' + d + '</div>'; }).join('') + '</div>'
      + '<div class="mini-body" style="--rows:' + (o.to - o.from) + '"><div class="mini-hours">'
      + Array.from({ length: o.to - o.from }, function (_, i) { var h = o.from + i; return '<span style="top:' + (i / (o.to - o.from) * 100) + '%">' + (h < 10 ? '0' : '') + h + ':00</span>'; }).join('')
      + '</div><div class="mini-grid"></div></div></div>';
    var grid = root.querySelector('.mini-grid'), els = {};

    function pos(el, day, s, e) {
      var a = mins(s), b = mins(e);
      el.style.top = ((a - from) / span * 100) + '%';
      el.style.height = 'calc(' + ((b - a) / span * 100) + '% - 2px)';
      el.style.left = (day / n * 100) + '%';
      el.style.width = 'calc(' + (100 / n) + '% - 7px)';
      el.classList.toggle('is-short', b - a < 45);
      var t = el.querySelector('small[data-time]');
      if (t) t.textContent = s + '–' + e;
    }

    return {
      el: function (id) { return els[id]; },
      band: function (day, s, e, cls) {
        var el = document.createElement('div');
        el.className = 'mini-band ' + cls;
        grid.appendChild(el);
        pos(el, day, s, e);
        el.style.width = 'calc(' + (100 / n) + '% - 1px)';
        return el;
      },
      add: function (id, b) {
        var el = document.createElement('div');
        el.className = 'blk ' + (b.fixed ? 'blk-meet' : 'blk-work') + (b.cls ? ' ' + b.cls : '');
        el.innerHTML = '<div class="bt"><b></b>' + (b.fixed ? LOCK : '') + '</div><small data-time></small>';
        el.querySelector('b').textContent = b.title;
        grid.appendChild(el);
        els[id] = el;
        pos(el, b.day, b.s, b.e);
        if (b.note) el.querySelector('small').textContent = b.note;
        return el;
      },
      move: function (id, day, s, e) { pos(els[id], day, s, e); },
      title: function (id, t) { els[id].querySelector('b').textContent = t; },
    };
  }

  // actions menu drawn like the demo's, next to a block
  function menu(host, items, anchor) {
    var m = document.createElement('div');
    m.className = 'scene-menu';
    m.innerHTML = rows(items);
    host.appendChild(m);
    var hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    var W = 236, left = ar.right - hr.left + 8;
    if (left + W > hr.width) left = Math.max(4, Math.min(ar.left - hr.left - W - 8, hr.width - W - 4));
    m.style.left = left + 'px';
    m.style.top = Math.max(4, Math.min(ar.top - hr.top, hr.height - 200)) + 'px';
    return m;
  }
  function rows(items) {
    return items.map(function (it) {
      return '<div class="mi" data-k="' + it.k + '"><span class="ic">' + (IC[it.ic] || '') + '</span><span class="lab">' + esc(it.label) + '</span>' + (it.val ? '<span class="val">' + esc(it.val) + '</span>' : '') + (it.arr ? '<span class="arr">›</span>' : '') + '</div>';
    }).join('');
  }
  function pick(m, k) { [].forEach.call(m.children, function (c) { c.classList.toggle('on', c.dataset.k === k); }); }
  var ACTIONS = [{ k: 'done', ic: 'check', label: 'Done' }, { k: 'partial', ic: 'half', label: 'Partially Done', arr: true }, { k: 'pp', ic: 'later', label: 'Postpone', arr: true }];

  function scene(id, setup, options) {
    var host = document.getElementById(id);
    if (!host) return;
    var stage = host.querySelector('.scene-stage');
    window.ChronaLoop(stage, function () { return setup(stage, host); }, options);
  }

  // ---------- 1. Every task gets real time ----------
  scene('scene-time', function (stage) {
    var TASKS = [
      ['t1', 'Invoices', '1h', 0, '09:00', '10:00'],
      ['t2', 'Proposal draft', '2h', 0, '11:00', '13:00'],
      ['t3', 'Portfolio update', '1h 30m', 0, '13:00', '14:30'],
      ['t4', 'Call accountant', '30m', 0, '14:30', '15:00'],
      ['t5', 'Write newsletter', '1h', 1, '10:00', '11:00'],
    ];
    var DAYS = ['Mon', 'Tue', 'Wed'];
    stage.innerHTML = '<div class="todo"><div class="todo-h">To do</div><ol>' + TASKS.map(function (t) {
      return '<li data-id="' + t[0] + '" class="is-hidden"><span class="todo-t">' + t[1] + '</span><span class="todo-d">' + t[2] + '</span><span class="todo-at"></span></li>';
    }).join('') + '</ol></div><div class="todo-cal"></div>';
    var cal = Mini(stage.querySelector('.todo-cal'), { days: DAYS, from: 9, to: 16 });
    cal.add('m1', { fixed: true, title: 'Client call', day: 0, s: '10:00', e: '11:00' });
    cal.add('m2', { fixed: true, title: 'Discovery call', day: 1, s: '09:00', e: '10:00' });
    cal.add('m3', { fixed: true, title: 'Lunch', day: 1, s: '12:00', e: '13:00' });
    cal.add('m4', { fixed: true, title: 'Workshop', day: 2, s: '11:00', e: '13:00' });

    // the list fills top to bottom quickly, in about 1.2 seconds
    var steps = TASKS.map(function (t, i) {
      return [i ? 300 : 0, function () { stage.querySelector('[data-id="' + t[0] + '"]').classList.remove('is-hidden'); }];
    });
    // then every task flies into its time block at once, in about 2 seconds
    steps.push([700, function () {
      var still = stage.classList.contains('no-anim');
      TASKS.forEach(function (t) {
        var row = stage.querySelector('[data-id="' + t[0] + '"]');
        var el = cal.add(t[0], { title: t[1], day: t[3], s: t[4], e: t[5] });
        if (!still) {
          var a = row.getBoundingClientRect(), b = el.getBoundingClientRect();
          el.classList.add('is-flying');
          el.style.transition = 'none'; // jump to the list row first, then fly
          el.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)';
          void el.offsetWidth;
          el.style.transition = '';
          el.classList.add('fly');
          el.style.transform = '';
        }
        row.classList.add('is-placed');
        row.querySelector('.todo-at').textContent = DAYS[t[3]] + ' ' + t[4];
      });
    }]);
    steps.push([2000, function () { stage.querySelectorAll('.is-flying').forEach(function (el) { el.classList.remove('is-flying', 'fly'); }); }]);
    return { steps: steps };
  });

  // ---------- 2. Not sure how long it takes? (Auto-Fill) ----------
  scene('scene-ai', function (stage) {
    var TITLE = 'Prepare investor update';
    stage.innerHTML = '<div class="af"><div class="af-h">New time block</div>'
      + '<div class="af-title"><span class="af-text"></span><span class="af-caret"></span><span class="af-ph">Task name</span></div>'
      + '<div class="af-row"><span class="af-plus">+</span><span class="af-ai">' + IC.spark + '</span>'
      + '<span class="af-fb" data-f="cat"><i class="dot"></i><span>Category</span></span>'
      + '<span class="af-fb" data-f="dur">' + IC.clock + '<span>Duration</span></span>'
      + '<span class="sp"></span><span class="af-save">' + IC.send + '</span></div>'
      + '<div class="af-msg"></div></div><div class="af-cal"></div>';
    var cal = Mini(stage.querySelector('.af-cal'), { days: ['Mon', 'Tue'], from: 9, to: 14 });
    cal.add('a', { fixed: true, title: 'Client call', day: 0, s: '09:00', e: '10:00' });
    cal.add('b', { title: 'Proposal', day: 0, s: '10:00', e: '13:00' });
    cal.add('c', { fixed: true, title: 'Lunch', day: 0, s: '13:00', e: '14:00' });
    cal.add('d', { fixed: true, title: 'Team call', day: 1, s: '09:00', e: '10:00' });
    var text = stage.querySelector('.af-text'), ph = stage.querySelector('.af-ph');
    var ai = stage.querySelector('.af-ai'), msg = stage.querySelector('.af-msg');
    var cat = stage.querySelector('[data-f="cat"]'), dur = stage.querySelector('[data-f="dur"]');
    var save = stage.querySelector('.af-save');

    var steps = [[0, function () { ph.hidden = true; }]];
    for (var i = 1; i <= TITLE.length; i++) {
      (function (n) { steps.push([45, function () { text.textContent = TITLE.slice(0, n); }]); })(i);
    }
    steps.push(
      [500, function () { ai.classList.add('is-busy'); }],
      [900, function () {
        ai.classList.remove('is-busy');
        cat.innerHTML = '<i class="dot" style="background:#4a9ee8"></i><span>Work</span>';
        dur.innerHTML = IC.clock + '<span>2h</span>';
        cat.classList.add('is-set', 'flash'); dur.classList.add('is-set', 'flash');
        msg.textContent = 'Auto-Fill: Category · Duration';
      }],
      [1100, function () { save.classList.add('is-press'); }],
      [300, function () {
        var el = cal.add('new', { title: TITLE, day: 1, s: '10:00', e: '12:00' });
        el.classList.add('appear', 'is-moved');
      }]
    );
    return { steps: steps };
  });

  // ---------- 3. Your free time stays yours ----------
  scene('scene-evening', function (stage) {
    stage.innerHTML = '<div class="spaces"><span><i class="sw-work-hours"></i>Work hours</span><span><i class="sw-family"></i>Family time</span></div><div class="scene-cal"></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Mon', 'Tue'], from: 9, to: 22 });
    cal.band(0, '09:00', '18:00', 'band-work'); cal.band(1, '09:00', '18:00', 'band-work');
    var fam = [cal.band(0, '18:00', '22:00', 'band-family'), cal.band(1, '18:00', '22:00', 'band-family')];
    cal.add('a', { title: 'Proposal', day: 0, s: '09:00', e: '12:00' });
    cal.add('b', { fixed: true, title: 'Lunch', day: 0, s: '12:00', e: '13:00' });
    cal.add('c', { title: 'Edits', day: 0, s: '13:00', e: '14:00' });
    cal.add('d', { fixed: true, title: 'Client call', day: 0, s: '14:00', e: '15:00' });
    cal.add('e', { fixed: true, title: 'Workshop', day: 0, s: '15:00', e: '18:00' });
    cal.add('f', { fixed: true, title: 'Team call', day: 1, s: '11:00', e: '12:00' });
    return {
      steps: [
        [0, function () { var el = cal.add('n', { title: 'Edit video', day: 0, s: '18:00', e: '20:00', cls: 'is-try' }); el.classList.add('appear'); }],
        [700, function () { fam[0].classList.add('is-hot'); }],
        [900, function () { var el = cal.el('n'); el.classList.remove('is-try'); el.classList.add('is-moved'); cal.move('n', 1, '09:00', '11:00'); fam[0].classList.remove('is-hot'); }],
      ],
    };
  });

  // ---------- 4. Focus first or deadlines first ----------
  (function () {
    var host = document.getElementById('scene-focus');
    if (!host) return;
    var stage = host.querySelector('.scene-stage');
    var seg = (host.closest('.feat') || host).querySelectorAll('[data-mode]');
    var note = host.querySelector('[data-focus-note]');
    var mode = 'deadlines', auto = null, manual = false;
    stage.innerHTML = '<div class="scene-cal"></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Mon', 'Tue', 'Wed'], from: 9, to: 18 });
    cal.add('m1', { fixed: true, title: 'Client workshop', day: 0, s: '10:30', e: '14:00' });
    cal.add('m2', { fixed: true, title: 'Team call', day: 0, s: '16:30', e: '18:00' });
    cal.add('m3', { fixed: true, title: 'Offsite', day: 1, s: '09:00', e: '18:00' });
    cal.add('m4', { fixed: true, title: 'Review', day: 2, s: '13:00', e: '14:00' });
    cal.add('p1', { title: 'Write proposal 1/2', day: 0, s: '09:00', e: '10:30' });
    cal.add('p2', { title: 'Write proposal 2/2', day: 0, s: '14:00', e: '16:30' });

    function show(m, quiet) {
      mode = m;
      [].forEach.call(seg, function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      var p1 = cal.el('p1'), p2 = cal.el('p2');
      if (m === 'focus') {
        cal.title('p1', 'Write proposal');
        cal.move('p1', 2, '09:00', '13:00');
        cal.move('p2', 2, '10:30', '13:00');
        p2.classList.add('is-gone');
        note.textContent = 'One 4-hour piece on Wednesday, the first free slot where it fits whole.';
      } else {
        cal.title('p1', 'Write proposal 1/2');
        p2.classList.remove('is-gone');
        cal.move('p1', 0, '09:00', '10:30');
        cal.move('p2', 0, '14:00', '16:30');
        note.textContent = 'Starts on Monday in two parts, in the earliest free time.';
      }
      p1.classList.toggle('is-moved', !quiet); p2.classList.toggle('is-moved', !quiet);
    }
    [].forEach.call(seg, function (b) {
      b.addEventListener('click', function () { manual = true; clearInterval(auto); show(b.dataset.mode); });
    });
    show('deadlines', true);
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    // switch every 5 seconds while visible, until the visitor picks one
    new IntersectionObserver(function (entries) {
      clearInterval(auto);
      if (!entries[0].isIntersecting || manual) return;
      auto = setInterval(function () { show(mode === 'focus' ? 'deadlines' : 'focus'); }, 5000);
    }, { threshold: 0.35 }).observe(stage);
  })();

  // ---------- 5. Progress, not pressure: Postpone, then Partially Done ----------
  scene('scene-progress', function (stage, host) {
    var steps = (host.closest('.feat') || host).querySelectorAll('[data-pstep]');
    function active(k) { [].forEach.call(steps, function (s) { s.classList.toggle('on', s.dataset.pstep === k); }); }
    active(null);
    stage.innerHTML = '<div class="scene-cal"></div>'
      + '<div class="task-progress"><span class="tp-name">Investor deck</span><i class="tp-bar"><b></b></i><em class="tp-val">2h planned</em></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Today', 'Tomorrow'], from: 9, to: 15 });
    cal.add('c', { fixed: true, title: 'Client call', day: 0, s: '09:00', e: '10:00' });
    cal.add('deck', { title: 'Investor deck', day: 0, s: '10:00', e: '12:00' });
    cal.add('port', { title: 'Update portfolio', day: 0, s: '12:00', e: '13:30' });
    cal.add('s', { fixed: true, title: 'Standup', day: 1, s: '09:00', e: '09:30' });
    var bar = stage.querySelector('.tp-bar b'), val = stage.querySelector('.tp-val');
    // the demo's Postpone submenu (time-block-actions.feature: Postpone flexible time block)
    var WHEN = [{ k: 'n', ic: 'cal', label: 'Nearest later', val: 'next free time' }, { k: 't', ic: 'cal', label: 'Tomorrow', val: 'tmr' }, { k: 'w', ic: 'cal', label: 'Next week', val: 'next week' }, { k: 'o', ic: 'cal', label: 'Other…', val: 'pick a date' }];
    var m;
    return {
      steps: [
        // Postpone → Tomorrow
        [0, function () { active('pp'); m = menu(stage, ACTIONS, cal.el('port')); }],
        [700, function () { pick(m, 'pp'); }],
        [700, function () { m.innerHTML = rows(WHEN); }],
        [600, function () { pick(m, 't'); }],
        [600, function () { m.remove(); cal.el('port').classList.add('is-moved'); cal.move('port', 1, '09:30', '11:00'); }],
        // Partially Done, step 1: time still needed
        [1600, function () { active('partial'); m = menu(stage, ACTIONS, cal.el('deck')); }],
        [700, function () { pick(m, 'partial'); }],
        [700, function () {
          m.innerHTML = '<div class="mh">Time still needed</div>' + rows([{ k: '30', ic: 'half', label: '30 minutes' }, { k: '60', ic: 'half', label: '1 hour' }, { k: '120', ic: 'half', label: '2 hours' }, { k: 'o', ic: 'half', label: 'Other…' }]);
        }],
        [600, function () { pick(m, '60'); }],
        // step 2: where the remaining work goes
        [700, function () { m.innerHTML = '<div class="mh">1h left · not earlier than</div>' + rows(WHEN); }],
        [600, function () { pick(m, 't'); }],
        // the time block is marked done, a 1-hour time block is added tomorrow
        [600, function () {
          m.remove();
          cal.el('deck').classList.add('is-done', 'flash');
          var el = cal.add('rest', { title: 'Investor deck', day: 1, s: '11:00', e: '12:00', note: '1h left' });
          el.classList.add('appear', 'is-moved');
          bar.style.width = '67%';
          val.textContent = '2h of 3h done';
        }],
      ],
    };
  });
})();
