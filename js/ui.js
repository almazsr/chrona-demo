(function (C) {
  'use strict';
  let toastT = null;
  const app = () => C.$('#cx-app');
  C.ui = {
    toast(html, ms = 3200) { const t = C.$('#cx-toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toastT); if (ms) toastT = setTimeout(() => { t.hidden = true; }, ms); },
    hideToast() { clearTimeout(toastT); C.$('#cx-toast').hidden = true; },
    modal(html) { const ov = C.$('#cx-ov'); ov.innerHTML = html; ov.hidden = false; return ov; },
    closeModal() { const ov = C.$('#cx-ov'); ov.hidden = true; ov.innerHTML = ''; ov.onclick = null; },
    confirm({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
      return new Promise(resolve => {
        const ov = C.ui.modal(`<div class="modal"><h5>${title}</h5>${text ? `<p style="margin:0 0 6px;line-height:1.5;color:#3b4656">${text}</p>` : ''}<div class="actions"><span class="b" data-cf="no">${C.esc(cancel)}</span><span class="b p${danger ? ' dng' : ''}" data-cf="yes">${C.esc(ok)}</span></div></div>`);
        ov.onclick = e => { const b = e.target.closest('[data-cf]'); if (!b && e.target !== ov) return; C.ui.closeModal(); resolve(!!b && b.dataset.cf === 'yes'); };
      });
    },
    // position a floating element at viewport point (x, y), kept inside the app
    placeAt(el, x, y, container) {
      const cr = (container || app()).getBoundingClientRect();
      el.hidden = false;
      let left = x - cr.left, top = y - cr.top;
      if (left + el.offsetWidth > cr.width - 6) left = Math.max(6, cr.width - el.offsetWidth - 6);
      if (top + el.offsetHeight > cr.height - 6) top = Math.max(6, cr.height - el.offsetHeight - 6);
      el.style.left = left + 'px'; el.style.top = top + 'px';
      return { left, top, width: cr.width };
    },
  };
})(window.Chrona = window.Chrona || {});
