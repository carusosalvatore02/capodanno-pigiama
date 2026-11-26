/* =====================================================================
   CAPODANNO IN PIGIAMA — schermo TV (da aprire sul portatile collegato alla TV)
   Segue da solo la regia dell'organizzatore: non serve toccarlo.
   ===================================================================== */
(() => {
'use strict';
const C = window.CONFIG || {};
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

const T = {
  serata: null, persone: [], famiglie: [], cat: [], pegni: [], brani: [], ris: null, avz: null, sp: null,
  urls: {}, avviato: false, passo: -1, rivelato: false, spinAt: null, ruota: 0, girando: false,
  timer: null, timerIv: null, cdStart: null, cdChiuso: null, fase: null, musicaGruppo: null, braniIdx: 0
};

// ---------------------------------------------------------------- suoni
let AC = null;
function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tono(f, t0, d, tipo, vol) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = tipo || 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0, a.currentTime + t0); g.gain.linearRampToValueAtTime(vol || .2, a.currentTime + t0 + .02);
  g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t0 + d);
  o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + d + .05);
}
function rumore(t0, d, vol, hp) {
  const a = ac(); if (!a) return;
  const b = a.createBuffer(1, Math.max(1, a.sampleRate * d), a.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
  const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime + t0); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t0 + d);
  s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + t0);
}
function abbassaMusica(sec) {
  if (typeof spotifyAttivo === 'function' && spotifyAttivo() && spPlaylist(gruppoMusica())) {
    const v = musicaVol(); SP.player.setVolume(v * .2);
    clearTimeout(abbassaMusica.ts); abbassaMusica.ts = setTimeout(() => { SP.player.setVolume(musicaVol()); }, sec * 1000);
    return;
  }
  const m = $('musica'); if (!m || m.paused) return;
  const v = musicaVol(); m.volume = v * .2;
  clearTimeout(abbassaMusica.t); abbassaMusica.t = setTimeout(() => { m.volume = v; }, sec * 1000);
}
const sintetici = {
  tamburi(sec) { abbassaMusica(sec + 2); for (let t = 0; t < sec; t += .045) rumore(t, .05, .05 + .25 * (t / sec), 300); rumore(sec, .9, .5, 3000); tono(110, sec, .6, 'sine', .4); },
  fanfara() { abbassaMusica(2.5); [523, 659, 784, 1047].forEach((f, i) => tono(f, i * .13, .35, 'sawtooth', .12)); tono(1047, .55, .9, 'triangle', .18); tono(784, .55, .9, 'triangle', .12); },
  applausi() { abbassaMusica(3); for (let i = 0; i < 60; i++) rumore(Math.random() * 2.5, .03, .15 * Math.random(), 1500); },
  ding() { tono(1320, 0, .4, 'sine', .2); tono(1760, .08, .5, 'sine', .12); },
  tic() { tono(1800, 0, .04, 'square', .08); },
  bip() { tono(880, 0, .12, 'sine', .15); },
  fine() { tono(330, 0, .6, 'square', .15); }
};

// Suoni veri (config.js → SUONI_TV): se un file c'è lo usa, altrimenti il suono generato qui sopra
const bufTv = {};
async function caricaSuoniTv() {
  const a = ac(), cfg = C.SUONI_TV || {}; if (!a) return;
  for (const [k, lista] of Object.entries(cfg)) {
    for (const url of [].concat(lista || [])) {
      try { const r = await fetch(url); if (!r.ok) throw 0; (bufTv[k] = bufTv[k] || []).push(await a.decodeAudioData(await r.arrayBuffer())); }
      catch (e) { console.warn('Suono non trovato:', url); }
    }
  }
}
function suonaFile(k, vol, maxSec) {
  const l = bufTv[k], a = ac(); if (!l || !l.length || !a) return false;
  const b = l[Math.floor(Math.random() * l.length)];
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = b; g.gain.value = vol == null ? .9 : vol;
  s.connect(g).connect(a.destination); s.start();
  if (maxSec && b.duration > maxSec) { g.gain.setValueAtTime(g.gain.value, a.currentTime + maxSec - .25); g.gain.linearRampToValueAtTime(0, a.currentTime + maxSec); s.stop(a.currentTime + maxSec + .05); }
  abbassaMusica(Math.min(b.duration, maxSec || 99) + .5);
  return true;
}
const suoni = {
  tamburi(sec) { if (!suonaFile('rullo', .9, sec + 1)) sintetici.tamburi(sec); },
  fanfara() { if (!suonaFile('fanfara')) sintetici.fanfara(); },
  applausi() { if (!suonaFile('applausi', .8)) sintetici.applausi(); },
  ding() { if (!suonaFile('ding', .7)) sintetici.ding(); },
  tic() { if (!suonaFile('tic', .5)) sintetici.tic(); },
  bip() { if (!suonaFile('bip', .6)) sintetici.bip(); },
  fine() { if (!suonaFile('fine')) sintetici.fine(); },
  botti() { suonaFile('botti', .9); }
};

// ---------------------------------------------------------------- coriandoli
const cv = $('confetti'), cx = cv.getContext('2d'); let parti = [], raf = null;
function coriandoli(n) {
  cv.width = innerWidth; cv.height = innerHeight;
  const col = ['#FFC857', '#FF9EB1', '#8FD3FF', '#A8E6A1', '#FFF6E5'];
  for (let i = 0; i < (n || 180); i++) parti.push({ x: innerWidth / 2 + (Math.random() - .5) * innerWidth * .3, y: innerHeight * .35, vx: (Math.random() - .5) * 18, vy: -Math.random() * 16 - 4, r: Math.random() * 8 + 5, c: col[i % 5], a: Math.random() * 6, l: 180 });
  if (!raf) giro();
}
function fuochi() { for (let k = 0; k < 6; k++) setTimeout(() => coriandoli(120), k * 600); }
function giro() {
  cx.clearRect(0, 0, cv.width, cv.height);
  parti.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.a += .2; p.l--; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); });
  parti = parti.filter(p => p.l > 0 && p.y < cv.height + 40);
  raf = parti.length ? requestAnimationFrame(giro) : (cx.clearRect(0, 0, cv.width, cv.height), null);
}

// ---------------------------------------------------------------- dati
const pers = id => T.persone.find(p => p.id === id) || { nome: '?' };
const famDi = id => T.famiglie.find(f => f.id === id) || { cognome: '', nickname: '' };
const nome = p => p.soprannome || p.nome;
const nomeCompleto = p => p.tipo === 'adulto' ? `${nome(p)} ${p.cognome || ''}` : p.nome;
const nomeFam = f => `Famiglia ${f.cognome} – ${f.nickname}`;
function av(p, s) {
  let url = p.foto_path && T.urls[p.foto_path];
  if (!url && p.tipo === 'bimbo') { const f = famDi(p.famiglia_id); url = f.foto_path && T.urls[f.foto_path]; }
  return `<div class="av" style="width:${s}px;height:${s}px;font-size:${s * .45}px">${url ? `<img src="${esc(url)}" alt="">` : esc((nome(p) || '?')[0])}</div>`;
}
function famImg(f, w, h) {
  const url = f.foto_path && T.urls[f.foto_path];
  return `<div class="famimg" style="width:${w}px;height:${h}px">${url ? `<img src="${esc(url)}" alt="">` : `<span class="f" style="font-size:${h * .3}px;color:var(--acc)">${esc(f.nickname[0] || '')}</span>`}</div>`;
}
async function preparaUrl(paths) {
  const m = [...new Set(paths.filter(p => p && !T.urls[p]))]; if (!m.length) return;
  try { (await q(sb.storage.from('foto').createSignedUrls(m, 60 * 60 * 8))).forEach(x => { if (x.signedUrl) T.urls[x.path] = x.signedUrl; }); } catch (e) { console.warn(e); }
}
async function caricaDati() {
  const [serata, persone, famiglie, cat, pegni, brani] = await Promise.all([
    q(sb.from('serata').select('*').eq('id', 1).single()),
    q(sb.from('persone').select('*').order('creata_il')),
    q(sb.from('famiglie').select('*').order('cognome')),
    q(sb.from('categorie').select('*').order('ordine')),
    q(sb.from('pegni').select('*').order('id')),
    q(sb.from('brani_karaoke').select('*').order('ordine'))
  ]);
  Object.assign(T, { serata, persone, famiglie, cat, pegni, brani });
  await preparaUrl([...persone.map(p => p.foto_path), ...persone.map(p => p.viso_path), ...famiglie.map(f => f.foto_path)]);
  await caricaRisultati();
  await caricaSpareggio();
}
async function caricaRisultati() {
  if (!['premiazione', 'fine'].includes(T.serata.fase)) { T.ris = null; return; }
  try { T.ris = await q(sb.rpc('risultati')); } catch (e) { console.warn(e); T.ris = null; }
}
async function caricaSpareggio() {
  const id = T.serata.spareggio_id;
  T.sp = id ? await q(sb.from('spareggi').select('*').eq('id', id).single()) : null;
}
async function aggiornaAvanzamento() {
  try { T.avz = await q(sb.rpc('avanzamento')); } catch (e) { /* niente */ }
}

// ---------------------------------------------------------------- musica
function musicaVol() { const m = (T.serata && T.serata.tv && T.serata.tv.musica) || {}; return m.vol == null ? .6 : m.vol; }
function gruppoMusica() {
  const f = T.serata.fase;
  if (T.festa || f === 'fine') return 'festa';
  if (f === 'premiazione') {
    const s = passoCorrente(), k = s && s.k;
    if (['catTitle', 'catFinal', 'catWin'].includes(k)) return 'premiazione';    // i 4 premi: suspense
    if (['famFinal', 'famWin', 'clAd', 'clFam', 'fine'].includes(k)) return 'finale';  // famiglie e classifica
    return 'pegni';                                                               // pegni e bimbi: si ride
  }
  return 'cena';
}
// lista dei brani del momento; se manca, usa quella del momento più simile
function listaMusica(g) {
  const L = C.MUSICA || {}, riserva = { pegni: 'cena', finale: 'festa' };
  return (L[g] && L[g].length) ? L[g] : (L[riserva[g]] || []);
}

// ---------------------------------------------------------------- Spotify (facoltativo)
// Con config.js → SPOTIFY.clientId e le playlist, la TV diventa un lettore Spotify (serve Premium)
// e cambia playlist da sola a ogni momento. Se Spotify non c'è o si scollega, usa gli MP3.
const SPC = C.SPOTIFY || {};
const SP = { token: null, scad: 0, refresh: null, player: null, device: null, pronto: false };
const SP_URI = location.origin + location.pathname;
try { SP.refresh = JSON.parse(localStorage.getItem('pigiama-spotify') || '{}').refresh || null; } catch (e) { /* niente */ }
const spotifyAttivo = () => !!(SPC.clientId && SP.pronto && SP.device);
function spUri(x) { if (!x) return null; const m = String(x).match(/(playlist|album)[/:]([A-Za-z0-9]+)/); return m ? `spotify:${m[1]}:${m[2]}` : x; }
function spPlaylist(g) { const L = SPC.playlist || {}, riserva = { pegni: 'cena', finale: 'festa' }; return spUri(L[g] || L[riserva[g]]); }
function b64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function spCollega() {
  const v = b64url(crypto.getRandomValues(new Uint8Array(48)));
  localStorage.setItem('pigiama-spotify-v', v);
  const sfida = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const p = new URLSearchParams({ response_type: 'code', client_id: SPC.clientId, redirect_uri: SP_URI, code_challenge_method: 'S256', code_challenge: sfida,
    scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state', show_dialog: 'true' });
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}
function spSalva(j) {
  SP.token = j.access_token; SP.scad = Date.now() + ((j.expires_in || 3600) - 60) * 1000;
  if (j.refresh_token) SP.refresh = j.refresh_token;
  localStorage.setItem('pigiama-spotify', JSON.stringify({ refresh: SP.refresh }));
}
async function spChiedi(corpo) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SPC.clientId, ...corpo }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'Spotify'); spSalva(j);
}
async function spToken() {
  if (SP.token && Date.now() < SP.scad) return SP.token;
  if (!SP.refresh) return null;
  try { await spChiedi({ grant_type: 'refresh_token', refresh_token: SP.refresh }); return SP.token; }
  catch (e) { console.warn('Spotify:', e.message); SP.refresh = null; localStorage.removeItem('pigiama-spotify'); return null; }
}
async function spRitorno() {   // rientro dalla pagina di Spotify con ?code=...
  const q = new URLSearchParams(location.search), code = q.get('code');
  if (!code && !q.get('error')) return;
  history.replaceState(null, '', SP_URI);
  if (!code) return;
  try { await spChiedi({ grant_type: 'authorization_code', code, redirect_uri: SP_URI, code_verifier: localStorage.getItem('pigiama-spotify-v') || '' }); }
  catch (e) { console.warn('Spotify:', e.message); }
}
async function spApi(metodo, percorso, corpo) {
  const tk = await spToken(); if (!tk) throw new Error('Spotify non collegato');
  const r = await fetch('https://api.spotify.com/v1' + percorso, { method: metodo, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (!r.ok && r.status !== 204) throw new Error('Spotify ' + r.status);
}
function spPrepara() {   // carica il lettore Spotify nella pagina
  if (!SPC.clientId || !SP.refresh || SP.player) return;
  window.onSpotifyWebPlaybackSDKReady = () => {
    SP.player = new Spotify.Player({ name: 'Capodanno in Pigiama · TV', getOAuthToken: cb => spToken().then(t => cb(t)), volume: musicaVol() });
    SP.player.addListener('ready', ({ device_id }) => { SP.device = device_id; SP.pronto = true; T.musicaGruppo = null; $('musica').pause(); aggiornaMusica(); aggiornaStatoSpotify(); });
    SP.player.addListener('not_ready', () => { SP.pronto = false; T.musicaGruppo = null; aggiornaMusica(); aggiornaStatoSpotify(); });
    ['initialization_error', 'authentication_error', 'account_error'].forEach(ev => SP.player.addListener(ev, e => {
      console.warn('Spotify', ev, e && e.message); SP.pronto = false; SP.ultimoErr = e && e.message; T.musicaGruppo = null; aggiornaMusica(); aggiornaStatoSpotify(e && e.message);
    }));
    SP.player.connect();
    spToken().then(tk => tk && fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + tk } })).then(r => r && r.ok ? r.json() : null)
      .then(me => { if (me) { SP.chi = (me.email || me.display_name || '') + (me.product ? ' · piano ' + me.product : ''); aggiornaStatoSpotify(SP.ultimoErr); } }).catch(() => {});
  };
  const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; document.head.appendChild(s);
}
function aggiornaStatoSpotify(err) {
  const el = $('spstato'); if (!el) return;
  el.innerHTML = !SPC.clientId ? '' : spotifyAttivo() ? '<span class="acc">Spotify collegato</span> · la musica arriva dalle tue playlist'
    : SP.refresh ? (err ? `Spotify non disponibile (${esc(err)}): uso gli MP3${SP.chi ? `<br><span style="font-size:15px">Account collegato: <b>${esc(SP.chi)}</b></span>` : ''}<br><button class="btn ghost" id="spscollega" style="margin-top:10px">Scollega e ricollega Spotify</button>` : 'Collegamento a Spotify…')
    : `<button class="btn ghost" id="spcollega">Collega Spotify</button><div style="font-size:14px;margin-top:10px;opacity:.8">Redirect URI da registrare su Spotify:<br><b style="user-select:all">${esc(SP_URI)}</b></div>`;
  const b = $('spcollega'); if (b) b.onclick = spCollega;
  const x = $('spscollega'); if (x) x.onclick = () => { localStorage.removeItem('pigiama-spotify'); SP.refresh = null; SP.token = null; spCollega(); };
}
function musicaSpotify(gruppo, cfg) {
  const uri = spPlaylist(gruppo);
  if (cfg.on === false || !uri) { SP.player.pause(); T.musicaGruppo = gruppo; return; }
  SP.player.setVolume(musicaVol());
  if (cfg.next && cfg.next !== T.ultimoNext) { T.ultimoNext = cfg.next; SP.player.nextTrack(); return; }
  if (gruppo !== T.musicaGruppo) {
    T.musicaGruppo = gruppo;
    spApi('PUT', '/me/player/play?device_id=' + SP.device, { context_uri: uri })
      .then(() => spApi('PUT', '/me/player/shuffle?state=true&device_id=' + SP.device).catch(() => {}))
      .catch(e => { console.warn(e.message); SP.pronto = false; T.musicaGruppo = null; aggiornaMusica(); aggiornaStatoSpotify(e.message); });
  } else SP.player.resume();
}

function aggiornaMusica() {
  const el = $('musica'), cfg = (T.serata.tv && T.serata.tv.musica) || {}, liste = C.MUSICA || {};
  if (!T.avviato) return;
  // Spotify se c'è una playlist per questo momento, altrimenti gli MP3
  if (spotifyAttivo() && spPlaylist(gruppoMusica())) { el.pause(); musicaSpotify(gruppoMusica(), cfg); return; }
  if (spotifyAttivo() && T.musicaGruppo !== gruppoMusica()) { SP.player.pause(); T.musicaGruppo = null; }
  const gruppo = gruppoMusica(), lista = listaMusica(gruppo);
  if (cfg.on === false || !lista.length) { el.pause(); return; }
  el.volume = musicaVol();
  if (cfg.next && cfg.next !== T.ultimoNext) { T.ultimoNext = cfg.next; T.braniIdx++; el.src = lista[T.braniIdx % lista.length]; el.play().catch(() => {}); return; }
  if (gruppo !== T.musicaGruppo || !el.src) { T.musicaGruppo = gruppo; T.braniIdx = 0; el.src = lista[0]; }
  if (el.paused) el.play().catch(() => {});
}
$('musica').addEventListener('ended', () => {
  if (spotifyAttivo() && spPlaylist(gruppoMusica())) return;
  const lista = listaMusica(gruppoMusica()); if (!lista.length) return;
  T.braniIdx++; $('musica').src = lista[T.braniIdx % lista.length]; $('musica').play().catch(() => {});
});

// ---------------------------------------------------------------- viste
const LUNA = '<svg class="moon" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="lunaM"><rect width="100" height="100" fill="#fff"/><circle cx="66" cy="44" r="29" fill="#000"/></mask><radialGradient id="lunaG" cx="35%" cy="65%" r="70%"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F7B733"/></radialGradient></defs><circle cx="48" cy="56" r="36" fill="url(#lunaG)" mask="url(#lunaM)"/><path d="M27 55q4 3.5 8 0" fill="none" stroke="#7A4A12" stroke-width="2" stroke-linecap="round"/><circle cx="29" cy="64" r="3.6" fill="#FF9EB1" opacity=".7"/><path d="M33 71q4 2.5 7-1" fill="none" stroke="#7A4A12" stroke-width="1.8" stroke-linecap="round"/><defs><linearGradient id="lunaC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B7A"/><stop offset="1" stop-color="#D93248"/></linearGradient><linearGradient id="lunaP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EADFCB"/></linearGradient><radialGradient id="lunaB" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6DAC4"/></radialGradient></defs><path d="M19.80 28.77 L21.26 28.28 L22.52 27.65 L23.72 26.99 L24.91 26.34 L26.08 25.69 L27.25 25.06 L28.42 24.46 L29.61 23.88 L30.80 23.34 L32.00 22.82 L33.21 22.35 L34.43 21.91 L35.67 21.52 L36.91 21.16 L38.17 20.85 L39.43 20.57 L40.70 20.34 L41.97 20.15 L43.25 20.01 L44.52 19.90 L45.80 19.83 L47.08 19.81 L48.36 19.83 L49.64 19.88 L50.91 19.98 L52.20 20.01 L53.48 20.10 L54.75 20.26 L56.02 20.47 L57.28 20.76 L58.52 21.11 L59.73 21.53 L60.92 22.02 L62.08 22.59 L63.19 23.23 L64.26 23.94 L65.28 24.72 L66.24 25.58 L67.14 26.50 L67.96 27.49 L65.90 30.44 L64.75 30.18 L63.59 30.00 L62.41 29.93 L61.22 29.95 L60.03 30.06 L58.84 30.27 L57.68 30.56 L56.53 30.94 L55.41 31.41 L54.33 31.95 L53.29 32.57 L52.30 33.26 L51.35 34.01 L50.47 34.83 L49.64 35.69 L48.87 36.73 L48.18 37.83 L47.57 38.96 L47.04 40.14 L46.59 41.33 L46.22 42.55 L45.94 43.76 L45.74 44.98 L45.62 46.17 L45.58 47.34 L45.61 48.48 L45.70 49.57 L45.86 50.62 L46.07 51.60 L46.33 52.53 L46.62 53.38 L46.95 54.17 L47.31 54.88 L47.68 55.53 L48.07 56.09 L48.46 56.59 L48.86 57.03 L49.27 57.42 L49.71 57.77 L50.30 58.22Z" fill="url(#lunaC)"/><rect x="12.06" y="42.48" width="42.40" height="6.4" rx="3.2" transform="rotate(-145.0 33.26 45.68)" fill="#E0951C" opacity=".28" mask="url(#lunaM)"/><rect x="12.65" y="38.50" width="44.80" height="10" rx="5" transform="rotate(-136.0 35.05 43.50)" fill="url(#lunaP)"/><circle cx="66.93" cy="32.27" r="5.5" fill="url(#lunaB)"/></svg>';
function luci() {
  // ghirlanda: filo che pende in 4 archi lungo tutta la base, lampadine appese che brillano a turno
  const c = ['#FFC857', '#FF6B6B', '#7FD8FF', '#FFF6E5', '#8EE07F'], n = 24, archi = 4;
  const y = x => 10 + 22 * Math.sin(Math.PI * ((x * archi) % 1));
  const bulbi = Array.from({ length: n }, (_, i) => {
    const x = (i + .5) / n, col = c[i % 5];
    return `<i style="left:${(x * 100).toFixed(2)}%;top:${(y(x) + 4).toFixed(1)}px;background:${col};box-shadow:0 0 16px ${col},0 0 4px ${col};animation-delay:${(i * .41 % 2.4).toFixed(2)}s"></i>`;
  }).join('');
  let d = 'M0 10'; for (let k = 0; k < archi; k++) d += ` Q${(k + .5) * 1280 / archi} 54 ${(k + 1) * 1280 / archi} 10`;
  return `<div class="lights"><svg viewBox="0 0 1280 64" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#2F4A3A" stroke-width="3"/></svg>${bulbi}</div>`;
}
function qr() {
  try {
    const url = new URL('./', location.href).href;
    const x = qrcode(0, 'M'); x.addData(url); x.make();
    return `<div style="background:#FFF6E5;padding:14px;border-radius:18px;width:190px;height:190px">${x.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>`;
  } catch (e) { return ''; }
}
function vistaAccoglienza() {
  const pres = T.persone.filter(p => p.presente).length;
  return `<div class="luna-tv in">${LUNA}</div><div class="c" style="padding-bottom:150px"><div class="s in">31 dicembre · Cena di Capodanno</div>
    <div class="t in2" style="margin:14px 0 24px">Capodanno<br><span class="acc">in Pigiama!</span></div>
    <div class="row in3" style="gap:36px">${qr()}<div style="text-align:left"><div class="f" style="font-size:40px">Inquadra il QR</div><div class="s" style="font-size:26px">per aprire l'app</div>
      <div class="f acc" style="font-size:34px;margin-top:12px">Presenti ${pres}/${T.persone.length}</div></div></div></div>
    ${luci()}`;
}
function vistaProgressi(titolo, n, tot, extra) {
  return `<div class="c"><div class="t in" style="font-size:84px">${titolo}</div>
    <div class="s in2" style="margin:26px 0 14px">${esc(extra)} ${n}/${tot}</div><div class="bar in2"><i style="width:${tot ? n / tot * 100 : 0}%"></i></div>
    ${T.serata.fase === 'votazioni' ? candidatiCheScorrono() : ''}</div>${luci()}`;
}
function candidatiCheScorrono() {
  const g = T.persone.filter(p => p.presente && !p.senza_pigiama);
  if (!g.length) return '';
  const blocco = g.map(p => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:120px">${av(p, 96)}<div style="font-weight:800;font-size:19px">${esc(nome(p))}</div></div>`).join('');
  return `<div style="width:100%;overflow:hidden;margin-top:40px"><div class="scorri" style="width:max-content">${blocco}${blocco}</div></div>`;
}
function passoCorrente() { const tv = T.serata.tv || {}; return tv.steps && tv.steps[tv.i || 0]; }
function vistaPremiazione() {
  const s = passoCorrente(), tv = T.serata.tv || {}, R = T.ris;
  if (!s) return `<div class="c"><div class="t">Premiazione</div></div>`;
  const cat = s.c ? (T.cat.find(c => c.id === s.c) || {}) : null;
  const rc = s.c && R ? R.premi.find(x => x.categoria_id === s.c) : null;
  switch (s.k) {
    case 'intro': return `<div class="c"><div class="s in">E ora…</div><div class="t in2 acc" style="font-size:124px">La premiazione!</div></div>${luci()}`;
    case 'pegniIntro': return `<div class="c"><div class="t in">I pegni</div><div class="s in2" style="margin-top:20px">Chi è arrivato senza pigiama… paga!</div></div>`;
    case 'nopegni': return `<div class="c"><div class="t pop acc">Tutti in pigiama!</div><div class="s in2" style="margin-top:20px">Nessun pegno da pagare. Bravi!</div></div>`;
    case 'pegno': return vistaPegno(s, tv);
    case 'bimbiIntro': return `<div class="c"><div class="s in">E ora chiamiamo sul palco…</div><div class="t in2 acc">i nostri bimbi!</div></div>${luci()}`;
    case 'bimbo': { const p = pers(s.pid); return `<div class="c"><div class="pop">${av(p, 250)}</div><div class="t in2" style="font-size:104px;margin-top:22px">${esc(p.nome.toUpperCase())}</div><div class="f in3 acc" style="font-size:46px;margin-top:6px">${esc(p.titolo_buffo || '')}</div><div class="s in3" style="margin-top:8px">${esc(nomeFam(famDi(p.famiglia_id)))}</div></div>`; }
    case 'bimbiFine': { const k = T.persone.filter(p => p.tipo === 'bimbo' && p.presente); return `<div class="c"><div class="t in" style="font-size:76px">Bravissimi, <span class="acc">campioni del pigiama!</span></div><div class="row in2" style="gap:34px;margin-top:40px;flex-wrap:wrap;justify-content:center">${k.map(p => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${av(p, 120)}<div class="f" style="font-size:28px">${esc(p.nome)}</div></div>`).join('')}</div></div>`; }
    case 'catTitle': return `<div class="c"><div class="s in">E il premio per…</div><div class="t in2 acc" style="font-size:110px">${esc(cat.nome)}</div></div>`;
    case 'catFinal': {
      if (!rc) return attesaRisultati();
      const f = rc.classifica.slice(0, 3).sort((a, b) => String(a.persona_id).localeCompare(String(b.persona_id)));
      const jolly = rc.jolly_finalisti || [];
      return `<div class="c"><div class="f in acc" style="font-size:42px">${esc(cat.nome)}</div><div class="t in" style="font-size:70px;margin-top:6px">${f.length ? 'I finalisti' : 'Nessun voto'}</div>
        <div class="fin in2">${f.map(x => { const p = pers(x.persona_id); return `<div>${av(p, 180)}${esc(nomeCompleto(p))}</div>`; }).join('')}</div>
        ${jolly.length ? `<div class="card in3" style="margin-top:34px;font-size:30px;font-weight:800;border-color:var(--pink)">Attenzione… ${jolly.map(id => esc(nome(pers(id)))).join(' e ')} ${jolly.length > 1 ? 'avevano' : 'aveva'} giocato il jolly!</div>` : ''}</div>`;
    }
    case 'catWin': return vistaVincitore(cat, rc);
    case 'famFinal': {
      if (!R) return attesaRisultati();
      return `<div class="c"><div class="f in acc" style="font-size:42px">Premio famiglia</div><div class="t in" style="font-size:70px">Le finaliste</div>
        <div class="fin in2">${R.famiglie.slice(0, 3).sort((a, b) => String(a.famiglia_id).localeCompare(String(b.famiglia_id))).map(x => { const f = famDi(x.famiglia_id); return `<div>${famImg(f, 300, 200)}${esc(f.nickname)}</div>`; }).join('')}</div></div>`;
    }
    case 'famWin': {
      if (!R) return attesaRisultati();
      if (!T.rivelato) return `<div class="c"><div class="f acc" style="font-size:44px">Premio famiglia</div><div class="t pulse" style="margin-top:30px">E la famiglia vincitrice è…</div></div>`;
      const x = R.famiglie[0], f = famDi(x.famiglia_id), ind = R.famiglia_indovinata_da || [];
      return `<div class="c"><div class="f acc" style="font-size:40px">Premio famiglia</div><div class="pop" style="margin-top:18px">${famImg(f, 440, 280)}</div>
        <div class="t in2" style="font-size:80px;margin-top:18px">${esc(nomeFam(f))}</div><div class="s in3">Media ${Number(x.media).toFixed(2).replace('.', ',')} stelle a testa</div></div>${striscia(ind)}`;
    }
    case 'clAd': {
      if (!R) return attesaRisultati();
      const righe = R.adulti, n = righe.length, segno = v => v == null ? '–' : (v > 0 ? '+' : '') + v;
      // svelata dal basso: prima gli ultimi, poi il podio uno alla volta
      return `<div class="c" style="justify-content:flex-start;padding-top:30px"><div class="t in" style="font-size:60px;margin-bottom:16px">Classifica <span class="acc">adulti</span></div>
        <table class="cl"><tr><th>Pos.</th><th>Nome</th><th class="n">Pigiama</th><th class="n">Pronostico</th><th class="n">Jolly</th><th class="n">Totale</th></tr>
        ${righe.slice(0, 12).map((a, i) => { const p = pers(a.persona_id); const rit = i < 3 ? (n > 3 ? Math.min(n, 12) - 3 : 0) * .25 + (3 - i) * 1.6 : (Math.min(n, 12) - 1 - i) * .25; return `<tr class="${i < 3 ? 'pod' : ''}" style="animation:in .6s ${rit.toFixed(2)}s both"><td>${i + 1}</td><td><b>${esc(nomeCompleto(p))}</b></td><td class="n">${a.pigiama}</td><td class="n">${segno(a.pronostico)}</td><td class="n">${segno(a.jolly)}</td><td class="n f">${a.totale}</td></tr>`; }).join('')}</table></div>`;
    }
    case 'clFam': {
      if (!R) return attesaRisultati();
      const n = R.famiglie.length;
      return `<div class="c"><div class="t in" style="font-size:60px;margin-bottom:26px">Classifica <span class="acc">famiglie</span></div>
        <table class="cl" style="width:900px"><tr><th>Pos.</th><th>Famiglia</th><th class="n">Media stelle</th></tr>
        ${R.famiglie.map((x, i) => `<tr class="${i === 0 ? 'pod' : ''}" style="animation:in .6s ${((n - 1 - i) * .6).toFixed(2)}s both"><td>${i + 1}</td><td><b>${esc(nomeFam(famDi(x.famiglia_id)))}</b></td><td class="n f">${Number(x.media).toFixed(2).replace('.', ',')}</td></tr>`).join('')}</table></div>`;
    }
    case 'fine': return `<div class="c"><div class="t pop acc" style="font-size:150px">Buon anno!</div><div class="s in2" style="margin-top:20px">Grazie a tutti i pigiami della serata</div></div>${luci()}`;
  }
  return '';
}
function attesaRisultati() { return `<div class="c"><div class="t pulse">Un attimo…</div></div>`; }
function striscia(ids) {
  if (!ids.length) return `<div class="strip in3">Nessuno aveva indovinato!</div>`;
  return `<div class="strip in3">${ids.length === 1 ? 'Solo 1 aveva' : `In ${ids.length} avevano`} indovinato! ${ids.map(id => { const p = pers(id); return `<span class="row">${av(p, 40)}${esc(nome(p))}</span>`; }).join('')}</div>`;
}
function vistaVincitore(cat, rc) {
  if (!rc) return attesaRisultati();
  if (T.sp && T.sp.categoria_id === cat.id && !T.sp.vincitore_id) return vistaSpareggio(cat);
  if (!rc.vincitore_id && rc.pareggio) {
    return `<div class="c"><div class="f acc" style="font-size:42px">${esc(cat.nome)}</div><div class="t pop" style="color:var(--pink);margin:16px 0">Pareggio!</div>
      <div class="fin in2">${rc.in_parita.map(id => { const p = pers(id); return `<div>${av(p, 170)}${esc(nomeCompleto(p))}</div>`; }).join('')}</div>
      <div class="s in3" style="margin-top:28px">Sfilata! Poi si vota dal telefono</div></div>`;
  }
  if (!T.rivelato) return `<div class="c"><div class="f acc" style="font-size:44px">${esc(cat.nome)}</div><div class="t pulse" style="margin-top:30px">E il vincitore è…</div></div>`;
  const w = rc.vincitore_id ? pers(rc.vincitore_id) : null;
  const voti = w ? ((rc.classifica.find(x => x.persona_id === rc.vincitore_id) || {}).voti || 0) : 0;
  return `<div class="c"><div class="f acc" style="font-size:40px">${esc(cat.nome)}</div>
    ${w ? `<div class="pop" style="margin-top:16px">${av(w, 250)}</div><div class="t in2" style="font-size:92px;margin-top:18px">${esc(nomeCompleto(w))}</div><div class="s in3">${voti} vot${voti === 1 ? 'o' : 'i'}</div>` : '<div class="t" style="margin-top:20px">Nessun voto</div>'}</div>
    ${w ? striscia(rc.indovinato_da || []) : ''}`;
}
function vistaSpareggio(cat) {
  const sp = T.sp, resta = Math.max(0, Math.ceil((new Date(sp.fine) - new Date()) / 1000));
  const votanti = (T.avz && T.avz.spareggio_votanti) || 0, adulti = (T.avz && T.avz.adulti_presenti) || 0;
  return `<div class="c"><div class="f acc" style="font-size:40px">${esc(cat.nome)} · Spareggio</div>
    <div class="t" id="spresta" style="font-size:180px;margin:6px 0;${resta <= 5 ? 'color:var(--bad)' : ''}">${resta}</div>
    <div class="fin" style="margin-top:0">${sp.candidati.map(id => { const p = pers(id); return `<div>${av(p, 150)}${esc(nomeCompleto(p))}</div>`; }).join('')}</div>
    <div class="s" style="margin-top:22px">Aprite l'app per votare! · Hanno votato ${votanti}/${adulti}</div></div>`;
}
function vistaPegno(s, tv) {
  const p = pers(s.pid), chiave = s.pid + '-' + s.g, pid = (tv.draws || {})[chiave];
  // il pegno si vede solo quando la ruota si è fermata (o se il giro è vecchio: TV riaperta dopo)
  const inGiro = T.girando || (tv.spin && tv.spin.key === chiave && T.spinFinito !== tv.spin.at && Date.now() - tv.spin.at < 9000);
  const pg = pid && !inGiro ? T.pegni.find(x => x.id === pid) : null;
  const karaoke = pg && pg.supporto === 'karaoke';
  const brano = karaoke && tv.karaoke ? T.brani.find(b => b.id === tv.karaoke) : null;
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-around;padding:40px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;width:560px;text-align:center">
      ${av(p, 170)}<div class="f" style="font-size:50px">${esc(nomeCompleto(p))}</div>
      <div class="s">Senza pigiama… paga pegno!</div><div class="card" style="font-size:22px;padding:8px 18px">Pegno ${s.g} di 2</div>
      ${pg ? `<div class="card pop" style="font-size:32px;font-weight:800;border-color:var(--acc)">${esc(pg.testo)}</div>` : ''}
      <div id="timerbox"></div>
      ${tv.card && pg && ['mimo', 'canzone'].includes(pg.supporto) ? `<div class="card" style="font-size:24px">Carta pescata: la vede solo l'organizzatore</div>` : ''}
      ${karaoke ? (brano ? `<div class="karaoke"><div class="s" style="margin-bottom:10px">Si canta:</div><a href="${esc(brano.url)}" target="_blank" rel="noopener">${esc(brano.titolo)} ▶</a></div>`
        : T.brani.length ? `<div class="card" style="font-size:22px;text-align:left">${T.brani.map((b, i) => `<div>${i + 1}. ${esc(b.titolo)}</div>`).join('')}</div>` : '') : ''}
    </div>${ruotaSVG()}</div>`;
}
function ruotaSVG() {
  const lista = T.pegni.filter(p => p.attivo); const n = lista.length || 1, seg = 360 / n, R = 250;
  const col = ['#FFC857', '#FF9EB1', '#8FD3FF', '#A8E6A1', '#FFF6E5'];
  const corto = t => t.length > 22 ? t.slice(0, 21) + '…' : t;
  const fette = lista.map((p, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180, mid = i * seg + seg / 2;
    return `<path d="M0 0L${R * Math.cos(a0)} ${R * Math.sin(a0)}A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)}Z" fill="${col[i % 5]}" stroke="#1B2346" stroke-width="3"/>
      <text transform="rotate(${mid}) translate(0 -${R * .55}) rotate(90)" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka" font-weight="700" font-size="${n > 12 ? 13 : 16}" fill="#1B2346">${esc(corto(p.testo))}</text>`;
  }).join('');
  return `<div style="position:relative;width:540px;height:540px;flex:none"><svg viewBox="-270 -270 540 540" width="540" height="540"><g id="ruota" style="transform:rotate(${T.ruota}deg)">${fette}</g><circle r="34" fill="#1B2346" stroke="#FFC857" stroke-width="6"/></svg>
    <div style="position:absolute;left:50%;top:-14px;transform:translateX(-50%);width:0;height:0;border-left:22px solid transparent;border-right:22px solid transparent;border-top:44px solid #FFF6E5"></div></div>`;
}
function scena() {
  const f = T.serata.fase, z = T.avz || {};
  if (f === 'iscrizioni' || f === 'attesa') return vistaAccoglienza();
  if (f === 'pronostici') return vistaProgressi('Fate i vostri<br><span class="acc">pronostici!</span>', z.pronostici_completi || 0, z.adulti_presenti || 0, 'Pronostici fatti');
  if (f === 'votazioni') return vistaProgressi('Votazioni <span class="acc">aperte!</span>', z.voti_completi || 0, z.adulti_presenti || 0, 'Voti confermati');
  if (f === 'votazioni_chiuse') return `<div class="c"><div class="t in">Votazioni <span class="acc">chiuse</span></div><div class="s in2" style="margin-top:24px">Tra poco la premiazione…</div></div>${luci()}`;
  return vistaPremiazione();
}
function chiaveScena() { const tv = T.serata.tv || {}; return T.serata.fase + '|' + (tv.i == null ? '' : tv.i) + '|' + (T.rivelato ? 1 : 0) + '|' + (T.sp ? T.sp.id : '') + '|' + (T.girando ? 'g' : '') + (T.spinFinito || ''); }
function disegna() {
  if (T.girando) return;
  // ridisegna solo se qualcosa è cambiato: altrimenti le animazioni d'ingresso ripartono di continuo
  const html = scena();
  if (html !== disegna.ultimo) {
    const el = $('scena'), stessa = disegna.chiave === chiaveScena();
    el.innerHTML = html; disegna.ultimo = html;
    if (stessa) el.querySelectorAll('.in,.in2,.in3,.pop').forEach(e => e.classList.remove('in', 'in2', 'in3', 'pop'));
    disegna.chiave = chiaveScena();
  }
  disegnaTimer();
  scenaOmini();
}

// ---------------------------------------------------------------- omini sulla TV
let OM = null, chiaveOmini = '';
function ominoDa(p) {
  const path = p.tipo === 'bimbo' ? p.viso_path : p.foto_path;
  return { id: p.id, faccia: (path && T.urls[path]) || null, voce: p.tipo === 'bimbo' ? 'b' : (p.voce || 'm'), pigiama: p.pigiama || 0, bimbo: p.tipo === 'bimbo' };
}
function scenaOmini() {
  if (!window.Omini || T.auguri) return;
  if (!OM) OM = window.Omini.crea($('omini'), { modo: 'tv', scala: .55, terra: () => (T.terra == null ? 656 : T.terra) });
  const f = T.serata.fase, tv = T.serata.tv || {}, s = passoCorrente(), R = T.ris;
  const conFaccia = T.persone.filter(p => (p.tipo === 'bimbo' ? p.viso_path : p.foto_path));
  OM.persone(conFaccia.map(ominoDa));
  const presenti = conFaccia.filter(p => p.presente);
  let chiave = f, lista = [];
  T.terra = 656;                               // sopra la fascia con le lucine
  const sorteggio = (arr, n) => [...arr].sort(() => Math.random() - .5).slice(0, n);
  if (['iscrizioni', 'attesa', 'pronostici', 'votazioni', 'votazioni_chiuse'].includes(f)) {
    const base = presenti.length ? presenti : conFaccia;
    chiave += '|' + base.map(p => p.id).join(',');
    lista = sorteggio(base, 7).map(p => ({ id: p.id, fa: 'passeggia', scala: .42 }));
  } else if (s) {
    chiave += '|' + tv.i + '|' + (T.rivelato ? 1 : 0) + '|' + (T.sp ? T.sp.id : '');
    const ha = id => conFaccia.some(p => p.id === id);
    if (s.k === 'bimbo' && ha(s.pid)) { T.terra = 648; lista = [{ id: s.pid, x: 160, fa: 'balla', scala: .8 }, { id: s.pid, x: 1120, fa: 'balla', scala: .8 }]; }
    else if (s.k === 'bimbiFine') { T.terra = 648; lista = presenti.filter(p => p.tipo === 'bimbo').slice(0, 8).map((p, i, a) => ({ id: p.id, x: 120 + i * (1040 / Math.max(1, a.length - 1 || 1)), fa: 'festa', scala: .5 })); }
    else if (s.k === 'catFinal' && R) { T.terra = 648; const rc = R.premi.find(x => x.categoria_id === s.c); lista = (rc ? rc.classifica.slice(0, 3) : []).filter(x => ha(x.persona_id)).map((x, i) => ({ id: x.persona_id, x: 90 + i * 110, fa: 'saltella', scala: .42 })); }
    else if (s.k === 'catWin' && R && T.rivelato) { T.terra = 648; const rc = R.premi.find(x => x.categoria_id === s.c); if (rc && rc.vincitore_id && ha(rc.vincitore_id)) lista = [{ id: rc.vincitore_id, x: 170, fa: 'balla', scala: .75 }, { id: rc.vincitore_id, x: 1110, fa: 'festa', scala: .75 }]; }
    else if (s.k === 'famWin' && R && T.rivelato && R.famiglie[0]) { T.terra = 648; const m = presenti.filter(p => p.famiglia_id === R.famiglie[0].famiglia_id); lista = m.map((p, i) => ({ id: p.id, x: i % 2 ? 1200 - Math.floor(i / 2) * 70 : 80 + Math.floor(i / 2) * 70, fa: 'balla', scala: .42 })); }
    else if (s.k === 'fine') { const v = sorteggio(presenti, 10); lista = v.map((p, i) => ({ id: p.id, x: 70 + i * (1140 / Math.max(1, v.length - 1 || 1)), fa: 'balla', scala: .45 })); }
  }
  if (chiave === chiaveOmini) return;
  chiaveOmini = chiave;
  OM.scena(lista);
}

// ---------------------------------------------------------------- reazioni ai cambiamenti della regia
function entraPasso() {
  const s = passoCorrente(); if (!s) return;
  T.rivelato = false; T.rivelando = false; fermaTimer();
  if (s.k === 'catWin' || s.k === 'famWin') rivela();
  if (s.k === 'bimbo') { suoni.fanfara(); suoni.applausi(); coriandoli(100); }
  if (s.k === 'bimbiFine' || s.k === 'fine') { suoni.fanfara(); fuochi(); }
  if (['intro', 'catTitle', 'catFinal', 'famFinal', 'pegniIntro', 'bimbiIntro'].includes(s.k)) tono(660, 0, .3, 'triangle', .15);
  if (s.k === 'clAd') { const n = T.ris ? Math.min(T.ris.adulti.length, 12) : 0; setTimeout(() => { suoni.tamburi(1.4); }, Math.max(0, (n - 3) * 250 + 3200)); setTimeout(() => { suoni.fanfara(); coriandoli(200); }, Math.max(0, (n - 3) * 250 + 4900)); }
  if (s.k === 'clFam') setTimeout(() => { suoni.fanfara(); coriandoli(160); }, (T.ris ? T.ris.famiglie.length - 1 : 0) * 600 + 700);
}
function rivela() {
  const s = passoCorrente(), i = (T.serata.tv || {}).i;
  if (T.rivelando || T.rivelato) return;
  if (s.k === 'catWin') {
    const rc = T.ris && T.ris.premi.find(x => x.categoria_id === s.c);
    if (!rc || (!rc.vincitore_id && rc.pareggio)) { if (rc && rc.pareggio && !T.sp) suoni.tamburi(.8); return; }
  }
  T.rivelando = true; suoni.tamburi(1.8);
  setTimeout(() => { T.rivelando = false; if ((T.serata.tv || {}).i === i) { T.rivelato = true; suoni.fanfara(); suoni.applausi(); coriandoli(220); disegna(); } }, 1900);
}
function giraRuota(spin) {
  const lista = T.pegni.filter(p => p.attivo), idx = lista.findIndex(p => p.id === spin.pegno);
  if (idx < 0) return;
  const seg = 360 / lista.length, target = 360 - (idx * seg + seg / 2), cur = ((T.ruota % 360) + 360) % 360;
  let delta = target - cur; if (delta < 0) delta += 360;
  T.girando = false; disegna();            // ruota ferma nella posizione di prima
  T.ruota += 360 * 5 + delta; T.girando = true;
  requestAnimationFrame(() => {
    const g = $('ruota'); if (!g) { T.girando = false; return; }
    g.style.transition = 'transform 4.2s cubic-bezier(.12,.6,.1,1)'; g.style.transform = `rotate(${T.ruota}deg)`;
  });
  let k = 0; const iv = setInterval(() => { suoni.tic(); if (++k > 30) clearInterval(iv); }, 140);
  setTimeout(() => { T.girando = false; T.spinFinito = spin.at; suoni.ding(); coriandoli(60); disegna(); }, 4300);
}
function avviaTimer(t) {
  fermaTimer();
  T.timer = { id: t.id, resta: t.sec, target: t.target || 0, count: t.count || 0 };
  T.timerIv = setInterval(() => {
    T.timer.resta--;
    if (T.timer.resta <= 5 && T.timer.resta > 0) suoni.tic();
    if (T.timer.resta <= 0) { clearInterval(T.timerIv); T.timerIv = null; suoni.fine(); }
    disegnaTimer();
  }, 1000);
  disegnaTimer();
}
function fermaTimer() { if (T.timerIv) clearInterval(T.timerIv); T.timerIv = null; T.timer = null; }
function disegnaTimer() {
  const box = $('timerbox'); if (!box) return;
  const t = T.timer; if (!t) { box.innerHTML = ''; return; }
  const fallito = t.resta <= 0 && t.target && t.count < t.target, riuscito = t.target && t.count >= t.target;
  box.innerHTML = `<div class="f ${t.resta <= 5 && !riuscito ? 'pulse' : ''}" style="font-size:110px;color:${t.resta <= 5 && !riuscito ? 'var(--bad)' : 'var(--acc)'}">${Math.max(0, t.resta)}</div>
    ${t.target ? `<div class="f" style="font-size:44px">${t.count}/${t.target}${fallito ? ' · Si ricomincia!' : riuscito ? ' · Ce l\'ha fatta!' : ''}</div>` : ''}`;
}

async function suCambioSerata(nuova) {
  const prima = T.serata; T.serata = nuova;
  const tvP = (prima && prima.tv) || {}, tvN = nuova.tv || {};
  const cambiataFase = !prima || prima.fase !== nuova.fase;
  if (cambiataFase || prima.spareggio_id !== nuova.spareggio_id) {
    if (cambiataFase) { T.persone = await q(sb.from('persone').select('*').order('creata_il')); await preparaUrl([...T.persone.map(p => p.foto_path), ...T.persone.map(p => p.viso_path)]); }
    await caricaRisultati(); await caricaSpareggio(); await aggiornaAvanzamento();
    const s = passoCorrente();
    if (!cambiataFase && prima.spareggio_id && !nuova.spareggio_id && s && s.k === 'catWin') rivela();
  }
  const passoP = tvP.steps ? tvP.i : -1, passoN = tvN.steps ? tvN.i : -1;
  const cambioPasso = passoP !== passoN || JSON.stringify(tvP.steps) !== JSON.stringify(tvN.steps);
  if (cambioPasso) { if (!T.ris && ['premiazione', 'fine'].includes(nuova.fase)) await caricaRisultati(); entraPasso(); aggiornaMusica(); }
  if (tvN.spin && (!tvP.spin || tvN.spin.at !== tvP.spin.at) && !cambioPasso) { disegna(); giraRuota(tvN.spin); }
  else if (!T.girando) disegna();
  if (tvN.timer && (!tvP.timer || tvN.timer.id !== tvP.timer.id)) avviaTimer(tvN.timer);
  else if (tvN.timer && T.timer && tvN.timer.count !== T.timer.count) {
    T.timer.count = tvN.timer.count; suoni.ding();
    if (T.timer.target && T.timer.count >= T.timer.target) { clearInterval(T.timerIv); T.timerIv = null; suoni.fanfara(); coriandoli(80); }
    disegnaTimer();
  }
  const cdP = (tvP.countdown || {}), cdN = (tvN.countdown || {});
  if (cdN.ora && cdN.ora !== cdP.ora) { T.cdStart = Date.now(); T.cdChiuso = null; }
  if (cambiataFase) aggiornaMusica();
  if (JSON.stringify(tvP.musica) !== JSON.stringify(tvN.musica)) aggiornaMusica();
}
// Quando lo spareggio si chiude (o si allunga) aggiorna risultati e timer
async function suCambioSpareggio() {
  await caricaSpareggio(); await caricaRisultati();
  const s = passoCorrente();
  if (s && s.k === 'catWin' && (!T.sp || T.sp.vincitore_id)) rivela();
  disegna();
}

// ---------------------------------------------------------------- countdown di mezzanotte
function mezzanotte() {
  const base = new Date(C.DATA_FESTA || '2026-12-31T20:00:00+01:00');
  const m = new Date(base); m.setHours(24, 0, 0, 0);
  const rinvio = ((T.serata && T.serata.tv && T.serata.tv.countdown) || {}).rinvio || 0;
  return m.getTime() + rinvio * 60000;
}
// Auguri dopo mezzanotte: "Buon 2027!" una volta sola, poi gli auguri a turno di ogni ospite,
// tutti gli omini che ballano e fuochi d'artificio. Dura 3 minuti (45 secondi nella prova).
const AUGURI = [
  'Che il 2027 ti porti pigiami sempre più comodi', 'Dodici mesi di pisolini senza sveglia', 'Che il divano sia sempre libero per te',
  'Colazione a letto almeno una volta al mese', 'Calzini sempre in coppia, tutto l\'anno', 'Un anno morbido come le tue pantofole',
  'Che le coperte non ti abbandonino mai', 'Sogni belli e risvegli lenti', 'Meno sveglie, più cuscini',
  'Un anno pieno di risate (e di panettone avanzato)', 'Abbracci caldi come la flanella', 'Che ogni lunedì ti sembri una domenica'
];
const AUGURI_BIMBI = ['Un anno pieno di giochi e di coccole', 'Tanti pigiama party e zero compiti', 'Che i mostri sotto il letto restino in vacanza', 'Un anno di storie della buonanotte'];
function iniziaAuguri(el, anno) {
  T.auguri = { coda: [], iv: null, fuochi: null, t0: Date.now() };
  $('stage').classList.add('auguri');
  el.innerHTML = `<div class="aug"><div class="t pop acc aug-t">Buon ${anno}!</div><div id="augcard"></div></div>${luci()}`;
  setTimeout(prossimoAugurio, 2600);
  T.auguri.iv = setInterval(prossimoAugurio, 6500);
  T.auguri.fuochi = setInterval(() => { if (Date.now() - T.auguri.t0 < 60000 || Math.random() < .4) fuochi(); }, 6000);
  // tutti gli omini a ballare
  if (OM) {
    const con = T.persone.filter(p => p.presente && (p.tipo === 'bimbo' ? p.viso_path : p.foto_path));
    const v = [...con].sort(() => Math.random() - .5).slice(0, 12);
    chiaveOmini = 'auguri';
    OM.scena(v.map((p, i) => ({ id: p.id, x: 70 + i * (1140 / Math.max(1, v.length - 1 || 1)), fa: i % 3 ? 'balla' : 'festa', scala: .42 })));
  }
}
function prossimoAugurio() {
  const A = T.auguri, box = $('augcard'); if (!A || !box) return;
  if (!A.coda.length) A.coda = T.persone.filter(p => p.presente).sort(() => Math.random() - .5);
  const p = A.coda.shift(); if (!p) return;
  const lista = p.tipo === 'bimbo' ? AUGURI_BIMBI : AUGURI;
  const frase = lista[Math.floor(Math.random() * lista.length)];
  box.innerHTML = `<div class="augc in">${av(p, 170)}<div style="text-align:left"><div class="f" style="font-size:46px">Auguri da ${esc(nome(p))}!</div><div class="s" style="font-size:32px;margin-top:8px;max-width:680px">${esc(frase)}</div></div></div>`;
}
function fineAuguri() {
  if (!T.auguri) return;
  clearInterval(T.auguri.iv); clearInterval(T.auguri.fuochi); T.auguri = null;
  $('stage').classList.remove('auguri');
  chiaveOmini = ''; scenaOmini();
}
function tickCountdown() {
  const el = $('cd'); let target, inizio;
  if (T.cdStart) { target = T.cdStart + 10000; inizio = T.cdStart; }
  else { target = mezzanotte(); inizio = target - 5 * 60000; }
  const durata = T.cdStart ? 45000 : 180000;
  const ora = Date.now(), resta = Math.ceil((target - ora) / 1000);
  const attivo = ora >= inizio && ora < target + durata;
  if (!attivo) {
    if (el.style.display !== 'none') { el.style.display = 'none'; el.dataset.modo = ''; fineAuguri(); if (T.cdStart && ora >= target + durata) T.cdStart = null; }
    return;
  }
  el.style.display = 'flex';
  const anno = new Date(C.DATA_FESTA || '2026-12-31T20:00:00+01:00').getFullYear() + 1;
  // ogni parte si disegna una volta sola; poi cambia solo il numero
  if (resta > 10) {
    if (el.dataset.modo !== 'attesa') { el.dataset.modo = 'attesa'; el.innerHTML = `<div class="s">Mezzanotte tra</div><div class="t acc" id="cdnum" style="font-size:240px;font-variant-numeric:tabular-nums"></div>${luci()}`; }
    const mm = Math.floor(resta / 60), ss = String(resta % 60).padStart(2, '0'), txt = `${mm}:${ss}`;
    const n = $('cdnum'); if (n && n.textContent !== txt) n.textContent = txt;
  } else if (resta > 0) {
    if (el.dataset.modo !== 'conta') { el.dataset.modo = 'conta'; el.innerHTML = '<div id="cdnum"></div>'; }
    if (T.ultimoNum !== resta) { T.ultimoNum = resta; suoni.bip(); $('cdnum').outerHTML = `<div id="cdnum" class="t pop acc" style="font-size:360px">${resta}</div>`; }
  } else if (el.dataset.modo !== 'auguri') {
    el.dataset.modo = 'auguri';
    if (T.ultimoBoom !== target) { T.ultimoBoom = target; suoni.fanfara(); suoni.applausi(); suoni.botti(); fuochi(); if (!T.cdStart) { T.festa = true; aggiornaMusica(); } }
    iniziaAuguri(el, anno);
  }
}

// ---------------------------------------------------------------- adattamento allo schermo
function adatta() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  $('stage').style.transform = `scale(${s})`;
}
addEventListener('resize', adatta);

// ---------------------------------------------------------------- avvio
function schermataAvvio(msg) {
  $('start').style.display = 'flex';
  $('start').innerHTML = `<div style="width:130px;height:130px">${LUNA}</div><div class="t" style="font-size:56px">Capodanno <span class="acc">in Pigiama</span></div><div class="s" style="font-size:24px">Schermo TV</div>
    ${msg || ''}<button class="btn" id="avvia">Avvia schermo TV</button><div id="spstato" class="s" style="font-size:18px"></div>
    <p class="s" style="font-size:16px;max-width:560px">Il tocco serve a sbloccare suoni e musica. Poi lo schermo va da solo: si comanda tutto dal telefono, nella scheda Regia.</p>`;
  aggiornaStatoSpotify(); spPrepara();
  $('avvia').onclick = async () => {
    ac(); suoni.ding();
    if (SP.player && SP.player.activateElement) SP.player.activateElement();   // il browser vuole un tocco per far suonare Spotify
    try { await document.documentElement.requestFullscreen(); } catch (e) { /* facoltativo */ }
    try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* facoltativo */ }
    $('start').style.display = 'none'; T.avviato = true; caricaSuoniTv(); aggiornaMusica(); disegna();
  };
}
function schermataAccesso(err) {
  $('start').style.display = 'flex';
  $('start').innerHTML = `<div style="width:130px;height:130px">${LUNA}</div><div class="t" style="font-size:56px">Capodanno <span class="acc">in Pigiama</span></div><div class="s" style="font-size:22px">Schermo TV · accedi con l'account dell'organizzatore</div>
    <input class="txt" id="email" type="email" autocomplete="username" placeholder="La tua email">
    <input class="txt" id="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" placeholder="PIN di 6 cifre">
    <button class="btn" id="vai">Entra</button>
    ${window.PublicKeyCredential ? '<button class="btn ghost" id="pk">Entra con impronta / Face ID</button>' : ''}
    ${err ? `<div class="err">${esc(err)}</div>` : ''}`;
  $('vai').onclick = async () => {
    try { await q(sb.auth.signInWithPassword({ email: $('email').value.trim().toLowerCase(), password: $('pin').value.trim() })); avvia(); }
    catch (e) { schermataAccesso(/invalid login/i.test(e.message || '') ? 'Email o PIN sbagliati.' : (e.message || 'Errore')); }
  };
  if ($('pk')) $('pk').onclick = async () => {
    try { await q(sb.auth.signInWithPasskey()); avvia(); }
    catch (e) { schermataAccesso('Accesso biometrico non riuscito: usa email e PIN.'); }
  };
}
async function avvia() {
  adatta();
  if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('XXXX')) { $('start').style.display = 'flex'; $('start').innerHTML = '<div class="t" style="font-size:40px">Compila config.js</div>'; return; }
  await spRitorno();   // se si rientra da Spotify, salva il collegamento
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return schermataAccesso('');
  try { await caricaDati(); await aggiornaAvanzamento(); }
  catch (e) { return schermataAccesso('Questo account non può aprire lo schermo TV: usa quello dell\'organizzatore.'); }
  T.fase = T.serata.fase;
  const tv = T.serata.tv || {};
  if (tv.timer) { /* un timer vecchio non riparte */ }
  sb.channel('tv')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'serata' }, p => { suCambioSerata(p.new).catch(e => console.warn(e)); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spareggi' }, () => { suCambioSpareggio().catch(e => console.warn(e)); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estrazioni_pegni' }, () => {})
    .subscribe();
  setInterval(async () => {
    const f = T.serata.fase;
    await aggiornaAvanzamento();
    if (['iscrizioni', 'attesa'].includes(f)) { try { T.persone = await q(sb.from('persone').select('*').order('creata_il')); } catch (e) { /* niente */ } }
    if (!T.girando && ['iscrizioni', 'attesa', 'pronostici', 'votazioni'].includes(f)) disegna();
  }, 4000);
  setInterval(() => {
    tickCountdown();
    if (T.sp && !T.sp.vincitore_id) { const el = $('spresta'); if (el) { const r = Math.max(0, Math.ceil((new Date(T.sp.fine) - new Date()) / 1000)); el.textContent = r; el.style.color = r <= 5 ? 'var(--bad)' : ''; if (r <= 5 && r > 0) suoni.tic(); } }
  }, 1000);
  setInterval(() => { if (T.sp && !T.sp.vincitore_id) aggiornaAvanzamento().then(() => { const s = passoCorrente(); if (s && s.k === 'catWin') disegna(); }); }, 3000);
  disegna();
  schermataAvvio();
}
avvia();
})();
