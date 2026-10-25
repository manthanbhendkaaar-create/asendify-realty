/* 2026-10-15 (Manthan: "books page visible everywhere, keep the bar as people scroll"):
   a bar fixed at the top of every page linking to the Asendify Books library.
   2026-10-25 (Manthan: "make this short banner in shining red colour everywhere"): red gradient + moving shine
   (none with reduced motion); BOOKS_COUNT is the number of books on www.asendify.co/books/ (update it with a new book). Fixed/sticky headers are
   moved down by the bar's height and the page gets matching top padding, so nothing is covered. */
(function () {
  try {
    if (window.__asdBooksBar) return; window.__asdBooksBar = 1;
    var s = document.currentScript;
    var src = (s && s.getAttribute('data-src')) || location.hostname.split('.')[0];
    var BOOKS_COUNT = 23;
    var text = (s && s.getAttribute('data-text')) || 'New: Asendify Books · ' + BOOKS_COUNT + ' practical playbooks. Pick your problem →';
    var href = 'https://www.asendify.co/books/?utm_source=' + encodeURIComponent(src) + '&utm_medium=topbar';
    function build() {
      if (document.getElementById('asd-booksbar')) return;
      var bar = document.createElement('a');
      bar.id = 'asd-booksbar'; bar.href = href; bar.textContent = innerWidth < 520 ? 'Asendify Books: ' + BOOKS_COUNT + ' practical playbooks \u2192' : text;
      bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:2147483000;display:block;text-align:center;padding:8px 12px;' +
        'font:700 13px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.1px;' +
        'text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
      if (!document.getElementById('asd-booksbar-css')) {
        var css = document.createElement('style'); css.id = 'asd-booksbar-css';
        css.textContent = '#asd-booksbar{background:#c40c0c!important;background:linear-gradient(90deg,#b30000 0%,#e01b1b 50%,#b30000 100%)!important;' +
          'color:#fff!important;text-shadow:0 1px 1px rgba(0,0,0,.35);box-shadow:0 1px 0 rgba(0,0,0,.3),0 6px 16px -8px rgba(179,0,0,.85),inset 0 1px 0 rgba(255,255,255,.22)}' +
          '#asd-booksbar::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;pointer-events:none;' +
          'background:linear-gradient(110deg,transparent,rgba(255,255,255,.34),transparent);transform:skewX(-20deg);animation:asdbbshine 3.8s ease-in-out infinite}' +
          '@keyframes asdbbshine{0%,62%{left:-60%}100%{left:130%}}' +
          '#asd-booksbar:hover{filter:brightness(1.08)}#asd-booksbar:focus-visible{outline:2px solid #fff;outline-offset:-4px}' +
          '@media (prefers-reduced-motion:reduce){#asd-booksbar::after{animation:none;display:none}}';
        (document.head || document.documentElement).appendChild(css);
      }
      document.body.insertBefore(bar, document.body.firstChild);
      var basePad = parseFloat(getComputedStyle(document.body).paddingTop) || 0, moved = [];
      function topEls() {
        var out = [];
        document.querySelectorAll('header, nav, #navbar, [class*="navbar"], [class*="header"], [class*="topbar"]').forEach(function (el) {
          if (el === bar || el.closest('#asd-booksbar') || moved.indexOf(el) >= 0) return;
          var cs = getComputedStyle(el);
          if ((cs.position === 'fixed' || cs.position === 'sticky') && Math.abs(parseFloat(cs.top) || 0) < 2) out.push(el);
        });
        return out;
      }
      function apply() {
        var h = bar.offsetHeight;
        document.body.style.paddingTop = (basePad + h) + 'px';
        moved = moved.concat(topEls());
        moved.forEach(function (el) { el.style.setProperty('top', h + 'px', 'important'); });
      }
      apply(); setTimeout(apply, 600); setTimeout(apply, 2000);
      addEventListener('resize', apply);
      addEventListener('scroll', function () { if (topEls().length) apply(); }, { passive: true });
    }
    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  } catch (e) {}
})();
