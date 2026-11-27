/* Where the early access form (js/early-access.js, features/early-access.feature) sends name and email.
   Shared by the landing page and the demo. Today nothing is sent: `endpoint` is null.
   To start collecting contacts, set `endpoint` to an HTTPS URL that accepts the POST described in
   landing/README.md ("Contact collection"), e.g. an AWS API Gateway route backed by a Lambda. */
window.ChronaLeads = (function () {
  'use strict';

  var config = {
    endpoint: null,
    timeoutMs: 4000,
  };

  var UTM_KEY = 'chrona.landing.source';

  // Remember where the visitor came from (Telegram post, chat, ad) for the lead record.
  function captureSource() {
    try {
      var q = new URLSearchParams(location.search), src = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'].forEach(function (k) {
        if (q.get(k)) src[k] = q.get(k).slice(0, 100);
      });
      if (Object.keys(src).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(src));
    } catch (e) { /* storage blocked: source is optional */ }
  }

  function source() {
    try { return JSON.parse(sessionStorage.getItem(UTM_KEY)) || {}; } catch (e) { return {}; }
  }

  // Resolves to true when the lead was accepted, false when it was not sent or failed.
  // Never rejects: a broken endpoint must not keep anyone out of the demo.
  function submit(lead) {
    if (!config.endpoint) return Promise.resolve(false);
    var body = JSON.stringify({
      name: lead.name,
      email: lead.email,
      via: lead.via || null,
      source: source(),
      page: location.origin + location.pathname,
      submittedAt: new Date().toISOString(),
    });
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, config.timeoutMs);
    return fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
  }

  captureSource();
  return { config: config, submit: submit };
})();
