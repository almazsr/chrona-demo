/* Small page behaviour: a hairline under the sticky header once the page scrolls. */
(function () {
  'use strict';
  var top = document.querySelector('.top');
  if (!top) return;
  var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
