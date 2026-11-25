/* =====================================================================
   VISO — ritaglio della foto del viso dentro una maschera ovale
   Viso.apri({ modo: 'camera' | 'galleria', titolo }) → Promise<Blob | null>
   - camera: fotocamera frontale con l'ovale sopra, poi ritocco
   - galleria: scelta della foto, poi ritocco (sposta, zoom, ruota con le dita)
   Il risultato è un JPG 480×600 (4:5) con il viso che riempie l'ovale.
   ===================================================================== */
(() => {
'use strict';
const OUT_W = 480, OUT_H = 600;

const css = `
.vz{position:fixed;inset:0;z-index:90;background:#0B1030;color:#FFF6E5;display:flex;flex-direction:column;align-items:center;font-family:'Nunito',system-ui,sans-serif;padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));gap:12px;touch-action:none;user-select:none;-webkit-user-select:none}
.vz h2{font-family:'Fredoka',system-ui,sans-serif;font-weight:700;font-size:22px;margin:0;text-align:center}
.vz p{margin:0;font-size:14px;color:#C9C6D6;text-align:center}
.vz-area{position:relative;border-radius:22px;overflow:hidden;background:#000;flex:none}
.vz-area video,.vz-area canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.vz-area video{object-fit:cover;transform:scaleX(-1)}
.vz-mask{position:absolute;inset:0;pointer-events:none}
.vz-row{display:flex;gap:10px;width:100%;max-width:420px;align-items:center}
.vz-btn{flex:1;min-height:50px;border-radius:14px;border:1px solid rgba(255,246,229,.25);background:transparent;color:#FFF6E5;font:800 15px 'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.vz-btn.pri{background:#FFC857;color:#1B2346;border-color:#FFC857}
.vz-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}
.vz-shot{width:74px;height:74px;border-radius:50%;border:5px solid #FFF6E5;background:#FFC857;cursor:pointer;flex:none}
.vz-shot:active{transform:scale(.94)}
.vz-slider{display:flex;align-items:center;gap:10px;width:100%;max-width:420px;font-size:13px;color:#C9C6D6;font-weight:800}
.vz-slider input{flex:1;accent-color:#FFC857;min-height:32px}
.vz-err{color:#FF8A8A;font-weight:700;font-size:14px;text-align:center}
`;
function stile() {
  if (document.getElementById('vz-css')) return;
  const s = document.createElement('style'); s.id = 'vz-css'; s.textContent = css; document.head.appendChild(s);
}

// Misure dell'area di lavoro e dell'ovale
function misure() {
  const w = Math.min(window.innerWidth - 32, 420);
  const h = Math.min(Math.round(w * 1.25), window.innerHeight - 290);
  const W = Math.round(Math.min(w, h / 1.25));
  const H = Math.round(W * 1.25);
  const rx = W * 0.36, ry = rx * 1.25;
  return { W, H, rx, ry, cx: W / 2, cy: H / 2 };
}
function maschera(m) {
  return `<svg class="vz-mask" viewBox="0 0 ${m.W} ${m.H}" width="${m.W}" height="${m.H}" aria-hidden="true">
    <path fill="rgba(11,16,48,.62)" fill-rule="evenodd" d="M0 0H${m.W}V${m.H}H0Z M${m.cx - m.rx} ${m.cy} a${m.rx} ${m.ry} 0 1 0 ${2 * m.rx} 0 a${m.rx} ${m.ry} 0 1 0 ${-2 * m.rx} 0Z"/>
    <ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="none" stroke="#FFC857" stroke-width="3" stroke-dasharray="10 8"/>
  </svg>`;
}

async function leggi(file) {
  let img = null;
  if (window.createImageBitmap) {
    for (const o of [{ imageOrientation: 'from-image' }, undefined]) {
      try { img = o ? await createImageBitmap(file, o) : await createImageBitmap(file); break; } catch (e) { /* prossimo */ }
    }
  }
  if (!img) {
    img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('FOTO_ILLEGGIBILE')); i.src = URL.createObjectURL(file); });
  }
  // le foto enormi rallentano i telefoni: le riduciamo a 2000 px
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight, sc = Math.min(1, 2000 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function apri(opz) {
  stile();
  return new Promise(risolvi => {
    const el = document.createElement('div'); el.className = 'vz'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    let stream = null;
    const chiudi = val => { if (stream) stream.getTracks().forEach(t => t.stop()); el.remove(); risolvi(val); };
    const titolo = opz.titolo || 'Il tuo viso';

    // ---------------------------------------------------- fotocamera
    async function camera() {
      const m = misure();
      el.innerHTML = `<h2>${titolo}</h2><p>Metti il viso dentro l'ovale e scatta</p>
        <div class="vz-area" style="width:${m.W}px;height:${m.H}px"><video playsinline autoplay muted></video>${maschera(m)}</div>
        <div class="vz-err" id="vz-err"></div>
        <div class="vz-row" style="justify-content:center;gap:18px"><button class="vz-btn" data-v="annulla" style="flex:0 0 96px">Annulla</button><button class="vz-shot" data-v="scatta" aria-label="Scatta"></button><label class="vz-btn" style="flex:0 0 96px">Galleria<input type="file" accept="image/*" data-v="file"></label></div>`;
      const video = el.querySelector('video');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        video.srcObject = stream; await video.play().catch(() => {});
      } catch (e) {
        el.querySelector('#vz-err').innerHTML = 'Non riesco ad aprire la fotocamera qui.';
        el.querySelector('.vz-row').innerHTML = `<button class="vz-btn" data-v="annulla">Annulla</button><label class="vz-btn pri">Apri la fotocamera<input type="file" accept="image/*" capture="user" data-v="file"></label>`;
      }
      el.onclick = e => {
        const v = e.target.closest('[data-v]') && e.target.closest('[data-v]').dataset.v;
        if (v === 'annulla') chiudi(null);
        if (v === 'scatta' && video.videoWidth) {
          // scatto: ritaglio quadrato al centro del video, specchiato come nell'anteprima
          const vw = video.videoWidth, vh = video.videoHeight, ar = m.W / m.H;
          let sw = vw, sh = vw / ar; if (sh > vh) { sh = vh; sw = vh * ar; }
          const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh);
          const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1);
          g.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
          stream.getTracks().forEach(t => t.stop()); stream = null;
          editor(c, true);
        }
      };
      el.onchange = async e => { if (e.target.dataset.v === 'file' && e.target.files[0]) { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } apriFile(e.target.files[0]); } };
    }

    // ---------------------------------------------------- galleria
    function galleria() {
      el.innerHTML = `<h2>${titolo}</h2><p>Scegli una foto in cui si veda bene il viso</p>
        <div class="vz-row" style="margin-top:20px"><button class="vz-btn" data-v="annulla">Annulla</button><label class="vz-btn pri">Scegli la foto<input type="file" accept="image/*" data-v="file"></label></div>`;
      el.onclick = e => { if (e.target.closest('[data-v="annulla"]')) chiudi(null); };
      el.onchange = e => { if (e.target.dataset.v === 'file' && e.target.files[0]) apriFile(e.target.files[0]); };
    }
    async function apriFile(file) {
      el.innerHTML = `<h2>${titolo}</h2><p>Un attimo…</p>`;
      try { editor(await leggi(file), false); }
      catch (e) { el.innerHTML = `<h2>${titolo}</h2><div class="vz-err">Questa foto non si riesce a leggere. Scegline un'altra.</div><div class="vz-row"><button class="vz-btn" data-v="annulla">Annulla</button><label class="vz-btn pri">Altra foto<input type="file" accept="image/*" data-v="file"></label></div>`; }
    }

    // ---------------------------------------------------- ritocco
    function editor(img, giaCentrata) {
      const m = misure();
      el.innerHTML = `<h2>${titolo}</h2><p>Sposta con un dito, ingrandisci e ruota con due dita</p>
        <div class="vz-area" style="width:${m.W}px;height:${m.H}px"><canvas width="${m.W * 2}" height="${m.H * 2}"></canvas>${maschera(m)}</div>
        <div class="vz-slider"><span>Zoom</span><input type="range" min="0.3" max="5" step="0.01" data-v="zoom"></div>
        <div class="vz-slider"><span>Ruota</span><input type="range" min="-180" max="180" step="1" value="0" data-v="ruota"><button class="vz-btn" style="flex:0 0 52px;min-height:40px" data-v="r90" aria-label="Ruota di 90 gradi">⟳</button></div>
        <div class="vz-row">${opz.modo === 'camera' ? '<button class="vz-btn" data-v="rifai">Rifai</button>' : '<label class="vz-btn">Altra foto<input type="file" accept="image/*" data-v="file"></label>'}<button class="vz-btn" data-v="annulla">Annulla</button><button class="vz-btn pri" data-v="ok">Conferma</button></div>`;
      const cv = el.querySelector('canvas'), g = cv.getContext('2d');
      const iw = img.width, ih = img.height;
      // stato: centro dell'immagine (in px dell'area), scala, rotazione in gradi
      const base = Math.max((m.ry * 2 * 1.15) / ih, (m.rx * 2 * 1.15) / iw);
      const S = { x: m.cx, y: m.cy, s: giaCentrata ? Math.max(m.W / iw, m.H / ih) : base, r: 0 };
      const zoom = el.querySelector('[data-v="zoom"]'), ruota = el.querySelector('[data-v="ruota"]');
      const sync = () => { zoom.value = (S.s / base).toFixed(2); ruota.value = Math.round(((S.r + 540) % 360) - 180); };
      function disegna(ctx, k, ox, oy) {
        ctx.save(); ctx.fillStyle = '#1B2346'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.translate((S.x - ox) * k, (S.y - oy) * k); ctx.rotate(S.r * Math.PI / 180); ctx.scale(S.s * k, S.s * k);
        ctx.drawImage(img, -iw / 2, -ih / 2); ctx.restore();
      }
      const ridisegna = () => disegna(g, 2, 0, 0);
      sync(); ridisegna();

      // gesti: un dito sposta, due dita zoomano e ruotano
      const dita = new Map(); let prec = null;
      const stato2 = () => { const [a, b] = [...dita.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); dita.set(e.pointerId, { x: e.clientX, y: e.clientY }); prec = dita.size === 2 ? stato2() : null; });
      cv.addEventListener('pointermove', e => {
        if (!dita.has(e.pointerId)) return;
        const vecchio = dita.get(e.pointerId); dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (dita.size === 1) { S.x += e.clientX - vecchio.x; S.y += e.clientY - vecchio.y; }
        else if (dita.size === 2) {
          const n = stato2();
          if (prec) { S.s = Math.min(base * 5, Math.max(base * .3, S.s * n.d / prec.d)); S.r += n.ang - prec.ang; S.x += n.mx - prec.mx; S.y += n.my - prec.my; }
          prec = n;
        }
        sync(); ridisegna();
      });
      const su = e => { dita.delete(e.pointerId); prec = dita.size === 2 ? stato2() : null; };
      cv.addEventListener('pointerup', su); cv.addEventListener('pointercancel', su);
      cv.addEventListener('wheel', e => { e.preventDefault(); S.s = Math.min(base * 5, Math.max(base * .3, S.s * (e.deltaY < 0 ? 1.06 : 0.94))); sync(); ridisegna(); }, { passive: false });
      zoom.oninput = () => { S.s = base * +zoom.value; ridisegna(); };
      ruota.oninput = () => { S.r = +ruota.value; ridisegna(); };
      el.onchange = e => { if (e.target.dataset.v === 'file' && e.target.files[0]) apriFile(e.target.files[0]); };
      el.onclick = e => {
        const b = e.target.closest('[data-v]'); if (!b || b.tagName === 'INPUT') return;
        const v = b.dataset.v;
        if (v === 'annulla') chiudi(null);
        if (v === 'rifai') camera();
        if (v === 'r90') { S.r += 90; sync(); ridisegna(); }
        if (v === 'ok') {
          // ritaglio: il rettangolo che contiene l'ovale, in uscita 480×600
          const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
          const k = OUT_W / (2 * m.rx);
          disegna(out.getContext('2d'), k, m.cx - m.rx, m.cy - m.ry);
          out.toBlob(b2 => chiudi(b2), 'image/jpeg', 0.86);
        }
      };
    }

    if (opz.file) apriFile(opz.file);
    else if (opz.modo === 'camera' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) camera();
    else if (opz.modo === 'camera') { galleria(); el.querySelector('p').textContent = 'Scatta una foto del viso'; el.querySelector('input').setAttribute('capture', 'user'); el.querySelector('.vz-btn.pri').firstChild.textContent = 'Apri la fotocamera'; }
    else galleria();
  });
}
window.Viso = { apri };
})();
