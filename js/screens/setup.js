(function (C) {
  'use strict';
  // Setup: time spaces (mockup 02), then categories (mockup 03), with a scripted assistant (setup.feature)
  const st = () => C.store.state;
  const S = () => C.store.state.session;
  let root = null, step = 'spaces', undoT = null, undoSnap = null, typingT = null, typingIdx = -1, docClick = null;

  const TEXT = {
    greet: "Hi! I'll help you set up your week in two short steps. Ask me anything, or start right away.",
    stepSpaces: 'Step 1: time spaces. A time space is a recurring part of your week kept for certain tasks, such as business hours for work. Pick the ones that fit your week. You can adjust hours with the pencil.',
    howSpaces: 'Think of time spaces as lanes in your week. Each category of tasks is linked to one or more time spaces: work goes into business hours, family plans into family time. When Chrona arranges your tasks, it uses only the hours of the linked time spaces, and splits big tasks across them if needed. You can change time spaces later in Settings.',
    stepCats: 'Step 2: categories. A category groups similar tasks, like Work or Gym. Linking it to time spaces tells Chrona when to schedule those tasks, and its color marks them in your calendar.',
    howCats: "When you add a task, you give it a category (or Chrona uses the default one). Chrona then places the task only inside the time spaces linked to that category: Work tasks inside business hours, Side hustle tasks inside free time. The default category is used whenever you don't pick one.",
  };
  // scripted replies by topic; repeated questions get the next aspect
  const ANSWERS = {
    chrona: [
      'Chrona is a calendar that plans your week for you. You add tasks with a duration, a priority and maybe a deadline, and Chrona places them into free time around your meetings.',
      'When your day changes, Chrona rearranges flexible time blocks to fit your time spaces, priorities and deadlines. Fixed time blocks, like meetings, never move.',
      "Chrona can split a long task into pieces of at least 30 minutes, so it fits into the gaps of a busy week.",
      "Time blocks that are behind you and not done wait for you in Review. Mark them done, partially done, or postpone them, and Chrona finds new time for what's left.",
    ],
    spaces: [
      'A time space is a recurring part of your week kept for certain tasks, such as business hours for work or evenings for family.',
      'Each category is linked to one or more time spaces. Chrona places tasks of a category only inside its linked time spaces.',
      'Time spaces can overlap: free time and family time can share your evenings. You can change their hours any time in Settings.',
    ],
    cats: [
      'A category groups similar tasks, like Work or Gym. Its color marks those tasks in your calendar.',
      "The default category is used whenever you don't pick one for a task. There is always exactly one default category.",
      'Linking a category to time spaces tells Chrona when to schedule its tasks: Work inside business hours, Side hustle inside free time.',
    ],
  };
  const RE = {
    act: /(let'?s\s+(get\s+)?start|get(ting)?\s+started|set\s+me\s+up|set\s+(it|everything|things)\s+up|start\s+(the\s+)?setup|let'?s\s+(go|begin|do\s+it))/,
    cats: /categor/,
    spaces: /time[\s-]*spaces?/,
    how: /how\s+(does\s+)?(it|this|that|they)\s+works?|how\s+do(es)?\s+(it|this|that|they)\s+work/,
    chrona: /chrona|this\s+app|the\s+app|who\s+are\s+you|what\s+(can|do)\s+you\s+do|about\s+you/,
    domain: /calendar|schedul|task|time\s*blocks?|plan|priorit|deadline|meeting|review|split/,
    more: /tell\s+me\s+more|^\s*(what\s+is|what's)\s+(it|this|that)\W*$|^\s*explain(\s+more)?\W*$/,
  };

  const chat = () => S().chat;
  const lastIdx = kind => { const ch = chat(); for (let i = ch.length - 1; i >= 0; i--) if (ch[i].kind === kind) return i; return -1; };
  const cardKind = () => (step === 'categories' ? 'step-cats' : 'step-spaces');
  const started = () => step === 'categories' || lastIdx('step-spaces') >= 0 || lastIdx('step-cats') >= 0;
  function moveCard(kind) {
    const ch = chat(), i = lastIdx(kind);
    const card = i >= 0 ? ch.splice(i, 1)[0] : { from: 'ai', kind, text: kind === 'step-cats' ? TEXT.stepCats : TEXT.stepSpaces };
    ch.push(card);
  }
  function ensureChat() {
    const s = S();
    if (!Array.isArray(s.chat)) s.chat = [];
    let changed = false;
    if (!s.chat.length) { s.chat.push({ from: 'ai', kind: 'greet', text: TEXT.greet }); changed = true; }
    if (step === 'categories' && lastIdx('step-cats') < 0) { pushProceed(); changed = true; }
    if (changed) C.store.save();
  }
  function pushProceed() {
    const ch = chat();
    ch.push({ from: 'user', text: 'Proceed' });
    ch.push({ from: 'ai', kind: 'summary', text: `\u2713 Time spaces saved: ${st().spaces.map(s => s.name).join(', ') || 'none'}.` });
    moveCard('step-cats');
  }

  // ---------- rendering ----------
  const PILL = (a, label, cls = '') => `<span class="su-pill${cls ? ' ' + cls : ''}" data-a="${a}">${label}</span>`;
  function body(m, i) {
    const live = (m.kind === 'step-spaces' && step === 'spaces') || (m.kind === 'step-cats' && step === 'categories');
    switch (m.kind) {
      case 'greet':
        return C.esc(TEXT.greet) + (!started() ? `<br>${PILL('start', "Let's get started")}` : '');
      case 'step-spaces':
        return `<b>Step 1: time spaces.</b> A time space is a recurring part of your week kept for certain tasks, such as business hours for work. Pick the ones that fit your week. You can adjust hours with <span class="su-pencil">${C.sc.PENCIL}</span>.
          <div class="su-chips">${C.sc.spaceChips(live) || '<span class="muted">No time spaces saved.</span>'}</div>
          ${live ? `<div class="su-acts">${PILL('how', 'How it works?', 'ghost')}${st().spaces.length ? PILL('proceed', 'Proceed \u2192', 'primary') : ''}</div>` : ''}`;
      case 'step-cats':
        return `<b>Step 2: categories.</b> A category groups similar tasks, like Work or Gym. Linking it to time spaces tells Chrona when to schedule those tasks, and its color marks them in your calendar.
          <div class="su-chips">${C.sc.catChips(live) || '<span class="muted">No categories saved.</span>'}</div>
          ${live ? `<div class="su-acts">${PILL('how', 'How it works?', 'ghost')}${st().cats.length ? PILL('finish', 'Finish \u2192', 'primary') : ''}</div>` : ''}`;
      case 'how-spaces':
        return C.esc(TEXT.howSpaces) + (step === 'spaces' && lastIdx('step-spaces') < i ? `<br>${PILL('ok', 'OK, got it')}` : '');
      case 'how-cats':
        return C.esc(TEXT.howCats) + (step === 'categories' && lastIdx('step-cats') < i ? `<br>${PILL('ok', 'OK, got it')}` : '');
      default:
        return C.esc(m.text);
    }
  }
  function renderChat() {
    const el = root.querySelector('.su-chat'), ch = chat();
    let h = '';
    for (let i = 0; i < ch.length; i++) {
      const m = ch[i];
      if (i === typingIdx) { h += '<div class="su-msg bot su-typing"><div class="su-who">Chrona assistant</div><span></span><span></span><span></span></div>'; break; }
      if (m.from === 'user') h += `<div class="su-msg me">${C.esc(m.text)}</div>`;
      else h += `<div class="su-msg bot${m.kind === 'summary' ? ' su-summary' : ''}"><div class="su-who">Chrona assistant</div>${body(m, i)}</div>`;
    }
    el.innerHTML = h;
    el.scrollTop = el.scrollHeight;
  }
  function renderStepper() {
    const a = step === 'categories';
    root.querySelector('.su-stepper').innerHTML = `<span class="${a ? 'done' : 'on'}"><span class="dot">${a ? '\u2713' : '1'}</span>Time spaces</span> \u2014 <span class="${a ? 'on' : ''}"><span class="dot">2</span>Categories</span>`;
  }
  function renderWeek() {
    const n = st().spaces.length, k = st().cats.length;
    root.querySelector('.su-pvt').innerHTML = `<span><b>Your week</b> \u00b7 ${step === 'categories' ? 'dots = linked categories, click a band to edit' : 'hover to see times, click a band to edit'}</span><span>${n} ${n === 1 ? 'time space' : 'time spaces'}${step === 'categories' ? ` \u00b7 ${k} ${k === 1 ? 'category' : 'categories'}` : ''}</span>`;
    C.sc.week(root.querySelector('.su-wk'), { onBand: id => C.sc.editSpace(id, popOpts()) });
  }
  function render() { if (!root) return; renderStepper(); renderChat(); renderWeek(); }

  // ---------- chat actions ----------
  function say(userText, entries) {
    const ch = chat();
    if (userText) ch.push({ from: 'user', text: userText });
    const first = ch.length;
    entries.forEach(e => (e === 'card' ? moveCard(cardKind()) : ch.push(e)));
    C.store.save();
    clearTimeout(typingT);
    typingIdx = first < ch.length ? first : -1;
    render();
    if (typingIdx >= 0) typingT = setTimeout(() => { typingIdx = -1; if (root) renderChat(); }, 650);
  }
  function answer(topic) {
    const list = ANSWERS[topic], n = chat().filter(m => m.topic === topic).length;
    return { from: 'ai', topic, text: list[n % list.length] };
  }
  function reply(text) {
    const s = text.toLowerCase().replace(/[\u2018\u2019`]/g, "'");
    const on = started(), current = step === 'categories' ? 'cats' : 'spaces';
    const card = on ? ['card'] : [];
    if (RE.act.test(s)) {
      if (!on) return [{ from: 'ai', kind: 'step-spaces', text: TEXT.stepSpaces }];
      return [{ from: 'ai', text: step === 'categories' ? "We're already setting up. Pick the categories you need below, then press \u201cFinish\u201d." : "We're already setting up. Pick the time spaces that fit your week below, then press \u201cProceed\u201d." }, 'card'];
    }
    if (RE.cats.test(s)) return [answer('cats'), ...card];
    if (RE.spaces.test(s)) return [answer('spaces'), ...card];
    if (RE.how.test(s)) return [answer(current), ...card];
    if (RE.chrona.test(s) || RE.domain.test(s)) return [answer('chrona'), ...card];
    if (RE.more.test(s)) return [answer(on ? current : 'chrona'), ...card];
    return [{ from: 'ai', text: `Sorry, I can only help with Chrona and setting up your week. Ask me about Chrona, time spaces or categories${on ? '.' : ', or press \u201cLet\u2019s get started\u201d.'}` }, ...card];
  }
  function send(text) {
    text = String(text || '').trim(); if (!text) return;
    say(text, reply(text));
  }
  function proceed() {
    hideUndo();
    pushProceed();
    S().step = 'categories';
    C.store.save();
    C.go('#/setup/categories');
  }

  // ---------- undo for removed chips ----------
  function showUndo(r) {
    hideUndo(); if (!r) return;
    undoSnap = r.snapshot;
    const u = root.querySelector('.su-undo');
    u.querySelector('b').textContent = `Removed \u201c${r.name}\u201d`;
    u.hidden = false;
    undoT = setTimeout(hideUndo, 5000);
  }
  function hideUndo() {
    clearTimeout(undoT); undoT = null; undoSnap = null;
    const u = root && root.querySelector('.su-undo'); if (u) u.hidden = true;
  }

  const popOpts = () => ({ persist: true, onSave: () => { hideUndo(); render(); } });

  // ---------- setup confirmation ----------
  function openConfirm() {
    const spaces = st().spaces, cats = st().cats;
    const ov = C.ui.modal(`<div class="modal sc-pop su-confirm"><h5>Confirm your setup</h5>
      <table class="su-sumtbl">
        <tr><td>Time spaces</td><td>${spaces.map(s => C.esc(s.name)).join(', ')}</td></tr>
        <tr><td>Categories</td><td>${cats.map(c => `<span class="su-cat"><i style="background:${C.esc(c.color)}"></i>${C.esc(c.name)}${c.def ? ' <em class="muted">(default)</em>' : ''}</span>`).join('')}</td></tr>
      </table>
      <label class="su-sample"><input type="checkbox" data-sample checked><span>Add sample time blocks<small class="muted">About 25 time blocks across last week, this week and next week, so you can try the calendar, list and review.</small></span></label>
      <div class="actions"><span class="b" data-cf="cancel">Cancel</span><span class="b p" data-cf="confirm">Confirm</span></div></div>`);
    ov.onclick = null;
    const m = ov.querySelector('.su-confirm');
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-cf]'); if (!b) return;
      if (b.dataset.cf === 'cancel') { C.ui.closeModal(); return; }
      confirmSetup(m.querySelector('[data-sample]').checked);
    });
  }
  function confirmSetup(sample) {
    const s = S();
    hideUndo(); C.ui.closeModal();
    try { if (sample && C.sample) C.sample.add(); } catch (e) { console.error(e); }
    s.setupDone = true; s.draft = null;
    try { if (C.solver) C.solver.replan(); } catch (e) { console.error(e); }
    C.store.save();
    C.go('#/calendar');
  }

  // ---------- events ----------
  async function onClick(e) {
    const t = e.target.closest('[data-a],[data-sc],[data-av],[data-avatar],[data-undo]');
    if (!t) return;
    const d = t.dataset;
    if (d.avatar) { const menu = root.querySelector('.avmenu'); menu.hidden = !menu.hidden; return; }
    if (d.av) {
      root.querySelector('.avmenu').hidden = true;
      if (d.av === 'signout') { S().signedIn = false; C.store.save(); C.go('#/sign-in'); return; }
      if (await C.ui.confirm({ title: 'Reset demo?', text: 'This deletes your setup, settings and all time blocks, and starts the demo from sign-in.', ok: 'Reset', danger: true })) { C.store.reset(); C.go('#/sign-in'); }
      return;
    }
    if (d.undo) { if (undoSnap) { C.sc.restore(undoSnap); hideUndo(); render(); } return; }
    if (d.a === 'start') { if (!started()) say("Let's get started", [{ from: 'ai', kind: 'step-spaces', text: TEXT.stepSpaces }]); return; }
    if (d.a === 'how') { say('How it works?', [step === 'categories' ? { from: 'ai', kind: 'how-cats', text: TEXT.howCats } : { from: 'ai', kind: 'how-spaces', text: TEXT.howSpaces }]); return; }
    if (d.a === 'ok') { say('OK, got it', ['card']); return; }
    if (d.a === 'proceed') { if (st().spaces.length) proceed(); return; }
    if (d.a === 'finish') { if (st().cats.length) openConfirm(); return; }
    const sc = d.sc, id = d.id;
    if (sc === 'pre-space') { hideUndo(); C.sc.addPresetSpace(d.key); render(); }
    else if (sc === 'rm-space') { const r = C.sc.removeSpace(id); render(); showUndo(r); }
    else if (sc === 'edit-space') C.sc.editSpace(id, popOpts());
    else if (sc === 'custom-space') C.sc.newSpace(popOpts());
    else if (sc === 'pre-cat') { hideUndo(); const r = C.sc.addPresetCat(d.key); if (r.values) C.sc.newCat(popOpts(), r.values); else render(); }
    else if (sc === 'rm-cat') { const r = C.sc.removeCat(id); render(); showUndo(r); }
    else if (sc === 'edit-cat') C.sc.editCat(id, popOpts());
    else if (sc === 'custom-cat') C.sc.newCat(popOpts());
  }

  C.screen('setup', {
    mount(el, params) {
      step = params && params.step === 'categories' ? 'categories' : 'spaces';
      typingIdx = -1;
      ensureChat();
      const s = S();
      el.innerHTML = `<div class="su">
        <div class="su-hdr">
          <div class="logo"><span class="mark"></span>Chrona</div>
          <div class="su-stepper"></div>
          <div class="avwrap"><span class="avatar" data-avatar="1" title="Account">${C.esc((s.email || 'Y')[0].toUpperCase())}</span>
            <div class="avmenu" hidden><div class="avmail">${C.esc(s.email || 'you@example.com')}<br>Signed in with ${C.esc(s.provider || 'Google')}</div><div class="avi" data-av="reset">Reset demo</div><div class="avi dng" data-av="signout">Sign out</div></div></div>
        </div>
        <div class="su-split">
          <div class="su-left">
            <div class="su-chat"></div>
            <div class="su-undo" hidden><b></b><span data-undo="1">Undo</span></div>
            <form class="su-input" autocomplete="off"><input type="text" placeholder="Type a message\u2026" aria-label="Message to the assistant"><button type="submit" class="su-send" title="Send">${C.icons.send}</button></form>
          </div>
          <div class="su-right"><div class="su-pvt"></div><div class="su-wk"></div></div>
        </div>
      </div>`;
      root = el.firstElementChild;
      root.addEventListener('click', onClick);
      root.querySelector('.su-input').addEventListener('submit', e => {
        e.preventDefault();
        const inp = e.target.querySelector('input');
        send(inp.value); inp.value = '';
      });
      docClick = e => { const m = root && root.querySelector('.avmenu'); if (m && !m.hidden && !e.target.closest('.su .avwrap')) m.hidden = true; };
      document.addEventListener('click', docClick);
      render();
      if (s.draft) C.sc.openDraft(popOpts());
    },
    unmount() {
      clearTimeout(typingT); clearTimeout(undoT);
      typingT = null; undoT = null; undoSnap = null; typingIdx = -1;
      if (docClick) document.removeEventListener('click', docClick);
      docClick = null; root = null;
    },
  });
})(window.Chrona = window.Chrona || {});
