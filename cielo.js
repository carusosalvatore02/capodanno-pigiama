/* Cielo di Capodanno: stelle che brillano e neve leggera dietro l'app. */
(function () {
  // data-dentro="#stage" sul tag script: il cielo va dentro quel riquadro (schermata TV)
  const sc = document.currentScript, dentro = sc && sc.dataset.dentro && document.querySelector(sc.dataset.dentro);
  const cv = document.createElement('canvas');
  cv.id = 'cielo'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = (dentro ? 'position:absolute;' : 'position:fixed;') + 'inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  (dentro || document.body).prepend(cv);
  const ctx = cv.getContext('2d');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)');
  let W = 0, H = 0, dpr = 1, stelle = [], fiocchi = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function misura() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = dentro ? dentro.clientWidth : innerWidth; H = dentro ? dentro.clientHeight : innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(W * H / 9000);
    stelle = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H * .75), r: rnd(.4, 1.3), f: rnd(0, 6.3), v: rnd(.6, 1.8) }));
    fiocchi = Array.from({ length: Math.round(W / 9) }, () => nuovo(true));
  }
  function nuovo(ovunque) { return { x: rnd(0, W), y: ovunque ? rnd(0, H) : -6, r: rnd(.8, 2.4), vy: rnd(14, 34), dx: rnd(8, 22), f: rnd(0, 6.3), a: rnd(.25, .7) }; }
  let prima = performance.now();
  function disegna(now) {
    const dt = Math.min(.05, (now - prima) / 1000); prima = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const s of stelle) {
      const a = calmo.matches ? .55 : .35 + .45 * (.5 + .5 * Math.sin(t * s.v + s.f));
      ctx.globalAlpha = a; ctx.fillStyle = '#FFF6E5';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    if (!calmo.matches) {
      ctx.fillStyle = '#FFFFFF';
      for (const f of fiocchi) {
        f.y += f.vy * dt; f.x += Math.sin(t * .8 + f.f) * f.dx * dt;
        if (f.y > H + 6) Object.assign(f, nuovo(false));
        ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!document.hidden && !calmo.matches) requestAnimationFrame(disegna);
  }
  function parti() { prima = performance.now(); requestAnimationFrame(disegna); }
  addEventListener('resize', () => { misura(); if (calmo.matches) parti(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !calmo.matches) parti(); });
  calmo.addEventListener && calmo.addEventListener('change', parti);
  misura(); parti();
})();
