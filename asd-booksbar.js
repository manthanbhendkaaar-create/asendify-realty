/* 2026-10-15 (Manthan: "books page visible everywhere, keep the bar as people scroll"):
   a gold bar fixed at the top of every page linking to the Asendify Books library. Fixed/sticky headers are
   moved down by the bar's height and the page gets matching top padding, so nothing is covered. */
(function () {
  try {
    if (window.__asdBooksBar) return; window.__asdBooksBar = 1;
    var s = document.currentScript;
    var src = (s && s.getAttribute('data-src')) || location.hostname.split('.')[0];
    var text = (s && s.getAttribute('data-text')) || 'New: Asendify Books · 21 practical playbooks. Pick your problem →';
    var href = 'https://www.asendify.co/books/?utm_source=' + encodeURIComponent(src) + '&utm_medium=topbar';
    function build() {
      if (document.getElementById('asd-booksbar')) return;
      var bar = document.createElement('a');
      bar.id = 'asd-booksbar'; bar.href = href; bar.textContent = innerWidth < 520 ? 'Asendify Books: 21 practical playbooks \u2192' : text;
      bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:2147483000;display:block;text-align:center;padding:8px 12px;' +
        'font:600 13px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.1px;background:#d4af37;color:#111;' +
        'text-decoration:none;box-shadow:0 1px 0 rgba(0,0,0,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
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
