/* Hero board: a sample founder's week. Adding a client call on Tuesday shows the core idea:
   meetings stay put, flexible tasks move to the next free slot in priority order.
   The "after" positions are written out by hand to match how the demo's solver would place them
   (scheduling-engine.feature: "Place flexible work in nearest free slot"). */
(function () {
  'use strict';

  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var NARROW_DAYS = [1, 2]; // phones: only the days where something happens
  var H0 = 9 * 60, H1 = 18 * 60;

  // id, kind (fixed|flex), title, day, start, end, [after: day, start, end]
  var BLOCKS = [
    ['m-su', 'fixed', 'Standup', 0, '09:00', '09:30'],
    ['m-q4', 'flex', 'Q4 budget review', 0, '09:30', '11:30'],
    ['m-11', 'fixed', '1:1 with Dana', 0, '12:00', '12:30'],
    ['m-ps', 'fixed', 'Product sync', 0, '14:00', '15:00'],
    ['m-rp', 'flex', 'Reply to partners', 0, '15:00', '16:00'],
    ['m-bp', 'fixed', 'Board prep call', 0, '16:30', '17:30'],

    ['t-su', 'fixed', 'Standup', 1, '09:00', '09:30'],
    ['t-iu', 'flex', 'Investor update', 1, '10:00', '11:30', [1, '13:00', '14:30']],
    ['t-lc', 'fixed', 'Lunch with candidate', 1, '12:00', '13:00'],
    ['t-hr', 'flex', 'Hiring pipeline review', 1, '13:00', '14:30', [1, '16:00', '17:30']],
    ['t-dr', 'fixed', 'Design review', 1, '15:00', '16:00'],
    ['t-wm', 'flex', 'Weekly metrics', 1, '16:00', '17:00', [2, '12:30', '13:30']],

    ['w-su', 'fixed', 'Standup', 2, '09:00', '09:30'],
    ['w-cw', 'fixed', 'Client workshop', 2, '10:00', '12:30'],
    ['w-jp', 'flex', 'Write job post', 2, '13:30', '15:00'],
    ['w-rt', 'fixed', 'Team retro', 2, '16:00', '17:00'],

    ['h-su', 'fixed', 'Standup', 3, '09:00', '09:30'],
    ['h-pc', 'flex', 'Pricing page copy', 3, '09:30', '11:00'],
    ['h-ah', 'fixed', 'All-hands', 3, '11:00', '12:00'],
    ['h-bd', 'flex', 'Board deck', 3, '13:00', '16:00'],
    ['h-ic', 'fixed', 'Investor call', 3, '16:30', '17:15'],

    ['f-su', 'fixed', 'Standup', 4, '09:00', '09:30'],
    ['f-pn', 'flex', 'Plan next week', 4, '09:30', '10:30'],
    ['f-cc', 'fixed', 'Customer call', 4, '11:00', '12:00'],
    ['f-ex', 'flex', 'Expense reports', 4, '14:00', '15:00'],
    ['f-dd', 'fixed', 'Demo day dry run', 4, '15:30', '16:30'],
  ];
  var LOCK = '<svg class="lk" width="10" height="11" viewBox="0 0 10 11" aria-hidden="true"><path fill="currentColor" d="M2.5 4.5V3a2.5 2.5 0 0 1 5 0v1.5H8a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h.5zm1.2 0h2.6V3a1.3 1.3 0 0 0-2.6 0v1.5z"/></svg>';
  var CALL = ['t-cc', 'fixed', 'Client call', 1, '10:00', '12:00'];

  var board = document.getElementById('board');
  if (!board) return;
  var grid = document.getElementById('board-grid');
  var daysEl = document.getElementById('board-days');
  var hoursEl = document.getElementById('board-hours');
  var log = document.getElementById('board-log');
  var idle = document.getElementById('board-idle');
  var btn = document.getElementById('board-play');
  var frame = board.querySelector('.board');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 720px)');
  var state = 'before'; // before | playing | after
  var timers = [];
  var els = {};
  var pos = {}; // id -> [day, start, end]

  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function visibleDays() { return narrow.matches ? NARROW_DAYS : [0, 1, 2, 3, 4]; }

  function makeBlock(b) {
    var el = document.createElement('div');
    el.className = 'blk ' + (b[1] === 'fixed' ? 'blk-meet' : 'blk-work');
    el.innerHTML = '<div class="bt"><b></b>' + (b[1] === 'fixed' ? LOCK : '') + '</div><small></small>';
    el.querySelector('b').textContent = b[2];
    grid.appendChild(el);
    els[b[0]] = el;
    pos[b[0]] = [b[3], b[4], b[5]];
  }

  function place(id) {
    var el = els[id], p = pos[id], days = visibleDays();
    var col = days.indexOf(p[0]);
    if (col < 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    var s = mins(p[1]), e = mins(p[2]), span = H1 - H0, w = 100 / days.length;
    el.style.top = ((s - H0) / span * 100) + '%';
    el.style.height = 'calc(' + ((e - s) / span * 100) + '% - 2px)';
    el.style.left = (col * w) + '%';
    el.style.width = 'calc(' + w + '% - 9px)';
    el.lastChild.textContent = p[1] + '–' + p[2];
    el.classList.toggle('is-short', e - s < 45);
  }

  function layout() {
    var days = visibleDays();
    frame.style.setProperty('--cols', days.length);
    daysEl.innerHTML = '<div></div>' + days.map(function (d) {
      return '<div' + (d === 1 && state !== 'before' ? ' class="is-hot"' : '') + '><span>' + DAYS[d] + '</span></div>';
    }).join('');
    Object.keys(els).forEach(place);
  }

  function hours() {
    var html = '';
    for (var m = H0; m < H1; m += 60) {
      html += '<span style="top:' + ((m - H0) / (H1 - H0) * 100) + '%">' + (m / 60 < 10 ? '0' : '') + (m / 60) + ':00</span>';
    }
    hoursEl.innerHTML = html;
  }

  function addLog(text, fixed) {
    var li = document.createElement('li');
    if (fixed) li.className = 'log-fixed';
    li.textContent = text;
    log.appendChild(li);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, reduced.matches ? 0 : ms)); }

  function play() {
    if (state !== 'before') return;
    state = 'playing';
    idle.hidden = true;
    log.innerHTML = '';
    btn.disabled = true;
    makeBlock(CALL);
    var call = els[CALL[0]];
    call.classList.add('is-new');
    place(CALL[0]);
    layout();
    void call.offsetWidth; // start the transition from the hidden state
    call.classList.remove('is-new');
    call.classList.add('is-in');
    addLog('Client call added, Tue 10:00–12:00', true);

    var moves = BLOCKS.filter(function (b) { return b[6]; });
    moves.forEach(function (b, i) {
      later(function () {
        pos[b[0]] = b[6];
        place(b[0]);
        els[b[0]].classList.add('is-moved');
        addLog(b[2] + ' moved to ' + DAYS[b[6][0]] + ' ' + b[6][1]);
      }, 650 + i * 520);
    });
    later(function () {
      addLog('Meetings untouched', true);
      state = 'after';
      btn.textContent = 'Undo the call';
      btn.disabled = false;
    }, 650 + moves.length * 520);
  }

  function undo() {
    clearTimers();
    var call = els[CALL[0]];
    if (call) { call.remove(); delete els[CALL[0]]; delete pos[CALL[0]]; }
    BLOCKS.forEach(function (b) {
      if (!b[6]) return;
      pos[b[0]] = [b[3], b[4], b[5]];
      els[b[0]].classList.remove('is-moved');
    });
    state = 'before';
    log.innerHTML = '';
    idle.hidden = false;
    btn.textContent = 'Add a client call on Tuesday';
    btn.disabled = false;
    layout();
  }

  btn.addEventListener('click', function () { if (state === 'after') undo(); else play(); });

  hours();
  BLOCKS.forEach(makeBlock);
  layout();
  (narrow.addEventListener ? narrow.addEventListener('change', layout) : narrow.addListener(layout));

  // Play once by itself when the board is first seen, unless the visitor prefers less motion.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      later(play, 900);
    }, { threshold: 0.35 });
    io.observe(frame);
  }
})();
