(function (C) {
  'use strict';
  const { at } = C;
  const S = C.store.state;

  // Design doc "Sample data": about 25 time blocks across last, this, and next week, placed relative to today
  function add() {
    if (!S.cats.length) return;
    const { today, weekStart, weekEnd, now } = C.clock;
    const cat = name => (C.store.catByName(name) || C.store.defaultCat()).id;
    const W = cat('Work'), M = cat('Meetings'), F = cat('Family'), G = cat('Gym'), SH = cat('Side hustle');
    const weekday = (dir, k) => { let d = today, n = 0; while (n < k) { d += dir; if (C.dow(d) < 5) n++; } return d; };
    const next = k => weekday(1, k), prev = k => weekday(-1, k);
    const id = p => C.store.id(p);
    const fx = (title, c, d, h, m, dur, done = false) => S.fixed.push({ id: id('f'), title, cat: c, s: at(d, h, m), e: at(d, h, m) + dur, done, pr: C.DEF_PR });
    const lk = (title, c, d, h, m, dur, done, extra = {}) => S.locked.push(Object.assign({ id: id('l'), title, cat: c, s: at(d, h, m), e: at(d, h, m) + dur, done, pr: C.DEF_PR, dl: null, net: null, part: null, unmet: null }, extra));
    const tk = (title, c, dur, pr, extra = {}) => S.tasks.push(Object.assign({ id: id('t'), title, cat: c, dur, pr, net: null, dl: null, order: ++S.seq }, extra));

    // past: meetings done; flexible work partly done, the rest waits for review
    fx('Team sync', M, prev(5), 10, 0, 60, true);
    fx('Client call', M, prev(3), 13, 0, 60, true);
    lk('Prepare slides', W, prev(4), 11, 0, 120, true);
    lk('Pay bills', F, prev(4), 19, 0, 30, true);
    lk('Blog draft', SH, prev(5), 19, 0, 120, true, { part: '1/2' });
    lk('Blog draft', SH, prev(3), 19, 0, 120, false, { part: '2/2' });
    lk('Weekly report', W, prev(2), 14, 0, 120, false, { pr: 2, dl: at(prev(2), 12), unmet: [`Finishes after its deadline (${C.fmtWhen(at(prev(2), 12))})`] });
    lk('Call grandma', F, prev(2), 18, 30, 30, false, { pr: 2 });
    lk('Budget draft', W, prev(1), 14, 0, 120, false);
    lk('Landing page draft', SH, prev(1), 18, 0, 180, true);
    // done ahead of time
    lk('Expense report', W, next(1), 15, 0, 60, true);
    // upcoming fixed meetings, two of them overlapping
    fx('Client call', M, next(1), 13, 0, 60);
    fx('Workshop', M, next(2), 10, 0, 120);
    fx('Design review', M, next(2), 11, 0, 90);
    fx('1:1 with Anna', M, next(3), 15, 0, 60);
    fx('Family lunch', F, weekStart + 5 + (C.dow(today) >= 5 ? 7 : 0), 12, 0, 120);
    fx('Sprint demo', M, next(6), 14, 0, 60);
    // flexible work for the solver stand-in: every priority, deadlines, a split task, one that can't meet its deadline
    tk('Prepare report', W, 480, 1, { dl: at(next(3), 18) });
    tk('Tax forms', W, 180, 1, { dl: at(prev(1), 17) });
    tk('Landing page', SH, 240, 2);
    tk('Plan vacation', F, 120, 10);
    tk('Code review', W, 120, 10, { net: at(next(1), 9) });
    tk('Write blog post', SH, 120, 5, { dl: at(weekEnd + (C.dow(today) >= 5 ? 7 : 0), 23, 59) });
    tk('Update CV', SH, 90, 3);
    tk('Quarterly OKRs', W, 180, 2, { net: at(weekEnd + 1, 0), dl: at(weekEnd + 3, 18) });
    tk('Book dentist', F, 30, 10, { net: at(weekEnd + 2, 0) });

    // repeating series from last Monday; past ones done except the latest standup
    const from = weekStart - 7;
    const sr = (title, c, h, m, dur, rule, ends, pr = C.DEF_PR) => { const s = { id: id('r'), title, cat: c, start: h * 60 + m, dur, pr, rule, from, ends, ex: {} }; S.series.push(s); return s; };
    const standup = sr('Daily standup', M, 9, 30, 15, { freq: 'weekdays', days: null, every: 1 }, { type: 'never' });
    sr('Weekly planning', M, 9, 0, 30, { freq: 'weekly', days: [0], every: 1 }, { type: 'never' });
    sr('Gym', G, 7, 0, 60, { freq: 'custom', days: [0, 2, 4], every: 1 }, { type: 'count', n: 12 }, 2);
    for (const s of S.series.slice(-3)) for (const d of C.series.occDays(s)) if (at(d, 0) + s.start + s.dur <= now) C.series.exOf(s, d).done = true;
    const last = C.series.occDays(standup).filter(d => at(d, 0) + standup.start + standup.dur <= now).pop();
    if (last != null) delete standup.ex[last];
  }

  C.sample = { add };
})(window.Chrona = window.Chrona || {});
