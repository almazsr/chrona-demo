(function (C) {
  'use strict';
  const { $, $$, esc, at, D, hm, wd, p2, dayOf, dateOf, dow, fmtDay, fmtWhen, endLabel, range, fmtDur, parseDur, toLocal, fromLocal, PRN, DEF_PR, prName, prLabel, parsePr, parseWhen, isHuman, whenLabel, humanWhen, placeText, norm, clip, subtract, WDS } = C;
  const IC = C.icons, S = C.store.state;
  // scripted Auto-Fill (design doc "Scripted AI"): keyword rules, nothing leaves the browser
  const AI = [
    [/e-?mail|inbox|reply/i, '30m', 'Work'], [/gym|run|workout|yoga|swim/i, '1h', 'Gym'],
    [/kid|family|dinner|mom|dad|grocer|gift|vacation|trip/i, '1h 30m', 'Family'], [/landing|startup|blog|newsletter|side/i, '2h', 'Side hustle'],
    [/meet|call|sync|1:1|interview/i, '1h', 'Meetings'], [/report|proposal|review|tax|budget|slides|plan|write|code|draft/i, '2h', 'Work'],
  ];
  function predict(title) {
    const s = title.toLowerCase(), out = {}, hit = AI.find(([re]) => re.test(s));
    if (hit) { out.dur = { v: hit[1], c: 0.85 }; const cat = C.store.catByName(hit[2]); if (cat) out.cat = { v: cat.id, c: 0.85 }; }
    if (/\b(urgent|asap|immediately|critical)\b/.test(s)) out.pr = { v: 1, c: 0.9 }; else if (/\b(important|soon)\b/.test(s)) out.pr = { v: 2, c: 0.75 }; else if (/\b(someday|maybe|eventually)\b/.test(s)) out.pr = { v: 10, c: 0.8 };
    const m = /\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(s);
    if (m && (m[2] || m[3])) { let h = +m[1]; const mi = +(m[2] || 0); if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0; if (h < 24) out.start = { v: toLocal(at(/\b(tomorrow|tmr)\b/.test(s) ? C.clock.today + 1 : C.clock.today, h, mi)), c: 0.85 }; }
    if (!out.start) {
      if (/\bby (today|tonight|eod|end of day)\b/.test(s)) out.dl = { v: 'eod', c: 0.85 }; else if (/\bby (tomorrow|tmr)\b/.test(s)) out.dl = { v: 'eotmr', c: 0.85 }; else if (/\b(by|before) (the )?(eow|end of (the )?week|friday|weekend)\b/.test(s)) out.dl = { v: 'eow', c: 0.8 };
      if (/\bnext week\b/.test(s)) out.net = { v: 'next week', c: 0.8 }; else if (/\b(tomorrow|tmr)\b/.test(s) && !/\bby (tomorrow|tmr)\b/.test(s)) out.net = { v: 'tmr', c: 0.75 }; else if (/\bafter lunch\b/.test(s)) out.net = { v: 'today 13:00', c: 0.8 };
    }
    if (/\b(every ?day|daily)\b/.test(s)) out.rep = { v: { freq: 'daily', ends: { type: 'never' } }, c: 0.85 };
    else if (/\b(every weekday|weekdays)\b/.test(s)) out.rep = { v: { freq: 'weekdays', ends: { type: 'never' } }, c: 0.85 };
    else { const m = /\bevery (mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/.exec(s); if (m) out.rep = { v: { freq: 'custom', days: [WDS.findIndex(w => w.toLowerCase() === m[1])], every: 1, ends: { type: 'never' } }, c: 0.85 }; else if (/\bweekly\b/.test(s)) out.rep = { v: { freq: 'weekly', days: null, ends: { type: 'never' } }, c: 0.8 }; else if (/\bmonthly\b/.test(s)) out.rep = { v: { freq: 'monthly', ends: { type: 'never' } }, c: 0.8 }; }
    return out;
  }
  C.autofill = { predict, THRESHOLD: 0.7 };
})(window.Chrona = window.Chrona || {});
