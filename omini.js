/* =====================================================================
   OMINI — omini animati in pigiama natalizio con la faccia degli invitati
   const o = Omini.crea(contenitore, opzioni)
     opzioni.modo: 'app' (1–2 alla volta, passeggiano e sbucano dai riquadri)
                   'tv'  (scene comandate: folla, balletti, salti)
     opzioni.max: quanti insieme (app)
     opzioni.terra(): y della "terra" in coordinate del contenitore
     opzioni.riquadri(): elementi DOM da cui possono sbucare (app)
     opzioni.scala: dimensione di un adulto (bimbi = 70%)
   o.persone([{ id, faccia: url|null, voce: 'm'|'f'|'b', pigiama: 0..7, bimbo: bool }])
   o.scena([{ id, x, fa: 'balla'|'saltella'|'festa'|'cammina' }])   (tv)
   o.pausa(true|false)
   Interazioni: tocco = "Ahia!"; tieni premuto e trascina = penzola e urla;
   lascia piano = cade e rimbalza; lascia con uno scatto = vola via, urlo che
   si allontana e tonfo.
   ===================================================================== */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const C = window.CONFIG || {};

// ---------------------------------------------------------------- pigiami natalizi
const PIGIAMI = [
  { p: '<rect width="14" height="14" fill="#FFF6E5"/><path d="M-3 10 L10 -3 L17 -3 L-3 17Z M4 17 L17 4 L17 11 L11 17Z" fill="#D7263D"/>', b: '#D7263D' },
  { p: '<rect width="18" height="18" fill="#1E6B47"/><path d="M9 3.5 l1.3 2.8 3 .3-2.3 2 .7 3L9 10.1 6.3 11.6l.7-3-2.3-2 3-.3z" fill="#FFC857"/>', b: '#1E6B47' },
  { p: '<rect width="18" height="18" fill="#B3202E"/><rect y="6" width="18" height="5" fill="#1E5B43" opacity=".85"/><rect x="6" width="5" height="18" fill="#1E5B43" opacity=".85"/><rect y="14" width="18" height="1.3" fill="#FFC857"/><rect x="14" width="1.3" height="18" fill="#FFC857"/>', b: '#B3202E' },
  { p: '<rect width="20" height="20" fill="#2E5FA8"/><g stroke="#FFF6E5" stroke-width="1.5" stroke-linecap="round"><path d="M10 4.5v11M5.2 7.3l9.6 5.4M5.2 12.7l9.6-5.4"/></g>', b: '#2E5FA8' },
  { p: '<rect width="22" height="22" fill="#7A4A2A"/><circle cx="11" cy="12" r="3.4" fill="#C98B5A"/><circle cx="11" cy="14.5" r="1.4" fill="#E0303A"/><path d="M8.3 9.3 l-2.2 -4.5 M7.2 7 l-2.3 0 M13.7 9.3 l2.2 -4.5 M14.8 7 l2.3 0" stroke="#F0D9B5" stroke-width="1.3" stroke-linecap="round"/>', b: '#7A4A2A' },
  { p: '<rect width="16" height="16" fill="#D7263D"/><circle cx="4" cy="4" r="1.7" fill="#FFF6E5"/><circle cx="12" cy="12" r="1.7" fill="#FFF6E5"/>', b: '#D7263D', cint: 1 },
  { p: '<rect width="20" height="20" fill="#F3E1C4"/><circle cx="10" cy="6.5" r="2.8" fill="#B06A33"/><rect x="6.7" y="9.2" width="6.6" height="6.6" rx="2.2" fill="#B06A33"/><path d="M5.5 12h9" stroke="#B06A33" stroke-width="2.4" stroke-linecap="round"/>', b: '#B06A33', cap: '#D7263D' },
  { p: '<rect width="22" height="16" fill="#232E5C"/><path d="M0 4 Q5.5 8.5 11 4 T22 4" stroke="#0F1636" stroke-width="1" fill="none"/><ellipse cx="5.5" cy="9" rx="2.2" ry="3" fill="#FFC857"/><ellipse cx="16.5" cy="9" rx="2.2" ry="3" fill="#FF6B6B"/>', b: '#232E5C' }
];
const PELLI = ['#F2C9A0', '#E8B58A', '#D9A07A', '#F5D5B5'];
let seq = 0;

function svgOmino(uid, pg, pelle, faccia) {
  const id = 'omp' + uid, cap = pg.cap || pg.b;
  const gamba = (c, x) => `<g class="g${c}"><path d="M${x} 172 h16 v38 a8 8 0 0 1 -16 0z" fill="url(#${id})"/>${c === 'D' ? `<path d="M${x} 172 h16 v38 a8 8 0 0 1 -16 0z" fill="#000" opacity=".14"/>` : ''}<g class="s${c}"><path d="M${x + 1} 206 h14 v34 a7 7 0 0 1 -14 0z" fill="url(#${id})"/><rect x="${x}" y="236" width="16" height="6" rx="3" fill="${pg.b}"/><path d="M${x - 6} 246 q14 -10 28 0 q0 8 -14 8 q-14 0 -14 -8z" fill="#7A3B2E"/><ellipse cx="${x + 4}" cy="245" rx="6" ry="2.5" fill="#A0584A"/></g></g>`;
  return `<defs><pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse">${pg.p}</pattern><clipPath id="omv${uid}"><ellipse cx="60" cy="50" rx="32" ry="40"/></clipPath></defs>
  <ellipse class="ombra" cx="60" cy="262" rx="38" ry="7" fill="#0E1430" opacity=".5"/>
  <g class="tutto">
   ${gamba('D', 66)}${gamba('S', 38)}
   <g class="bD"><path d="M84 112 a8 8 0 0 1 14 4 l-3 34 h-13z" fill="url(#${id})"/><path d="M84 112 a8 8 0 0 1 14 4 l-3 34 h-13z" fill="#000" opacity=".15"/><g class="aD"><path d="M83 148 h12 l-1 30 h-10z" fill="url(#${id})"/><rect x="83" y="174" width="12" height="5" rx="2.5" fill="${pg.b}"/><ellipse cx="89" cy="185" rx="7" ry="8" fill="${pelle}"/></g></g>
   <g class="busto"><path d="M34 112 Q36 104 50 102 h20 Q84 104 86 112 L84 176 Q60 182 36 176Z" fill="url(#${id})"/><path d="M60 104 Q84 104 86 112 L84 176 Q72 179 60 179Z" fill="#000" opacity=".13"/>
    <path d="M40 112 Q40 106 48 105 L46 160" stroke="#fff" stroke-opacity=".18" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M50 102 L60 120 L70 102" fill="${pelle}"/><path d="M47 101 L60 121 L54 104Z M73 101 L60 121 L66 104Z" fill="${pg.b}"/>
    <line x1="60" y1="121" x2="60" y2="170" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>
    <circle cx="60" cy="132" r="2.6" fill="#FFF6E5"/><circle cx="60" cy="146" r="2.6" fill="#FFF6E5"/><circle cx="60" cy="160" r="2.6" fill="#FFF6E5"/>
    ${pg.cint ? '<rect x="35" y="160" width="50" height="8" fill="#1B1B1B"/><rect x="54" y="158.5" width="12" height="11" rx="2" fill="#FFC857"/>' : ''}
    <rect x="53" y="92" width="14" height="14" rx="5" fill="${pelle}"/><rect x="53" y="98" width="14" height="6" fill="#000" opacity=".12"/></g>
   <g class="bS"><path d="M36 112 a8 8 0 0 0 -14 4 l3 34 h13z" fill="url(#${id})"/><g class="aS"><path d="M25 148 h12 l-1 30 h-10z" fill="url(#${id})"/><rect x="25" y="174" width="12" height="5" rx="2.5" fill="${pg.b}"/><ellipse cx="31" cy="185" rx="7" ry="8" fill="${pelle}"/></g></g>
   <g class="testa">
    <ellipse cx="62" cy="53" rx="34" ry="42" fill="#000" opacity=".25"/><ellipse cx="60" cy="50" rx="33" ry="41" fill="${pelle}"/>
    <ellipse cx="26" cy="54" rx="5" ry="8" fill="${pelle}"/><ellipse cx="94" cy="54" rx="5" ry="8" fill="${pelle}"/>
    <g clip-path="url(#omv${uid})"><ellipse cx="60" cy="50" rx="32" ry="40" fill="${pelle}"/>
     ${faccia ? `<image href="${faccia}" x="28" y="10" width="64" height="80" preserveAspectRatio="xMidYMid slice"/>` : `
     <g class="occhiN"><ellipse cx="49" cy="46" rx="4.2" ry="5.4" fill="#1B2346"/><ellipse cx="71" cy="46" rx="4.2" ry="5.4" fill="#1B2346"/><circle cx="50.5" cy="44.3" r="1.5" fill="#fff"/><circle cx="72.5" cy="44.3" r="1.5" fill="#fff"/></g>
     <path d="M43 36 q6 -4 12 0 M65 36 q6 -4 12 0" stroke="#5A3A2A" stroke-width="2.4" fill="none" stroke-linecap="round"/>
     <ellipse cx="40" cy="61" rx="6" ry="3.5" fill="#FF8FA0" opacity=".55"/><ellipse cx="80" cy="61" rx="6" ry="3.5" fill="#FF8FA0" opacity=".55"/>
     <path class="boccaN" d="M48 66 Q60 80 72 66Z" fill="#7A2030" stroke="#1B2346" stroke-width="2.6"/>`}
     <g class="dolore" style="display:none">${faccia ? '' : '<ellipse cx="60" cy="70" rx="7" ry="10" fill="#7A2030" stroke="#1B2346" stroke-width="2.6"/>'}</g>
     <g class="occhiX" style="display:none" stroke="#1B2346" stroke-width="3" stroke-linecap="round">${faccia ? '' : '<path d="M44 41l9 9M53 41l-9 9M66 41l9 9M75 41l-9 9"/>'}</g>
     <ellipse cx="66" cy="55" rx="32" ry="40" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="10"/><ellipse cx="45" cy="26" rx="11" ry="6" fill="#fff" opacity=".24" transform="rotate(-28 45 26)"/></g>
    <ellipse cx="60" cy="50" rx="33" ry="41" fill="none" stroke="#0E1430" stroke-opacity=".35" stroke-width="2"/>
    <path d="M24 26 Q32 -12 72 -4 Q100 2 112 28 Q96 18 84 16 Q60 10 26 28Z" fill="${cap}"/><path d="M22 30 Q60 6 100 26 L100 33 Q60 14 22 37Z" fill="#FFF6E5"/>
    <g class="pom"><path d="M110 28 L118 44" stroke="${cap}" stroke-width="6" stroke-linecap="round"/><circle cx="119" cy="48" r="8" fill="#FFF6E5"/></g>
    <g class="stelle" style="display:none" fill="#FFC857"><path d="M20 -2l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L11 5l6-1z"/><path d="M100 -6l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L91 1l6-1z"/><path d="M60 -16l2.5 5 5 .8-3.6 3.4.8 5-4.7-2.5-4.7 2.5.8-5-3.6-3.4 5-.8z"/></g>
   </g>
  </g>`;
}

// ---------------------------------------------------------------- suoni
const Audio = (() => {
  let ac = null; const buf = {};
  const S = C.SUONI || {};
  const NOMI = { m: 'uomo', f: 'donna', b: 'bimbo' };
  function ctx() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; } }
  async function carica(url) {
    if (buf[url] !== undefined) return buf[url];
    buf[url] = null;
    try { const r = await fetch(url); if (!r.ok) throw 0; buf[url] = await ctx().decodeAudioData(await r.arrayBuffer()); } catch (e) { buf[url] = null; }
    return buf[url];
  }
  function lista(voce, tipo) { const g = S[NOMI[voce]] || {}; return g[tipo] || []; }
  function precarica() { Object.values(S).forEach(g => (Array.isArray(g) ? g : Object.values(g).flat()).forEach(u => typeof u === 'string' && carica(u))); }
  const caso = a => a[Math.floor(Math.random() * a.length)];
  const F0 = { m: 170, f: 320, b: 470 };
  // voce sintetica di riserva: vocale con formanti, tono che scende
  function sintetica(voce, vocale, dur, scendi, gainNode) {
    const a = ctx(); if (!a) return null;
    const f0 = F0[voce] || 200, o = a.createOscillator(), out = a.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.15, a.currentTime);
    if (dur && scendi) o.frequency.exponentialRampToValueAtTime(f0 * scendi, a.currentTime + dur);
    (vocale === 'a' ? [760, 1220, 2600] : vocale === 'i' ? [300, 2200, 2900] : [330, 800, 2300]).forEach((fr, k) => {
      const b = a.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr * (voce === 'b' ? 1.25 : voce === 'f' ? 1.12 : 1); b.Q.value = 7;
      const g = a.createGain(); g.gain.value = [1, .6, .25][k]; o.connect(b).connect(g).connect(out);
    });
    const vib = a.createOscillator(), vg = a.createGain(); vib.frequency.value = 6.5; vg.gain.value = f0 * .05; vib.connect(vg).connect(o.frequency); vib.start();
    const g = gainNode || a.createGain(); out.connect(g); if (!gainNode) g.connect(a.destination);
    g.gain.setValueAtTime(0, a.currentTime); g.gain.linearRampToValueAtTime(1.6, a.currentTime + .03);
    o.start();
    if (dur) { g.gain.setValueAtTime(1.6, a.currentTime + dur * .7); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur); o.stop(a.currentTime + dur + .05); vib.stop(a.currentTime + dur + .05); }
    return { o, vib, g, a, f0 };
  }
  function suona(b, opz) {
    const a = ctx(); if (!a || !b) return null;
    const s = a.createBufferSource(); s.buffer = b; s.loop = !!opz.loop; s.playbackRate.value = opz.rate || 1;
    const g = a.createGain(); g.gain.value = opz.vol == null ? 1 : opz.vol;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    s.connect(lp).connect(g).connect(a.destination); s.start();
    return { s, g, lp, a };
  }
  return {
    sblocca() { if (ctx()) precarica(); },
    async ahia(voce) {
      const l = lista(voce, 'ahia');
      const b = l.length ? await carica(caso(l)) : null;
      if (b) return suona(b, { rate: .95 + Math.random() * .12 });
      sintetica(voce, 'a', .5, .55); setTimeout(() => sintetica(voce, 'i', .3, .7), 110);
    },
    async urlo(voce) {
      const l = lista(voce, 'urlo');
      const b = l.length ? await carica(caso(l)) : null;
      if (b) { const h = suona(b, { loop: true }); h.tipo = 'file'; return h; }
      const h = sintetica(voce, 'o', 0); if (h) h.tipo = 'sint'; return h;
    },
    tono(h, k) { // k: 0..1 quanto è agitato
      if (!h) return;
      if (h.tipo === 'file') h.s.playbackRate.setTargetAtTime(1 + k * .35, h.a.currentTime, .06);
      else h.o.frequency.setTargetAtTime(h.f0 * (1.1 + k * 1.1), h.a.currentTime, .05);
    },
    ferma(h, sec) {
      if (!h) return; const t = h.a.currentTime;
      h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.exponentialRampToValueAtTime(.001, t + (sec || .25));
      setTimeout(() => { try { (h.s || h.o).stop(); h.vib && h.vib.stop(); } catch (e) { /* già fermo */ } }, (sec || .25) * 1000 + 80);
    },
    allontana(h) { // l'urlo si allontana: volume giù, suono più ovattato, tono che cala
      if (!h) return; const t = h.a.currentTime;
      if (h.lp) h.lp.frequency.exponentialRampToValueAtTime(700, t + 1.3);
      if (h.tipo === 'file') h.s.playbackRate.setTargetAtTime(.8, t, .5); else h.o.frequency.setTargetAtTime(h.f0 * .8, t, .5);
      this.ferma(h, 1.4);
    },
    async tonfo(vol) {
      const l = (S.tonfo || []);
      const b = l.length ? await carica(caso(l)) : null;
      if (b) return suona(b, { vol: vol == null ? .8 : vol });
      const a = ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, a.currentTime); o.frequency.exponentialRampToValueAtTime(40, a.currentTime + .25);
      g.gain.setValueAtTime(vol == null ? .9 : vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .35); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .4);
      const n = a.createBuffer(1, a.sampleRate * .15, a.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), lp = a.createBiquadFilter(), g2 = a.createGain(); s.buffer = n; lp.type = 'lowpass'; lp.frequency.value = 500; g2.gain.value = (vol == null ? .9 : vol) * .8; s.connect(lp).connect(g2).connect(a.destination); s.start();
    }
  };
})();

// ---------------------------------------------------------------- motore
function crea(cont, opz) {
  opz = Object.assign({ modo: 'app', max: 2, scala: .45, terra: () => cont.clientHeight, riquadri: () => [] }, opz || {});
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none';
  cont.style.touchAction = 'none'; cont.style.webkitTouchCallout = 'none'; cont.style.webkitUserSelect = 'none'; cont.style.userSelect = 'none';
  // niente menu "salva immagine" né lente/selezione tenendo premuto
  cont.addEventListener('contextmenu', e => e.preventDefault());
  cont.addEventListener('dragstart', e => e.preventDefault());
  cont.addEventListener('selectstart', e => e.preventDefault());
  cont.appendChild(svg);
  const fumi = document.createElement('div'); fumi.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible'; cont.appendChild(fumi);
  if (!document.getElementById('omini-css')) {
    const st = document.createElement('style'); st.id = 'omini-css';
    st.textContent = `.om-fum{position:absolute;background:#FFF6E5;color:#1B2346;font:800 15px 'Fredoka','Nunito',system-ui,sans-serif;padding:5px 11px;border-radius:14px;white-space:nowrap;transform:translate(-50%,-100%);box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .om-fum::after{content:'';position:absolute;left:50%;bottom:-7px;border:7px solid transparent;border-top-color:#FFF6E5;border-bottom:0;transform:translateX(-50%)}
    .om-g{pointer-events:visiblePainted;cursor:grab;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
    .om-g image{pointer-events:none;-webkit-touch-callout:none;-webkit-user-drag:none}`;
    document.head.appendChild(st);
  }
  let persone = [], vivi = [], ultimo = {}, pausa = false, prossimo = performance.now() + 1200, scenaTv = null;
  const fuori = 160;

  function scegli() {
    const presenti = new Set(vivi.map(o => o.p.id));
    const liberi = persone.filter(p => !presenti.has(p.id));
    if (!liberi.length) return null;
    liberi.sort((a, b) => (ultimo[a.id] || 0) - (ultimo[b.id] || 0));
    return liberi[Math.floor(Math.random() * Math.min(3, liberi.length))];
  }
  function nuovo(p, conf) {
    const uid = ++seq, pg = PIGIAMI[((p.pigiama | 0) % 8 + 8) % 8], pelle = PELLI[uid % PELLI.length];
    const esterno = document.createElementNS(NS, 'g'); svg.appendChild(esterno);
    const clip = document.createElementNS(NS, 'clipPath'); clip.id = 'omc' + uid;
    const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', -5000); r.setAttribute('y', -5000); r.setAttribute('width', 20000); r.setAttribute('height', 20000);
    clip.appendChild(r); svg.appendChild(clip); esterno.setAttribute('clip-path', `url(#omc${uid})`);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'om-g'); g.innerHTML = svgOmino(uid, pg, pelle, p.faccia); esterno.appendChild(g);
    const q = s => g.querySelector(s);
    const o = Object.assign({
      uid, p, esterno, g, clip, clipR: r, s: opz.scala * (p.bimbo ? .7 : 1), f: Math.random() * 6, x: 0, y: 0, vx: 0, vy: 0,
      dir: 1, stato: 'cammina', t0: performance.now(), fino: 0, sw: 0, swv: 0, rot: 0, rotv: 0,
      P: { tutto: q('.tutto'), busto: q('.busto'), testa: q('.testa'), pom: q('.pom'), gS: q('.gS'), gD: q('.gD'), sS: q('.sS'), sD: q('.sD'), bS: q('.bS'), bD: q('.bD'), aS: q('.aS'), aD: q('.aD'), ombra: q('.ombra'), oN: q('.occhiN'), oX: q('.occhiX'), bN: q('.boccaN'), dol: q('.dolore'), stelle: q('.stelle') }
    }, conf || {});
    g.addEventListener('pointerdown', e => premi(e, o));
    // iPhone: senza questo il browser si prende il dito (scorrimento, menu dell'immagine) e il trascinamento salta
    g.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    g.querySelectorAll('image').forEach(im => im.setAttribute('draggable', 'false'));
    ultimo[p.id] = performance.now();
    vivi.push(o);
    return o;
  }
  function togli(o) { o.clip.remove(); o.esterno.remove(); if (o.fum) o.fum.remove(); if (o.urlo) Audio.ferma(o.urlo); vivi = vivi.filter(x => x !== o); ultimo[o.p.id] = performance.now(); prossimo = performance.now() + 1200 + Math.random() * 2600; }

  // ---- comparse automatiche (app)
  function comparsa() {
    const p = scegli(); if (!p) return;
    const W = cont.clientWidth, carte = opz.riquadri().filter(el => { const b = el.getBoundingClientRect(), c = cont.getBoundingClientRect(); return b.width > 120 && b.top - c.top > 140 && b.top - c.top < cont.clientHeight - 60; });
    if (carte.length && Math.random() < .55) {
      const el = carte[Math.floor(Math.random() * carte.length)];
      const o = nuovo(p, { stato: 'sbuca', carta: el, rel: .15 + Math.random() * .7 });
      o.durata = 4200 + Math.random() * 1500;
    } else {
      const dx = Math.random() < .5 ? 1 : -1, o = nuovo(p, { stato: 'cammina', dir: dx });
      o.x = dx > 0 ? -120 * o.s - 20 : W + 20; o.vel = 38 + Math.random() * 18;
    }
  }

  // ---- interazione
  let presa = null, timer = null;
  function fumetto(o, t) {
    if (o.fum) o.fum.remove();
    const d = document.createElement('div'); d.className = 'om-fum'; d.textContent = t; fumi.appendChild(d); o.fum = d;
    clearTimeout(o.fumT); if (!o.urlo) o.fumT = setTimeout(() => { d.remove(); if (o.fum === d) o.fum = null; }, 1100);
  }
  const scala = () => { const b = cont.getBoundingClientRect(); return { b, k: b.width / (cont.clientWidth || b.width) }; };
  function premi(e, o) {
    if (o.stato === 'vola') return;
    e.preventDefault(); e.stopPropagation(); Audio.sblocca();
    const { b, k } = scala();
    presa = { o, id: e.pointerId, x0: e.clientX, y0: e.clientY, drag: false, b, k, storia: [] };
    try { o.g.setPointerCapture(e.pointerId); } catch (x) { /* niente */ }
    timer = setTimeout(() => iniziaDrag(), 230);
  }
  async function iniziaDrag() {
    if (!presa || presa.drag) return;
    presa.drag = true; const o = presa.o; o.prima = o.stato; o.stato = 'preso'; o.g.style.cursor = 'grabbing';
    o.clipR.setAttribute('height', 20000); o.clipR.setAttribute('y', -5000);
    o.urlo = 'attesa'; const u = await Audio.urlo(o.p.voce); if (o.urlo === 'attesa' && o.stato === 'preso') o.urlo = u; else Audio.ferma(u);
    fumetto(o, 'Uoooh!');
  }
  addEventListener('pointermove', e => {
    if (!presa || e.pointerId !== presa.id) return;
    if (!presa.drag && Math.hypot(e.clientX - presa.x0, e.clientY - presa.y0) > 8) { clearTimeout(timer); iniziaDrag(); }
    if (!presa.drag) return;
    const o = presa.o, now = performance.now(), k = presa.k;
    const px = (e.clientX - presa.b.left) / k, py = (e.clientY - presa.b.top) / k;
    presa.storia.push({ x: px, y: py, t: now }); presa.storia = presa.storia.filter(s => now - s.t < 110);
    const prima = presa.ultimo || { x: px, t: now - 16 };
    o.vx = (px - prima.x) / Math.max(8, now - prima.t) * 16; presa.ultimo = { x: px, t: now };
    o.x = px - 60 * o.s; o.y = py - 50 * o.s;
  });
  addEventListener('touchmove', e => { if (presa && e.cancelable) e.preventDefault(); }, { passive: false });
  addEventListener('pointerup', e => rilascia(e));
  addEventListener('pointercancel', e => rilascia(e));
  function rilascia(e) {
    if (!presa || e.pointerId !== presa.id) return;
    clearTimeout(timer); const o = presa.o;
    if (!presa.drag) { ahia(o); presa = null; return; }
    o.g.style.cursor = 'grab';
    const st = presa.storia, a = st[0], z = st[st.length - 1];
    const dt = a && z ? Math.max(16, z.t - a.t) : 100;
    const vx = a && z ? (z.x - a.x) / dt * 16 : 0, vy = a && z ? (z.y - a.y) / dt * 16 : 0;
    const urlo = o.urlo; o.urlo = null;
    if (Math.hypot(vx, vy) > 14) {           // lanciato via!
      o.stato = 'vola'; o.vx = vx * 1.1; o.vy = vy * 1.1 - 4; o.rotv = vx * .9 + (Math.random() - .5) * 10;
      Audio.allontana(urlo); if (o.fum) { o.fum.textContent = 'Uaaaaaah!'; }
      setTimeout(() => { Audio.tonfo(.55); }, 1150);
      setTimeout(() => { if (o.fum) { o.fum.remove(); o.fum = null; } }, 700);
    } else {                                  // lasciato giù: cade
      o.stato = 'cade'; o.vy = 0; Audio.ferma(urlo, .2);
      if (o.fum) { o.fum.remove(); o.fum = null; }
    }
    presa = null;
  }
  async function ahia(o) {
    Audio.sblocca(); Audio.ahia(o.p.voce);
    fumetto(o, ['Ahia!', 'Ahi ahi!', 'Ouch!', 'Aiaaa!', 'Ma che fai?!'][Math.floor(Math.random() * 5)]);
    o.prima = o.stato === 'colpito' ? o.prima : o.stato; o.stato = 'colpito'; o.fino = performance.now() + 900;
  }

  // ---- disegno, fotogramma per fotogramma
  const R = (el, a, cx, cy) => el && el.setAttribute('transform', `rotate(${a.toFixed(1)} ${cx} ${cy})`);
  let attivo = true;
  function frame(now) {
    if (!attivo) return;
    const W = cont.clientWidth, terra = opz.terra(), t = now / 1000;
    if (opz.modo === 'app' && !pausa && vivi.length < opz.max && now > prossimo && persone.length) { comparsa(); prossimo = now + 4000 + Math.random() * 4000; }
    const cb = cont.getBoundingClientRect(), kk = cb.width / (W || 1);
    for (const o of [...vivi]) {
      const P = o.P, s = o.s, ph = t * 7.5 + o.f;
      let a = { gS: 0, gD: 0, sS: 0, sD: 0, bS: 8, bD: -8, aS: -6, aD: 6, bust: 0, head: 0, pom: 0, bob: 0 }, sq = 1, rot = 0, baseY = terra - 262 * s;
      o.clipR.setAttribute('y', -5000); o.clipR.setAttribute('height', 20000);
      const cammina = () => {
        a.gS = 26 * Math.sin(ph); a.gD = -26 * Math.sin(ph); a.sS = Math.max(0, 38 * Math.sin(ph + 1.6)); a.sD = Math.max(0, 38 * Math.sin(ph + 1.6 + Math.PI));
        a.bS = -24 * Math.sin(ph); a.bD = 24 * Math.sin(ph); a.aS = -20 - 10 * Math.sin(ph); a.aD = -20 + 10 * Math.sin(ph);
        a.bob = -Math.abs(Math.sin(ph)) * 6; a.head = 9 * Math.sin(ph * .5 + .8); a.pom = 30 * Math.sin(ph + 1.2); a.bust = 3 * Math.sin(ph);
      };
      const balla = () => { const d = t * 7 + o.f; a.bob = -Math.abs(Math.sin(d)) * 14; a.bust = 10 * Math.sin(d * .5);
        a.bS = 150 * (.5 + .5 * Math.sin(d)); a.bD = -150 * (.5 + .5 * Math.sin(d + Math.PI)); a.aS = 40 * Math.sin(d); a.aD = -40 * Math.sin(d);
        a.gS = 18 * Math.sin(d); a.gD = -10 * Math.sin(d); a.sS = 20 + 20 * Math.sin(d); a.sD = 20 + 20 * Math.cos(d); a.head = 16 * Math.sin(d); a.pom = 40 * Math.sin(d * 2); };
      if (o.stato === 'cammina') {
        o.x += o.dir * o.vel / 60; cammina();
        if ((o.dir > 0 && o.x > W + 30) || (o.dir < 0 && o.x < -140 * s - 30)) { togli(o); continue; }
      } else if (o.stato === 'sbuca') {
        const el = o.carta, b = el && el.getBoundingClientRect();
        if (!b || !b.width || !document.body.contains(el)) { togli(o); continue; }
        const top = (b.top - cb.top) / kk, sx = (b.left - cb.left) / kk, w = b.width / kk;
        const el2 = (now - o.t0) / o.durata, up = el2 < .16 ? el2 / .16 : el2 < .8 ? 1 : el2 < .96 ? 1 - (el2 - .8) / .16 : 0;
        if (el2 >= 1) { togli(o); continue; }
        const e = 1 - Math.pow(1 - up, 3);
        o.x = sx + w * o.rel - 60 * s; baseY = top - 262 * s;
        o.y = (1 - e) * 270 * s + 80 * s;   // tutto su: si vedono testa e busto, le gambe restano dietro il riquadro
        o.clipR.setAttribute('y', -5000); o.clipR.setAttribute('height', 5000 + top);
        a.head = 16 * Math.sin(t * 1.7 + o.f); a.bD = -140 + 18 * Math.sin(t * 12 + o.f); a.aD = -30 + 20 * Math.sin(t * 12 + o.f); a.pom = 25 * Math.sin(t * 6 + o.f);
      } else if (o.stato === 'preso') {
        o.swv += (-o.vx * 2.2 - o.sw) * .15; o.swv *= .82; o.sw += o.swv; rot = Math.max(-60, Math.min(60, o.sw));
        const fl = t * 18 + o.f; a.bS = 120 + 40 * Math.sin(fl); a.bD = -120 - 40 * Math.sin(fl + 1); a.aS = 30 * Math.sin(fl * 1.3); a.aD = -30 * Math.sin(fl * 1.1);
        a.gS = 25 * Math.sin(fl * .9) - rot * .4; a.gD = -25 * Math.sin(fl * .9) - rot * .4; a.sS = 30 + 20 * Math.sin(fl); a.sD = 30 + 20 * Math.cos(fl);
        a.head = -rot * .5 + 8 * Math.sin(fl * .7); a.pom = -rot + 30 * Math.sin(fl); o.vx *= .9;
        baseY = 0; if (o.urlo && o.urlo !== 'attesa') Audio.tono(o.urlo, Math.min(1, Math.abs(o.sw) / 45));
        if (o.fum) o.fum.textContent = 'Uo' + 'o'.repeat(3 + Math.floor(Math.abs(o.sw) / 6)) + 'h!';
      } else if (o.stato === 'cade') {
        baseY = 0; o.vy += 1.2; o.y += o.vy; o.sw *= .9; rot = o.sw; a.bS = 150; a.bD = -150; a.gS = 20; a.gD = -20; a.head = 10 * Math.sin(t * 20);
        const pav = terra - 262 * s;
        if (o.y >= pav) { o.y = pav; if (o.vy > 7) { o.vy = -o.vy * .35; Audio.tonfo(.35); } else { o.vy = 0; o.stato = 'stordito'; o.fino = now + 1500; } }
      } else if (o.stato === 'vola') {
        baseY = 0; o.vy += .9; o.x += o.vx; o.y += o.vy; o.rot += o.rotv; rot = o.rot; a.bS = 160; a.bD = -160; a.gS = 30; a.gD = -30; a.head = 20 * Math.sin(t * 25);
        if (o.x < -300 || o.x > W + 300 || o.y > cont.clientHeight + 300 || o.y < -900) {
          if (o.fa) { o.stato = 'cade'; o.x = o.xOrig; o.y = -400; o.vy = 0; o.rot = 0; o.sw = 0; o.prima = 'cade'; }   // tv: ricasca al suo posto
          else { togli(o); continue; }
        }
      } else if (o.stato === 'colpito' || o.stato === 'stordito') {
        const r = Math.max(0, (o.fino - now) / 1000);
        if (o.stato === 'colpito') sq = 1 - .14 * Math.sin(Math.min(1, (.9 - r) / .9) * Math.PI);
        a.head = o.stato === 'colpito' ? -18 : 14 * Math.sin(t * 6); a.bS = 40; a.bD = -40; a.gS = -8; a.gD = 8;
        if (o.prima === 'sbuca' && o.stato === 'colpito') { const el = o.carta, b = el && el.getBoundingClientRect(); if (b) { const top = (b.top - cb.top) / kk; baseY = top - 262 * s; o.clipR.setAttribute('height', 5000 + top); } }
        if (o.stato === 'stordito') baseY = 0;
        if (now > o.fino) {
          if (o.stato === 'stordito' || o.prima === 'cade' || o.prima === 'preso') { o.stato = 'cammina'; o.dir = o.x < W / 2 ? -1 : 1; o.vel = 60; o.y = 0; }
          else o.stato = o.prima || 'cammina';
          if (o.stato === 'cammina' && opz.modo === 'tv' && o.fa) o.stato = o.fa;
        }
      } else if (o.stato === 'balla') { balla(); }
      else if (o.stato === 'saltella') { const d = t * 5 + o.f; a.bob = -Math.abs(Math.sin(d)) * 18; a.head = 10 * Math.sin(d); a.bS = 20 + 15 * Math.sin(d); a.bD = -20 - 15 * Math.sin(d); a.pom = 25 * Math.sin(d * 2); }
      else if (o.stato === 'festa') { const d = t * 4.5 + o.f, j = Math.abs(Math.sin(d)); a.bob = -j * 70; sq = j < .12 ? 1 - (.12 - j) * 1.2 : 1;
        a.bS = 160 + 12 * Math.sin(d * 4); a.bD = -160 - 12 * Math.sin(d * 4); a.aS = 20; a.aD = -20; a.gS = -10 * j; a.gD = 10 * j; a.sS = 30 * (1 - j); a.sD = 30 * (1 - j); a.head = 7 * Math.sin(d * 4); a.pom = 45 * Math.sin(d * 4); }
      else if (o.stato === 'passeggia') { // tv: avanti e indietro
        o.x += o.dir * o.vel / 60; cammina(); if (o.x > W - 140 * s) o.dir = -1; if (o.x < 10) o.dir = 1;
      }
      // facce: dolore / stordito
      const dolore = ['preso', 'vola', 'colpito', 'cade', 'stordito'].includes(o.stato);
      if (P.oN) P.oN.style.display = o.stato === 'stordito' ? 'none' : '';
      if (P.oX) P.oX.style.display = o.stato === 'stordito' ? '' : 'none';
      if (P.bN) P.bN.style.display = dolore ? 'none' : '';
      if (P.dol) P.dol.style.display = dolore ? '' : 'none';
      P.stelle.style.display = (o.stato === 'stordito' || o.stato === 'colpito') ? '' : 'none';
      const specchio = (o.stato === 'cammina' || o.stato === 'passeggia') && o.dir < 0 ? -1 : 1;
      const yy = baseY + o.y;
      o.g.setAttribute('transform', `translate(${o.x.toFixed(1)} ${yy.toFixed(1)}) scale(${s})`);
      const pivotY = ['preso', 'vola'].includes(o.stato) ? 55 : 262;
      P.tutto.setAttribute('transform', `translate(0 ${a.bob.toFixed(1)}) rotate(${rot.toFixed(1)} 60 ${pivotY}) translate(60 262) scale(${(specchio * (2 - sq)).toFixed(3)} ${sq.toFixed(3)}) translate(-60 -262)`);
      P.ombra.setAttribute('opacity', (['preso', 'vola', 'sbuca'].includes(o.stato) ? 0 : .5).toString());
      R(P.busto, a.bust, 60, 176); R(P.gS, a.gS, 46, 172); R(P.gD, a.gD, 74, 172); R(P.sS, a.sS, 46, 206); R(P.sD, a.sD, 74, 206);
      R(P.bS, a.bS, 30, 112); R(P.bD, a.bD, 90, 112); R(P.aS, a.aS, 31, 150); R(P.aD, a.aD, 89, 150); R(P.testa, a.head, 60, 96); R(P.pom, a.pom, 110, 28);
      if (o.fum) { const bb = P.testa.getBoundingClientRect(); o.fum.style.left = ((bb.left + bb.width / 2 - cb.left) / kk) + 'px'; o.fum.style.top = ((bb.top - cb.top) / kk - 4) + 'px'; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    persone(lista) {
      persone = (lista || []).filter(Boolean);
      const ids = new Set(persone.map(p => p.id));
      vivi.filter(o => !ids.has(o.p.id) && !o.fa).forEach(togli);
      // aggiorna la faccia se è cambiata
      vivi.forEach(o => { const n = persone.find(p => p.id === o.p.id); if (n && n.faccia !== o.p.faccia) { o.p = n; const im = o.g.querySelector('image'); if (im && n.faccia) im.setAttribute('href', n.faccia); } });
    },
    pausa(v) { pausa = !!v; svg.style.display = v ? 'none' : ''; fumi.style.display = v ? 'none' : ''; },
    scena(lista) { // tv: [{ id, x, fa }]
      vivi.forEach(o => { o.clip.remove(); o.esterno.remove(); if (o.fum) o.fum.remove(); if (o.urlo && o.urlo !== 'attesa') Audio.ferma(o.urlo); }); vivi = [];
      (lista || []).forEach(v => {
        const p = persone.find(x => x.id === v.id); if (!p) return;
        const o = nuovo(p, { stato: v.fa, fa: v.fa, dir: Math.random() < .5 ? 1 : -1, vel: 40 + Math.random() * 25 });
        o.x = (v.x == null ? Math.random() * (cont.clientWidth - 120 * o.s) : v.x - 60 * o.s);
        if (v.scala) o.s = v.scala * (p.bimbo ? .72 : 1);
        o.x = (v.x == null ? 20 + Math.random() * (cont.clientWidth - 160 * o.s) : v.x - 60 * o.s); o.xOrig = o.x;
      });
    },
    distruggi() { attivo = false; svg.remove(); fumi.remove(); }
  };
}
window.Omini = { crea, audio: Audio, PIGIAMI: PIGIAMI.length };
})();
