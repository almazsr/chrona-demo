/* "Try the demo" asks for name and email once, then opens the demo.
   A visitor who already filled it in this browser goes straight to the demo.
   The demo itself stays reachable by its direct link (soft gate). */
(function () {
  'use strict';

  var DONE_KEY = 'chrona.landing.contact';
  var DEMO_URL = 'demo/';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var dialog = document.getElementById('gate');
  var form = document.getElementById('gate-form');
  var top = document.querySelector('.top');

  function filledBefore() {
    try { return !!localStorage.getItem(DONE_KEY); } catch (e) { return false; }
  }
  function remember() {
    // Only a marker that the form was filled; the name and email are not kept in the browser.
    try { localStorage.setItem(DONE_KEY, JSON.stringify({ v: 1, at: new Date().toISOString() })); } catch (e) { /* ignore */ }
  }

  function openDemo() { location.href = DEMO_URL; }

  function showError(name, on) {
    var input = form.elements[name];
    form.querySelector('[data-err="' + name + '"]').hidden = !on;
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    if (on) input.setAttribute('aria-describedby', 'err-' + name);
  }

  form.querySelectorAll('.err').forEach(function (el) { el.id = 'err-' + el.dataset.err; });

  function validate() {
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var nameOk = name.length > 0, emailOk = EMAIL.test(email);
    showError('name', !nameOk);
    showError('email', !emailOk);
    if (!nameOk) form.elements.name.focus();
    else if (!emailOk) form.elements.email.focus();
    return nameOk && emailOk ? { name: name, email: email } : null;
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-open-demo]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work as a plain link
    e.preventDefault();
    if (filledBefore() || typeof dialog.showModal !== 'function') { openDemo(); return; }
    dialog.showModal();
    form.elements.name.focus();
  });

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true') showError(e.target.name, false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var lead = validate();
    if (!lead) return;
    var submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Opening the demo…';
    window.ChronaLeads.submit(lead).then(function () {
      remember();
      openDemo();
    });
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });

  // Coming back from the demo with the Back button restores this page from cache: reset the form.
  window.addEventListener('pageshow', function () {
    var submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Open the demo';
    if (dialog.open) dialog.close();
  });

  // Hairline under the sticky header once the page scrolls.
  var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
