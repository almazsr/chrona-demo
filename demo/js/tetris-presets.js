// Ready-made option sets for ChronaTetris.mount (js/tetris.js), used by demo sign-in and the landing page,
// so both show the same preview. Scenarios: authentication.feature, "Show a compact animated calendar on
// demo sign-in" (MOBILE) and "Show an animated week on demo sign-in" (DESKTOP); landing.feature.
(function (T) {
  'use strict';
  // Desktop preview: five days with half-hour rows from 08:00 to 23:00. Every day has its own
  // start (08:00-12:00) and end (17:00-23:00); a cleared day gets new random ones.
  const DESKTOP_TASKS = [
    ['work', 'Deep work', 180], ['work', 'Team sync', 60], ['gym', 'Gym', 90], ['work', 'Write report', 120],
    ['fam', 'Lunch', 60], ['work', 'Client call', 60], ['side', 'Side project', 240], ['work', 'Read emails', 30],
    ['fam', 'Family time', 180], ['work', 'Planning', 60], ['gym', 'Workout', 90], ['work', 'Code review', 120],
    ['fam', 'Dinner', 90], ['side', 'Reading', 60], ['fam', 'Errands', 150], ['work', 'Strategy offsite', 360],
  ];
  const at = (h, m = 0) => h * 60 + m;
  const randomBounds = () => ({ top: at(8) + 30 * Math.floor(Math.random() * 9), bottom: at(17) + 30 * Math.floor(Math.random() * 13) });
  const DESKTOP = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], hours: [at(8), at(23)], step: 30, grid: false,
    tasks: DESKTOP_TASKS.map(([cat, title, dur]) => ({ cat, title, dur })),
    bounds: [
      { top: at(9), bottom: at(17) }, { top: at(10, 30), bottom: at(19) }, { top: at(8, 30), bottom: at(21, 30) },
      { top: at(11), bottom: at(18) }, { top: at(9, 30), bottom: at(20, 30) },
    ],
    // about half of every day is filled at the start, bottom first
    start: [[8, 1], [6], [12, 0, 2], [3, 10], [14, 11, 5]], next: 4,
    // five days share the drops, so they come faster and no day waits for the others
    interval: [500, 1200], balance: false,
    onClear: randomBounds,
  };
  // Mobile preview: time blocks fall and stack like Tetris (js/tetris.js), five one-hour rows from 09:00
  const PREVIEW = [
    ['work', 'Deep work', 2], ['gym', 'Gym', 1], ['work', 'Read emails', 1], ['side', 'Side project', 2],
    ['work', 'Team call', 1], ['fam', 'Lunch', 1], ['work', 'Write report', 2], ['gym', 'Workout', 1],
    ['work', 'Planning', 1], ['side', 'Reading', 1],
  ];
  const MOBILE = {
    days: ['Mon', 'Tue', 'Wed'], hours: [9 * 60, 14 * 60], step: 60, rowHeight: 36,
    tasks: PREVIEW.map(([cat, title, h]) => ({ cat, title, dur: h * 60 })),
    // initial stacks, bottom first: 9 of 15 rows filled, so the preview opens busy
    // and the four-row column completes within the first few drops
    start: [[0, 1], [3, 4, 5], [2, 7]], next: 6,
  };
  T.presets = { DESKTOP, MOBILE };
})(window.ChronaTetris);
