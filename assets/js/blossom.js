/* Asendify — blossom overlay (pink -> blue -> red as you scroll). Lightweight canvas, pointer-events none.
   Skips on reduced-motion, pauses when the tab is hidden, fewer petals on phones.
   2026-10-19 (Manthan): petals stay on screen for 3 seconds, then fade away and stop, so the page stays easy to read. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('blossom')) return; // 2026-10-19: never run twice on one page
  var c = document.createElement('canvas');
  c.id = 'blossom';
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:960;pointer-events:none;';
  document.body.appendChild(c);
  var ctx = c.getContext('2d', { alpha: true });
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  var N = mobile ? 14 : 28;
  var petals = [], wind = 0, t = 0, running = true, last = 0;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.floor(W * DPR); c.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function make(fresh) {
    var s = 5 + Math.random() * 7; // petal size px
    return {
      x: Math.random() * W,
      y: fresh ? -20 - Math.random() * 40 : Math.random() * H,
      s: s,
      vy: 0.35 + Math.random() * 0.55 + s * 0.03,
      vx: 0,
      ph: Math.random() * Math.PI * 2,     // sway phase
      sw: 0.6 + Math.random() * 0.9,       // sway amplitude
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.03,
      a: 0.45 + Math.random() * 0.4,       // opacity
      light: Math.random() < 0.3   // 30% of petals are the paler shade
    };
  }
  // 2026-10-18 (Manthan): petals are pink at the top, turn blue as you scroll, then red near the bottom.
  // Colour stops: [pink, blue, red]; mix runs 0 (pink) -> 1 (blue) -> 2 (red).
  var MAIN = [[255,183,208],[120,170,255],[255,92,92]], PALE = [[255,214,228],[190,215,255],[255,190,190]], CORE = [[255,120,160],[40,110,240],[205,25,40]];
  var mix = 0;
  function col(stops) {
    var i = mix < 1 ? 0 : 1, f = mix < 1 ? mix : mix - 1, a = stops[i], b = stops[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function ease(r) { r = Math.min(Math.max(r, 0), 1); return r * r * (3 - 2 * r); }
  function scrollMix() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var r = max > 0 ? (window.scrollY || document.documentElement.scrollTop) / max : 0;
    // pink at the top, fully blue by ~45% down, fully red by ~90% down
    return ease((r - 0.03) / 0.42) + ease((r - 0.5) / 0.4);
  }
  function petal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.a;
    ctx.fillStyle = col(p.light ? PALE : MAIN);
    var s = p.s;
    ctx.beginPath();
    // cherry-blossom petal: rounded with a small notch at the tip
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s, s * 0.9, s * 0.4, 0, s * 0.95);
    ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.9, -s, 0, -s);
    ctx.fill();
    ctx.globalAlpha = p.a * 0.55;
    ctx.fillStyle = col(CORE);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.35, s * 0.25, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / 45) return; // ~45 fps cap
    var dt = Math.min((now - last) / 16.7, 3); last = now;
    t += 0.004 * dt;
    wind = Math.sin(t) * 0.35 + Math.sin(t * 2.7) * 0.15;
    var target = scrollMix(); mix += (target - mix) * 0.08 * dt;   // glide towards the scroll colour
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.ph += 0.02 * dt;
      p.vx = wind + Math.sin(p.ph) * p.sw * 0.35;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) petals[i] = make(true);
      petal(p);
    }
  }
  resize();
  for (var i = 0; i < N; i++) petals.push(make(false));
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!running && c.isConnected) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(function (n) { last = n; frame(n); });
  // Show for 3 s, fade out over 1.2 s, then stop drawing and remove the canvas.
  var SHOW_MS = 3000, FADE_MS = 1200;
  c.style.transition = 'opacity ' + FADE_MS + 'ms ease';
  setTimeout(function () {
    c.style.opacity = '0';
    setTimeout(function () { running = false; try { c.remove(); } catch (e) {} }, FADE_MS + 50);
  }, SHOW_MS);
})();
