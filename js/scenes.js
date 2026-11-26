/* Benefit animations (features/landing.feature, "Show each benefit with its own animation").
   Each scene is a small calendar drawn with the demo's look (blocks, lock, actions menu, toast)
   and a short script. A scene plays once when it scrolls into view, then offers "Replay".
   With reduced motion it shows its last frame. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var SVG = function (p) { return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    check: SVG('<path d="M3 8.5l3.2 3L13 4.5"/>'),
    half: SVG('<circle cx="8" cy="8" r="6"/><path d="M8 2v12A6 6 0 0 0 8 2z" fill="currentColor"/>'),
    later: SVG('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8h3"/><path d="M12.8 2.8l1.2 2.4-2.6.4"/>'),
    cal: SVG('<rect x="2.3" y="3.2" width="11.4" height="10.3" rx="1.6"/><path d="M2.3 6.5h11.4M5.5 2v2.4M10.5 2v2.4"/>'),
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
      grid: grid,
      el: function (id) { return els[id]; },
      band: function (day, s, e, label) {
        var el = document.createElement('div');
        el.className = 'mini-band';
        el.innerHTML = '<span>' + esc(label) + '</span>';
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
      remove: function (id) { if (els[id]) { els[id].remove(); delete els[id]; } },
    };
  }

  // actions menu drawn like the demo's (.cmenu), positioned next to a block
  function menu(host, items, anchor) {
    var m = document.createElement('div');
    m.className = 'scene-menu';
    m.innerHTML = items.map(function (it) {
      return '<div class="mi" data-k="' + it.k + '"><span class="ic">' + (IC[it.ic] || '') + '</span><span class="lab">' + esc(it.label) + '</span>' + (it.val ? '<span class="val">' + esc(it.val) + '</span>' : '') + (it.arr ? '<span class="arr">›</span>' : '') + '</div>';
    }).join('');
    host.appendChild(m);
    var hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    var left = ar.right - hr.left + 8;
    if (left + 200 > hr.width) left = Math.max(4, ar.left - hr.left - 200 - 8);
    m.style.left = left + 'px';
    m.style.top = Math.max(4, ar.top - hr.top) + 'px';
    return m;
  }
  function pick(m, k) { [].forEach.call(m.children, function (c) { c.classList.toggle('on', c.dataset.k === k); }); }

  function toast(host, html) {
    var t = document.createElement('div');
    t.className = 'scene-toast';
    t.innerHTML = html;
    host.appendChild(t);
    return t;
  }

  // ---------- playback ----------
  function scene(id, setup) {
    var host = document.getElementById(id);
    if (!host) return;
    var stage = host.querySelector('.scene-stage');
    var replay = host.querySelector('[data-replay]');
    var timers = [], played = false;

    function clear() { timers.forEach(clearTimeout); timers = []; }
    function run() {
      clear();
      if (replay) replay.hidden = true;
      var instant = reduced.matches;
      stage.classList.toggle('no-anim', instant);
      var s = setup(stage, host);
      var t = 0;
      s.steps.forEach(function (step) {
        t += step[0];
        if (instant) step[1](); else timers.push(setTimeout(step[1], t));
      });
      var end = function () { if (replay) replay.hidden = false; if (s.done) s.done(); };
      if (instant) end(); else timers.push(setTimeout(end, t + 400));
    }

    if (replay) replay.addEventListener('click', run);
    host.run = run;

    if (reduced.matches || !('IntersectionObserver' in window)) { run(); return; }
    // draw the first frame right away, start the script when the scene is in view
    setup(stage, host);
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || played) return;
      played = true;
      io.disconnect();
      run();
    }, { threshold: 0.45 });
    io.observe(stage);
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
      return '<li data-id="' + t[0] + '"><span class="todo-t">' + t[1] + '</span><span class="todo-d">' + t[2] + '</span><span class="todo-at"></span></li>';
    }).join('') + '</ol></div><div class="todo-cal"></div>';
    var cal = Mini(stage.querySelector('.todo-cal'), { days: DAYS, from: 9, to: 15 });
    cal.add('m1', { fixed: true, title: 'Client call', day: 0, s: '10:00', e: '11:00' });
    cal.add('m2', { fixed: true, title: 'Discovery call', day: 1, s: '09:00', e: '10:00' });
    cal.add('m3', { fixed: true, title: 'Lunch', day: 1, s: '12:00', e: '13:00' });
    cal.add('m4', { fixed: true, title: 'Workshop', day: 2, s: '11:00', e: '13:00' });

    return {
      steps: TASKS.map(function (t, i) {
        return [i ? 650 : 500, function () {
          var row = stage.querySelector('[data-id="' + t[0] + '"]');
          var el = cal.add(t[0], { title: t[1], day: t[3], s: t[4], e: t[5] });
          if (!stage.classList.contains('no-anim')) {
            var a = row.getBoundingClientRect(), b = el.getBoundingClientRect();
            el.style.transition = 'none';
            el.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)';
            el.style.opacity = '.4';
            void el.offsetWidth;
            el.style.transition = '';
            el.style.transform = '';
            el.style.opacity = '';
          }
          row.classList.add('is-placed');
          row.querySelector('.todo-at').textContent = DAYS[t[3]] + ' ' + t[4];
        }];
      }),
    };
  });

  // ---------- 2. Your evenings stay yours ----------
  scene('scene-evening', function (stage) {
    stage.innerHTML = '<div class="scene-cal"></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Mon', 'Tue'], from: 9, to: 22 });
    cal.band(0, '18:00', '22:00', 'Family time');
    cal.band(1, '18:00', '22:00', 'Family time');
    cal.add('a', { title: 'Proposal', day: 0, s: '09:00', e: '12:00' });
    cal.add('b', { fixed: true, title: 'Lunch', day: 0, s: '12:00', e: '13:00' });
    cal.add('c', { title: 'Edits', day: 0, s: '13:00', e: '14:00' });
    cal.add('d', { fixed: true, title: 'Client call', day: 0, s: '14:00', e: '15:00' });
    cal.add('e', { fixed: true, title: 'Workshop', day: 0, s: '15:00', e: '18:00' });
    cal.add('f', { fixed: true, title: 'Team call', day: 1, s: '11:00', e: '12:00' });
    var bands = stage.querySelectorAll('.mini-band');
    return {
      steps: [
        [500, function () { var el = cal.add('n', { title: 'Edit video', day: 0, s: '18:00', e: '20:00', cls: 'is-try' }); el.classList.add('appear'); }],
        [700, function () { bands[0].classList.add('is-hot'); }],
        [900, function () { var el = cal.el('n'); el.classList.remove('is-try'); el.classList.add('is-moved'); cal.move('n', 1, '09:00', '11:00'); bands[0].classList.remove('is-hot'); }],
      ],
    };
  });

  // ---------- 3. Focus first or deadlines first ----------
  (function () {
    var host = document.getElementById('scene-focus');
    if (!host) return;
    var stage = host.querySelector('.scene-stage');
    var seg = (host.closest('.feat') || host).querySelectorAll('[data-mode]');
    var note = host.querySelector('[data-focus-note]');
    var cal, mode = 'deadlines', auto = null, manual = false;
    stage.innerHTML = '<div class="scene-cal"></div>';
    cal = Mini(stage.querySelector('.scene-cal'), { days: ['Mon', 'Tue', 'Wed'], from: 9, to: 18 });
    cal.add('m1', { fixed: true, title: 'Client workshop', day: 0, s: '10:30', e: '14:00' });
    cal.add('m2', { fixed: true, title: 'Team call', day: 0, s: '16:30', e: '18:00' });
    cal.add('m3', { fixed: true, title: 'Offsite', day: 1, s: '09:00', e: '18:00' });
    cal.add('m4', { fixed: true, title: 'Review', day: 2, s: '13:00', e: '14:00' });
    cal.add('p1', { title: 'Write proposal 1/2', day: 0, s: '09:00', e: '10:30' });
    cal.add('p2', { title: 'Write proposal 2/2', day: 0, s: '14:00', e: '16:30' });

    function show(m) {
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
      p1.classList.add('is-moved'); p2.classList.add('is-moved');
    }
    [].forEach.call(seg, function (b) {
      b.addEventListener('click', function () { manual = true; clearInterval(auto); show(b.dataset.mode); });
    });
    show('deadlines');
    cal.el('p1').classList.remove('is-moved'); cal.el('p2').classList.remove('is-moved');
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    // switch by itself a few times while visible, until the visitor picks one
    var flips = 0;
    var io = new IntersectionObserver(function (entries) {
      clearInterval(auto);
      if (!entries[0].isIntersecting || manual || flips >= 4) return;
      auto = setInterval(function () {
        show(mode === 'focus' ? 'deadlines' : 'focus');
        if (++flips >= 4) clearInterval(auto);
      }, 2600);
    }, { threshold: 0.45 });
    io.observe(stage);
  })();

  // ---------- 4. Half done counts ----------
  scene('scene-partial', function (stage) {
    stage.innerHTML = '<div class="scene-cal"></div><div class="scene-progress"><span>Investor deck</span><i><b></b></i><em>0 of 3h</em></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Mon', 'Tue'], from: 9, to: 14 });
    cal.add('deck', { title: 'Investor deck', day: 0, s: '09:00', e: '12:00' });
    cal.add('l', { fixed: true, title: 'Lunch', day: 0, s: '12:00', e: '13:00' });
    cal.add('c', { fixed: true, title: 'Client call', day: 1, s: '09:00', e: '10:00' });
    var bar = stage.querySelector('.scene-progress b'), label = stage.querySelector('.scene-progress em');
    var m;
    return {
      steps: [
        [600, function () { m = menu(stage, [{ k: 'done', ic: 'check', label: 'Done' }, { k: 'partial', ic: 'half', label: 'Partially Done', arr: true }, { k: 'pp', ic: 'later', label: 'Postpone', arr: true }], cal.el('deck')); }],
        [700, function () { pick(m, 'partial'); }],
        [700, function () { m.innerHTML = '<div class="mi on"><span class="ic">' + IC.half + '</span><span class="lab">Time left</span><span class="val">1h</span></div><div class="mi"><span class="ic"></span><span class="lab">Then place it</span><span class="val">nearest free time</span></div>'; }],
        [800, function () {
          m.remove();
          var el = cal.el('deck');
          cal.move('deck', 0, '09:00', '11:00');
          el.classList.add('is-done', 'flash');
          bar.style.width = '67%';
          label.textContent = '2h of 3h done';
        }],
        [600, function () { var el = cal.add('rest', { title: 'Investor deck', day: 1, s: '10:00', e: '11:00', note: '1h left' }); el.classList.add('appear', 'is-moved'); }],
      ],
    };
  });

  // ---------- 5. Not today? Move it ----------
  scene('scene-postpone', function (stage) {
    stage.innerHTML = '<div class="scene-cal"></div>';
    var cal = Mini(stage.querySelector('.scene-cal'), { days: ['Today', 'Tomorrow'], from: 9, to: 14 });
    cal.add('c', { fixed: true, title: 'Client call', day: 0, s: '09:00', e: '10:00' });
    cal.add('w', { title: 'Client work', day: 0, s: '10:00', e: '12:30' });
    cal.add('p', { title: 'Update portfolio', day: 0, s: '12:30', e: '14:00' });
    cal.add('s', { fixed: true, title: 'Standup', day: 1, s: '11:00', e: '11:30' });
    var m;
    return {
      steps: [
        [600, function () { m = menu(stage, [{ k: 'done', ic: 'check', label: 'Done' }, { k: 'partial', ic: 'half', label: 'Partially Done', arr: true }, { k: 'pp', ic: 'later', label: 'Postpone', arr: true }], cal.el('p')); }],
        [700, function () { pick(m, 'pp'); }],
        [700, function () { m.innerHTML = '<div class="mi" data-k="n"><span class="ic">' + IC.cal + '</span><span class="lab">Nearest later</span></div><div class="mi" data-k="t"><span class="ic">' + IC.cal + '</span><span class="lab">Tomorrow</span></div><div class="mi" data-k="w"><span class="ic">' + IC.cal + '</span><span class="lab">Next week</span></div>'; }],
        [500, function () { pick(m, 't'); }],
        [600, function () { m.remove(); cal.el('p').classList.add('is-moved'); cal.move('p', 1, '09:00', '10:30'); }],
        [700, function () { toast(stage, 'Postponed “Update portfolio” to tomorrow · now 09:00'); }],
      ],
    };
  });

  // ---------- 6. You decide what can move ----------
  scene('scene-control', function (stage) {
    stage.classList.remove('is-on');
    return { steps: [[300, function () { stage.classList.add('is-on'); }]] };
  });
})();
