/* =====================================================================
   CAPODANNO IN PIGIAMA — app ospiti
   Parte 1: accesso, iscrizione, home, la mia famiglia, regole
   ===================================================================== */
(() => {
'use strict';

const C = window.CONFIG || {};
const configurata = C.SUPABASE_URL && !C.SUPABASE_URL.includes('XXXX') && C.SUPABASE_ANON_KEY && !C.SUPABASE_ANON_KEY.includes('INCOLLA');
const sb = configurata ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;

const TITOLI = ['Re dei Ghiri', 'Principessa delle Pantofole', 'Campione di Coccole', 'Regina dei Sogni', 'Capitano Cuscino', 'Mago della Nanna'];
const FASI = {
  iscrizioni: 'Iscrizioni aperte', attesa: 'Arrivi', pronostici: 'Pronostici', votazioni: 'Votazioni',
  votazioni_chiuse: 'Votazioni chiuse', premiazione: 'Premiazione', fine: 'Fine serata'
};
const PRIVACY = [
  'Le foto che carichi (la tua e quella della tua famiglia) vengono conservate in uno spazio privato di ' + (C.ORGANIZZATORE || 'Salvatore') + ', visibile solo ai partecipanti della festa che hanno effettuato l\'accesso all\'app.',
  'Non verranno pubblicate né condivise online con nessuno.',
  'Qualche giorno dopo la festa tutte le foto saranno cancellate definitivamente.',
  'Puoi cambiare la tua foto e quella della famiglia in qualunque momento.'
];

const S = {
  screen: 'loading',          // loading | config | login | wizard | chiuse | main
  tab: 'home',
  session: null, me: null, fam: null, members: [], serata: null, categorie: [],
  login: { step: giaEntrato() ? 'accedi' : 'nuovo', email: '', err: '', busy: false }, passkey: null,
  wiz: null, sheet: null, urls: {}, busy: false, channel: null, caricando: false
};
const app = document.getElementById('app');
function giaEntrato() { try { return localStorage.getItem('pigiama-gia') === '1'; } catch (e) { return false; } }

// ---------------------------------------------------------------- utilità
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const nomeVisto = p => p.soprannome || p.nome;
const nomeFamiglia = f => f ? `Famiglia ${f.cognome} – ${f.nickname}` : '';
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = t; document.body.appendChild(d);
  setTimeout(() => d.remove(), 2800);
}
function erroreLeggibile(e) {
  if (e && typeof Event !== 'undefined' && e instanceof Event) e = new Error('FOTO_ILLEGGIBILE');
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
  if (/FOTO_ILLEGGIBILE/.test(m)) return 'Questa foto non si riesce a leggere. Riprova scattandola di nuovo, oppure scegline un\'altra (JPG o PNG).';
  if (m === '[object Event]' || m === '[object Object]') return 'Qualcosa è andato storto. Riprova.';
  if (/row-level security/i.test(m)) return 'Operazione non permessa.';
  if (/rate limit|too many/i.test(m)) return 'Troppi tentativi: aspetta un minuto e riprova.';
  if (/invalid login credentials/i.test(m)) return 'Email o PIN sbagliati. Se è la prima volta, scegli "Prima volta".';
  if (/already registered|already been registered|user_already_exists/i.test(m)) return 'Questa email è già registrata: scegli "Ho già un account".';
  if (/password should be|weak_password|password.*characters/i.test(m)) return 'Il PIN deve avere 6 cifre.';
  if (/NotAllowedError|not allowed|aborted|cancel/i.test(m)) return 'Operazione annullata.';
  if (/passkey|webauthn|credential/i.test(m)) return 'Face ID / impronta non disponibile: entra con email e PIN.';
  if (/not authorized|email address not authorized/i.test(m)) return 'L\'invio delle email non è ancora attivo: avvisa ' + (C.ORGANIZZATORE || 'l\'organizzatore') + '.';
  if (/failed to fetch|network/i.test(m)) return 'Connessione assente. Controlla la rete e riprova.';
  return m || 'Qualcosa è andato storto. Riprova.';
}
async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- foto
// Legge la foto in modo robusto: prova più metodi, perché ogni telefono e browser ne supporta di diversi
async function caricaImmagine(file, max) {
  if (window.createImageBitmap) {
    const tentativi = [
      { imageOrientation: 'from-image', resizeWidth: max * 2, resizeQuality: 'high' },
      { imageOrientation: 'from-image' },
      undefined
    ];
    for (const opz of tentativi) {
      try { return opz ? await createImageBitmap(file, opz) : await createImageBitmap(file); } catch (e) { /* prossimo tentativo */ }
    }
  }
  return await new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('FOTO_ILLEGGIBILE'));
    img.src = url;
  });
}
async function riduci(file, max = 1000) {
  try {
    const img = await caricaImmagine(file, max);
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const sc = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(h * sc));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.82));
    if (blob && blob.size > 0) return blob;
  } catch (e) { /* sotto: piano B */ }
  // Piano B: se è già un JPG/PNG non troppo pesante lo carichiamo così com'è
  if (/^image\/(jpe?g|png|webp)$/i.test(file.type) && file.size < 8 * 1024 * 1024) return file;
  throw new Error('FOTO_ILLEGGIBILE');
}
async function caricaFoto(path, blob) {
  await q(sb.storage.from('foto').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true }));
  return path;
}
async function rimuoviFoto(path) {
  if (!path) return;
  try { await sb.storage.from('foto').remove([path]); } catch (e) { /* non bloccante */ }
}
async function preparaUrl(paths) {
  const mancanti = [...new Set(paths.filter(p => p && !S.urls[p]))];
  if (!mancanti.length) return;
  try {
    const data = await q(sb.storage.from('foto').createSignedUrls(mancanti, 60 * 60 * 6));
    (data || []).forEach(x => { if (x.signedUrl) S.urls[x.path] = x.signedUrl; });
  } catch (e) { console.warn('foto', e); }
}
function avatar(p, size) {
  const s = size || 44;
  const path = p && (p.tipo === 'bimbo' ? (p.viso_path || p.foto_path) : p.foto_path);
  const url = path && S.urls[path];
  const ini = esc((p ? nomeVisto(p) : '?')[0] || '?');
  return `<span class="av" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .42)}px">${url ? `<img src="${esc(url)}" alt="">` : ini}</span>`;
}

// ---------------------------------------------------------------- dati
async function caricaTutto() {
  if (S.caricando) return;
  S.caricando = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    S.session = session;
    if (!session) { S.screen = 'login'; return; }
    try { localStorage.setItem('pigiama-gia', '1'); } catch (e) { /* niente */ }

    S.serata = await q(sb.from('serata').select('*').eq('id', 1).single());
    S.me = await q(sb.from('persone').select('*').eq('user_id', session.user.id).maybeSingle());

    if (!S.me) {
      if (!S.serata.iscrizioni_aperte) { S.screen = 'chiuse'; return; }
      if (!S.wiz) S.wiz = nuovoWizard(session.user.email);
      S.screen = 'wizard';
      return;
    }
    await caricaFamiglia();
    S.categorie = await q(sb.from('categorie').select('*').order('ordine'));
    if (!S.wiz || S.wiz.step >= 4) { S.screen = 'main'; S.wiz = null; }
    ascoltaSerata();
    await caricaFase();
    controllaPasskey().then(render);
  } catch (e) {
    console.error(e);
    toast(erroreLeggibile(e));
    if (!S.session) S.screen = 'login';
  } finally {
    S.caricando = false;
    render();
  }
}
async function caricaFamiglia() {
  S.me = await q(sb.from('persone').select('*').eq('user_id', S.session.user.id).single());
  S.fam = await q(sb.from('famiglie').select('*').eq('id', S.me.famiglia_id).single());
  S.members = await q(sb.from('persone').select('*').eq('famiglia_id', S.me.famiglia_id).order('tipo').order('creata_il'));
  await preparaUrl([S.fam.foto_path, ...S.members.map(m => m.foto_path), ...S.members.map(m => m.viso_path)]);
  ominiCaricati = 0;   // al prossimo disegno gli omini prendono le facce aggiornate
}
function ascoltaSerata() {
  if (S.channel) return;
  S.channel = sb.channel('serata')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'serata' }, p => {
      const primaSp = S.serata && S.serata.spareggio_id, primaFase = S.serata && S.serata.fase;
      S.serata = p.new;
      if (p.new.spareggio_id && p.new.spareggio_id !== primaSp && S.tab !== 'admin') { S.tab = 'home'; S.sheet = null; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* niente */ } }
      if (p.new.fase !== primaFase && S.tab !== 'admin') S.tab = 'home';
      caricaFase().catch(e => console.warn(e)).finally(render);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spareggi' }, () => {
      caricaSpareggio().catch(e => console.warn(e)).finally(render);
    })
    .subscribe();
}

// ---------------------------------------------------------------- accesso (email + PIN, più Face ID / impronta)
const PASSKEY_OK = !!(window.PublicKeyCredential && navigator.credentials);
function leggiLogin() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  if (document.getElementById('email')) S.login.email = v('email').toLowerCase();
  return { email: S.login.email, pin: v('pin').replace(/\D/g, ''), pin2: v('pin2').replace(/\D/g, '') };
}
async function entra() {
  const L = S.login, d = leggiLogin();
  L.err = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { L.err = 'Scrivi un indirizzo email valido.'; return render(); }
  if (d.pin.length !== 6) { L.err = 'Il PIN deve avere 6 cifre.'; return render(); }
  if (L.step === 'nuovo' && d.pin !== d.pin2) { L.err = 'I due PIN non coincidono.'; return render(); }
  L.busy = true; render();
  try {
    if (L.step === 'nuovo') {
      const data = await q(sb.auth.signUp({ email: d.email, password: d.pin }));
      if (!data.session) throw new Error('Registrazione in attesa di conferma: avvisa ' + (C.ORGANIZZATORE || 'l\'organizzatore') + ' (va spenta l\'opzione "Confirm email" in Supabase).');
    } else {
      await q(sb.auth.signInWithPassword({ email: d.email, password: d.pin }));
    }
    S.screen = 'loading'; render();
    await caricaTutto();
  } catch (e) { L.err = erroreLeggibile(e); }
  L.busy = false; render();
}
async function entraConPasskey() {
  S.login.busy = true; S.login.err = ''; render();
  try {
    await q(sb.auth.signInWithPasskey());
    S.screen = 'loading'; render();
    await caricaTutto();
  } catch (e) { S.login.err = 'Face ID / impronta non riuscito o annullato. Entra con email e PIN: poi potrai attivarlo su questo telefono.'; }
  S.login.busy = false; render();
}
async function controllaPasskey() {
  S.passkey = null;
  if (!PASSKEY_OK || !sb.auth.passkey) return;
  try { const l = await q(sb.auth.passkey.list()); S.passkey = Array.isArray(l) ? l.length : (l && l.passkeys ? l.passkeys.length : 0); }
  catch (e) { S.passkey = null; }
}
async function attivaPasskey() {
  try {
    await q(sb.auth.registerPasskey());
    S.passkey = (S.passkey || 0) + 1;
    try { localStorage.setItem('pigiama-passkey-' + S.session.user.id, '1'); } catch (e) { /* niente */ }
    toast('Fatto! La prossima volta entri con Face ID o impronta');
  } catch (e) { toast(erroreLeggibile(e)); }
  render();
}
function passkeyRifiutata() { try { return localStorage.getItem('pigiama-passkey-no-' + S.session.user.id) === '1'; } catch (e) { return false; } }
async function esci() {
  try { await sb.auth.signOut(); } catch (e) { /* ignora */ }
  if (S.channel) { sb.removeChannel(S.channel); S.channel = null; }
  Object.assign(S, { session: null, me: null, fam: null, members: [], wiz: null, sheet: null, tab: 'home', screen: 'login' });
  S.login = { step: 'accedi', email: S.login.email, err: '', busy: false };
  render();
}

// ---------------------------------------------------------------- iscrizione
function nuovoWizard(email) {
  return { step: 0, nome: '', cognome: '', soprannome: '', foto: null, fotoPrev: null, privacy: false, voce: null, kViso: null, kVisoPrev: null,
           mode: 'crea', famCognome: '', famNick: '', famId: null, famiglie: null,
           kNome: '', kEta: '', kTitolo: '', err: '', busy: false, email };
}
async function wizAvanti() {
  const w = S.wiz; w.err = '';
  if (w.step === 0) {
    if (!w.nome.trim() || !w.cognome.trim()) w.err = 'Nome e cognome sono obbligatori.';
    else if (!w.foto) w.err = 'Aggiungi una foto del viso: serve a riconoscerti nelle votazioni.';
    else if (!w.voce) w.err = 'Scegli la voce del tuo omino.';
    else if (!w.privacy) w.err = 'Per continuare spunta "Ho letto e accetto".';
    if (w.err) return render();
    if (!w.famCognome) w.famCognome = w.cognome.trim();
    w.step = 1; render();
    return;
  }
  if (w.step === 1) {
    if (w.mode === 'crea' && (!w.famCognome.trim() || !w.famNick.trim())) { w.err = 'Cognome e nickname della famiglia sono obbligatori.'; return render(); }
    if (w.mode === 'unisci' && !w.famId) { w.err = 'Scegli la tua famiglia dall\'elenco.'; return render(); }
    w.busy = true; render();
    try {
      const uid = S.session.user.id;
      let famId = w.famId;
      if (w.mode === 'crea') {
        famId = uuid();
        await q(sb.from('famiglie').insert({ id: famId, cognome: w.famCognome.trim(), nickname: w.famNick.trim(), creata_da: uid }));
      }
      const pid = uuid();
      await q(sb.from('persone').insert({
        id: pid, famiglia_id: famId, tipo: 'adulto', user_id: uid,
        nome: w.nome.trim(), cognome: w.cognome.trim(), soprannome: w.soprannome.trim() || null, voce: w.voce
      }));
      const path = await caricaFoto(`${famId}/${pid}-${Date.now()}.jpg`, w.foto);
      await q(sb.from('persone').update({ foto_path: path }).eq('id', pid));
      await caricaFamiglia();
      S.categorie = await q(sb.from('categorie').select('*').order('ordine'));
      ascoltaSerata();
      w.step = 2;
    } catch (e) { w.err = erroreLeggibile(e); }
    w.busy = false; render();
    return;
  }
  if (w.step === 2) { w.step = 3; return render(); }
  if (w.step === 3) { w.step = 4; return render(); }
  if (w.step === 4) { S.wiz = null; S.screen = 'main'; S.tab = 'home'; return render(); }
}
async function caricaFamiglieDisponibili() {
  try {
    S.wiz.famiglie = await q(sb.rpc('famiglie_disponibili'));
  } catch (e) { S.wiz.famiglie = []; S.wiz.err = erroreLeggibile(e); }
  render();
}

// ---------------------------------------------------------------- viso nell'ovale
async function prendiViso(dest, opz) {
  const titoli = { wiz: 'Il tuo viso', me: 'Il tuo viso', wizkid: 'Il viso del bimbo', sheetkid: 'Il viso del bimbo' };
  if (window.Omini && OM) OM.pausa(true);
  let blob = null;
  try { blob = await window.Viso.apri(Object.assign({ titolo: titoli[dest] || 'Il viso' }, opz)); }
  finally { if (OM) OM.pausa(false); aggiornaOmini(true); }
  if (!blob) return;
  const prev = URL.createObjectURL(blob);
  if (dest === 'wiz') { S.wiz.foto = blob; S.wiz.fotoPrev = prev; S.wiz.err = ''; }
  if (dest === 'wizkid') { S.wiz.kViso = blob; S.wiz.kVisoPrev = prev; }
  if (dest === 'me' && S.sheet) { S.sheet.foto = blob; S.sheet.fotoPrev = prev; }
  if (dest === 'sheetkid' && S.sheet) { S.sheet.viso = blob; S.sheet.visoPrev = prev; }
}

// ---------------------------------------------------------------- omini
let OM = null, ominiChiave = '', ominiCaricati = 0;
function ominoDa(p) {
  const path = p.tipo === 'bimbo' ? p.viso_path : p.foto_path;
  return { id: p.id, faccia: (path && S.urls[path]) || null, voce: p.tipo === 'bimbo' ? 'b' : (p.voce || 'm'), pigiama: p.pigiama || 0, bimbo: p.tipo === 'bimbo' };
}
function ominiFinti(n) {
  return Array.from({ length: Math.max(1, Math.min(n, 30)) }, (_, i) => ({ id: 'finto-' + i, faccia: null, voce: i % 2 ? 'f' : 'm', pigiama: (i * 3) % 8, bimbo: i % 5 === 4 }));
}
async function aggiornaOmini(forza) {
  if (!window.Omini) return;
  if (!OM) OM = window.Omini.crea(document.getElementById('omini'), {
    modo: 'app', max: 2, scala: .46,
    terra: () => window.innerHeight - ((document.querySelector('.nav') || {}).offsetHeight || 0) - 2,
    riquadri: () => [...document.querySelectorAll('#app .card')]
  });
  const pausa = !!S.sheet || S.tab === 'admin' || S.screen === 'loading';
  OM.pausa(pausa);
  const registrato = S.screen === 'main' && S.me;
  const chiave = registrato ? 'veri' : 'finti';
  if (!forza && chiave === ominiChiave && Date.now() - ominiCaricati < 60000) return;
  ominiChiave = chiave; ominiCaricati = Date.now();
  try {
    if (registrato) {
      const tutti = await q(sb.from('persone').select('id,tipo,foto_path,viso_path,voce,pigiama'));
      await preparaUrl([...tutti.map(p => p.foto_path), ...tutti.map(p => p.viso_path)]);
      const conFoto = tutti.map(ominoDa).filter(o => o.faccia);
      OM.persone(conFoto.length ? conFoto : ominiFinti(1));
    } else {
      let n = 1;
      try { n = await q(sb.rpc('conteggio_omini')); } catch (e) { n = 1; }
      OM.persone(ominiFinti(n || 1));
    }
  } catch (e) { console.warn('omini', e); }
}

// ---------------------------------------------------------------- figli
async function salvaFiglio(dati, id, viso) {
  const nome = (dati.nome || '').trim(), titolo = (dati.titolo || '').trim();
  const eta = parseInt(dati.eta, 10);
  if (!id && !viso) throw new Error('Aggiungi la foto del viso del bimbo: servirà per il suo omino.');
  if (!nome) throw new Error('Scrivi il nome del bimbo.');
  if (isNaN(eta) || eta < 0 || eta > 17) throw new Error('L\'età deve essere tra 0 e 17 anni.');
  if (!titolo) throw new Error('Scegli o scrivi un titolo buffo.');
  const kid = id || uuid();
  if (id) await q(sb.from('persone').update({ nome, eta, titolo_buffo: titolo }).eq('id', id));
  else await q(sb.from('persone').insert({ id: kid, famiglia_id: S.me.famiglia_id, tipo: 'bimbo', nome, eta, titolo_buffo: titolo }));
  if (viso) {
    const vecchio = (S.members.find(m => m.id === kid) || {}).viso_path;
    const path = await caricaFoto(`${S.me.famiglia_id}/${kid}-viso-${Date.now()}.jpg`, viso);
    await q(sb.from('persone').update({ viso_path: path }).eq('id', kid));
    if (vecchio) await rimuoviFoto(vecchio);
  }
  await caricaFamiglia();
}
async function eliminaFiglio(id) {
  const k = S.members.find(m => m.id === id);
  await q(sb.from('persone').delete().eq('id', id));
  if (k && k.foto_path) await rimuoviFoto(k.foto_path);
  if (k && k.viso_path) await rimuoviFoto(k.viso_path);
  await caricaFamiglia();
}

// ---------------------------------------------------------------- foto famiglia / mia
async function cambiaFotoFamiglia(file) {
  const blob = await riduci(file, 1400);
  const vecchia = S.fam.foto_path;
  const path = await caricaFoto(`${S.fam.id}/famiglia-${Date.now()}.jpg`, blob);
  await q(sb.from('famiglie').update({ foto_path: path }).eq('id', S.fam.id));
  await rimuoviFoto(vecchia);
  await caricaFamiglia();
}
async function cambiaMiaFoto(blob) {
  const vecchia = S.me.foto_path;
  const path = await caricaFoto(`${S.fam.id}/${S.me.id}-${Date.now()}.jpg`, blob);
  await q(sb.from('persone').update({ foto_path: path }).eq('id', S.me.id));
  await rimuoviFoto(vecchia);
  await caricaFamiglia();
}

// ================================================================ VISTE
const ICONE = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  famiglia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14.5c.6-.3 1.3-.5 2-.5 2.8 0 4 2 4 4.5"/></svg>',
  regole: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h4"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
  luna: '<svg class="moon" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="54" r="34" fill="#FFC857"/><circle cx="66" cy="44" r="31" fill="#1B2346"/><path d="M20 40q-3-22 16-27q4 16-5 27z" fill="#FF9EB1"/><circle cx="36" cy="11" r="5" fill="#FFF6E5"/></svg>'
};
function luci() {
  const c = ['#FFC857', '#FF6B6B', '#7FD8FF', '#FFF6E5', '#8EE07F'];
  return `<div class="lights" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="background:${c[i % 5]};box-shadow:0 0 8px ${c[i % 5]}"></i>`).join('')}</div>`;
}
function testata(dx) {
  return `<div class="head"><div class="logo">Capodanno <span>in Pigiama</span></div>${dx || ''}</div>`;
}

function render() {
  const attivo = document.activeElement && document.activeElement.id;
  let h = '';
  switch (S.screen) {
    case 'loading': h = `<div class="center"><div class="spinner" role="status" aria-label="Caricamento"></div></div>`; break;
    case 'config': h = vistaConfig(); break;
    case 'login': h = vistaLogin(); break;
    case 'chiuse': h = vistaChiuse(); break;
    case 'wizard': h = vistaWizard(); break;
    case 'main': h = vistaMain(); break;
  }
  if (S.sheet) h += vistaSheet();
  app.innerHTML = h;
  // l'animazione d'ingresso solo quando cambia schermata, non a ogni tocco
  const chiave = S.screen + '|' + S.tab + '|' + (S.wiz ? S.wiz.step : '') + '|' + (S.adm ? S.adm.sez : '');
  if (chiave === render.ultima) app.querySelectorAll('.body.in').forEach(e => e.classList.remove('in'));
  render.ultima = chiave;
  if (sb) aggiornaOmini(false);
  if (attivo) { const el = document.getElementById(attivo); if (el && el.tagName === 'INPUT') { el.focus(); try { const v = el.value; el.value = ''; el.value = v; } catch (e) { /* number */ } } }
}

function vistaConfig() {
  return `${testata()}<div class="center"><h2>App non ancora collegata</h2><p class="mute">Compila <b>config.js</b> con l'indirizzo e la chiave del progetto Supabase.</p></div>`;
}

function vistaLogin() {
  const L = S.login, nuovo = L.step === 'nuovo';
  const corpo = `
    ${PASSKEY_OK && !nuovo ? `<button class="btn full" data-a="passkey" ${L.busy ? 'disabled' : ''}>Entra con Face ID / impronta</button>
      <p class="tiny mute" style="text-align:center">Funziona se l'hai attivato su questo telefono. Altrimenti usa email e PIN.</p>` : ''}
    <div class="seg"><button class="${!nuovo ? 'on' : ''}" data-a="logintab" data-v="accedi">Ho già un account</button><button class="${nuovo ? 'on' : ''}" data-a="logintab" data-v="nuovo">Prima volta</button></div>
    ${nuovo ? '<p class="small mute">Scegli un PIN di 6 cifre facile da ricordare: ti servirà per entrare da un altro telefono.</p>' : ''}
    <div class="field"><label for="email">La tua email</label>
      <input id="email" type="email" autocomplete="username" inputmode="email" value="${esc(L.email)}" placeholder="nome@email.it"></div>
    <div class="field"><label for="pin">${nuovo ? 'Scegli un PIN di 6 cifre' : 'Il tuo PIN'}</label>
      <input id="pin" class="otp" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="${nuovo ? 'new-password' : 'current-password'}" placeholder="••••••"></div>
    ${nuovo ? `<div class="field"><label for="pin2">Ripeti il PIN</label><input id="pin2" class="otp" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" placeholder="••••••"></div>` : ''}
    ${L.err ? `<div class="err" role="alert">${esc(L.err)}</div>` : ''}
    <button class="btn ${PASSKEY_OK && !nuovo ? 'ghost' : ''} full" data-a="entra" ${L.busy ? 'disabled' : ''}>${L.busy ? 'Un attimo…' : nuovo ? 'Crea il mio accesso' : 'Entra'}</button>
    ${!nuovo ? `<p class="tiny mute">PIN dimenticato? Chiedi a ${esc(C.ORGANIZZATORE || 'Salvatore')}: te lo reimposta in un attimo.</p>` : ''}`;
  return `${testata()}<div class="body in">
    <div class="hero">${ICONE.luna}<div class="t">Capodanno<br><span style="color:var(--acc)">in Pigiama!</span></div>
      <p class="mute" style="margin-top:8px">31 dicembre · a casa Caruso</p></div>
    ${luci()}
    <div class="card col">${corpo}</div>
  </div>`;
}

function vistaChiuse() {
  return `${testata()}<div class="center"><h2>Iscrizioni chiuse</h2><p class="mute">Chiedi a ${esc(C.ORGANIZZATORE || 'Salvatore')} di aggiungerti.</p><button class="btn ghost" data-a="esci">Esci</button></div>`;
}

// ---- iscrizione
function vistaWizard() {
  const w = S.wiz, n = 5;
  const dots = `<div class="dots" aria-label="Passo ${w.step + 1} di ${n}">${Array.from({ length: n }, (_, i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let b = '';
  if (w.step === 0) b = `
    <h2>Chi sei</h2>
    <div class="photo-pick">
      <div class="big">${w.fotoPrev ? `<img src="${w.fotoPrev}" alt="La tua foto">` : 'La tua<br>foto'}</div>
      <div class="col grow">
        <button class="btn ghost" data-a="visocam" data-v="wiz">Scatta un selfie</button>
        <label class="btn ghost filebtn">Scegli dalla galleria<input type="file" accept="image/*" data-file="visogal" data-dest="wiz"></label>
      </div>
    </div>
    <div class="field"><label for="w-nome">Nome</label><input id="w-nome" type="text" data-k="nome" autocomplete="given-name" value="${esc(w.nome)}"></div>
    <div class="field"><label for="w-cognome">Cognome</label><input id="w-cognome" type="text" data-k="cognome" autocomplete="family-name" value="${esc(w.cognome)}"></div>
    <div class="field"><label for="w-sopr">Soprannome (facoltativo)</label><input id="w-sopr" type="text" data-k="soprannome" value="${esc(w.soprannome)}" placeholder="es. Zio Pino"><span class="tiny mute">Se c'è, compare al posto del nome nelle votazioni e in classifica.</span></div>
    ${sceltaVoce(w.voce)}
    ${privacyBox(w.privacy)}`;
  if (w.step === 1) {
    if (w.mode === 'unisci' && w.famiglie === null) { w.famiglie = 'loading'; setTimeout(caricaFamiglieDisponibili, 0); }
    b = `<h2>La tua famiglia</h2>
    <div class="seg"><button class="${w.mode === 'crea' ? 'on' : ''}" data-a="wmode" data-v="crea">Crea la famiglia</button><button class="${w.mode === 'unisci' ? 'on' : ''}" data-a="wmode" data-v="unisci">Unisciti</button></div>
    ${w.mode === 'crea' ? `
      <p class="small mute">Sei il primo della tua famiglia a iscriverti? Creala tu: il partner poi si unirà.</p>
      <div class="field"><label for="w-fc">Cognome della famiglia</label><input id="w-fc" type="text" data-k="famCognome" value="${esc(w.famCognome)}"></div>
      <div class="field"><label for="w-fn">Nickname della squadra</label><input id="w-fn" type="text" data-k="famNick" value="${esc(w.famNick)}" placeholder="es. I Ghiri"></div>`
    : `
      <p class="small mute">Il tuo partner ha già creato la famiglia? Sceglila qui.</p>
      ${(w.famiglie === null || w.famiglie === 'loading') ? '<div class="center" style="padding:16px"><div class="spinner"></div></div>'
        : !w.famiglie.length ? '<div class="card small">Nessuna famiglia con posti liberi. Se sei il primo, scegli "Crea la famiglia".</div>'
        : w.famiglie.map(f => `<button class="opt ${w.famId === f.id ? 'on' : ''}" data-a="wfam" data-v="${f.id}"><span class="grow"><b>Famiglia ${esc(f.cognome)} – ${esc(f.nickname)}</b><br><span class="tiny mute">${f.adulti === 0 ? '2 posti liberi' : '1 posto libero'}</span></span></button>`).join('')}`}`;
  }
  if (w.step === 2) {
    const figli = S.members.filter(m => m.tipo === 'bimbo');
    b = `<h2>I tuoi figli</h2>
    <p class="small mute">Aggiungi i tuoi bimbi. Se il partner li ha già inseriti li trovi qui sotto. Niente figli? Vai avanti.</p>
    ${figli.map(k => `<div class="card row"><div class="grow"><b>${esc(k.nome)}</b><div class="tiny mute">${k.eta} anni · ${esc(k.titolo_buffo)}</div></div><button class="chip" data-a="kedit" data-v="${k.id}">Modifica</button></div>`).join('')}
    ${formFiglio('k', w.kNome, w.kEta, w.kTitolo, w.kVisoPrev)}
    <button class="btn ghost full" data-a="kadd" ${w.busy ? 'disabled' : ''}>+ Aggiungi questo bimbo</button>`;
  }
  if (w.step === 3) {
    const url = S.fam.foto_path && S.urls[S.fam.foto_path];
    b = `<h2>Foto di famiglia</h2>
    <p class="small mute">Una foto con tutti i membri della famiglia. Serve anche a riconoscere i bimbi. Puoi cambiarla quando vuoi.</p>
    <div class="famphoto">${url ? `<img src="${esc(url)}" alt="Foto di famiglia">` : 'Nessuna foto'}</div>
    <div class="row"><label class="btn ghost filebtn grow">Scatta<input type="file" accept="image/*" capture="environment" data-file="famfoto"></label><label class="btn ghost filebtn grow">Dalla galleria<input type="file" accept="image/*" data-file="famfoto"></label></div>`;
  }
  if (w.step === 4) {
    const figli = S.members.filter(m => m.tipo === 'bimbo');
    b = `<div class="hero">${ICONE.luna}<h2 style="color:var(--acc)">Iscrizione completata!</h2></div>
    <div class="card row">${avatar(S.me, 56)}<div class="grow"><b>${esc(S.me.nome)} ${esc(S.me.cognome)}</b><div class="small mute">${esc(nomeFamiglia(S.fam))}</div>${figli.length ? `<div class="tiny mute">Con ${figli.map(k => esc(k.nome)).join(', ')}</div>` : ''}</div></div>
    ${cardPasskey(false)}
    ${!isStandalone() ? guidaInstallazione() : ''}`;
  }
  const avanti = { 0: 'Avanti', 1: w.busy ? 'Salvataggio…' : 'Avanti', 2: S.members.some(m => m.tipo === 'bimbo') ? 'Avanti' : 'Non ho figli, avanti', 3: (S.fam && S.fam.foto_path) ? 'Avanti' : 'La carico dopo', 4: 'Vai all\'app' }[w.step];
  return `${testata()}<div class="body in">${dots}${b}
    ${w.err ? `<div class="err" role="alert">${esc(w.err)}</div>` : ''}
    <div class="row">${w.step === 0 ? `<button class="btn ghost" data-a="esci">Esci</button>` : w.step === 1 ? `<button class="btn ghost" data-a="windietro" ${w.busy ? 'disabled' : ''}>Indietro</button>` : ''}<button class="btn grow" data-a="wavanti" ${w.busy ? 'disabled' : ''}>${avanti}</button></div>
  </div>`;
}
function privacyBox(on) {
  return `<div class="card col"><h3>Le tue foto sono al sicuro</h3>${PRIVACY.map(t => `<p class="small mute">${esc(t)}</p>`).join('')}
    <label class="check ${on ? 'on' : ''}"><input type="checkbox" data-a="privacy" ${on ? 'checked' : ''}><span><b>Ho letto e accetto</b></span></label></div>`;
}
function sceltaVoce(v) {
  return `<div class="field"><label>Voce del tuo omino</label><div class="seg"><button class="${v === 'm' ? 'on' : ''}" data-a="voce" data-v="m">Maschile</button><button class="${v === 'f' ? 'on' : ''}" data-a="voce" data-v="f">Femminile</button></div>
    <span class="tiny mute">Nell'app gira un omino in pigiama con la tua faccia: se lo tocchi o lo lanci, urla con questa voce.</span></div>`;
}
function fotoFiglio(pre, prev, url) {
  const img = prev || url;
  return `<div class="photo-pick"><div class="big" style="width:76px;height:76px">${img ? `<img src="${esc(img)}" alt="">` : 'Viso<br>del bimbo'}</div>
    <div class="col grow"><button class="btn ghost" data-a="visocam" data-v="${pre === 's' ? 'sheetkid' : 'wizkid'}">Scatta</button><label class="btn ghost filebtn">Dalla galleria<input type="file" accept="image/*" data-file="visogal" data-dest="${pre === 's' ? 'sheetkid' : 'wizkid'}"></label></div></div>`;
}
function formFiglio(pre, nome, eta, titolo, prev, url) {
  const K = pre === 's' ? { n: 'nome', e: 'eta', t: 'titolo' } : { n: 'kNome', e: 'kEta', t: 'kTitolo' };
  return `<div class="card col">
    ${fotoFiglio(pre, prev, url)}
    <div class="field"><label for="${pre}-nome">Nome del bimbo</label><input id="${pre}-nome" type="text" data-k="${K.n}" value="${esc(nome)}"></div>
    <div class="field"><label for="${pre}-eta">Età (anni)</label><input id="${pre}-eta" type="number" inputmode="numeric" min="0" max="17" data-k="${K.e}" value="${esc(eta)}"></div>
    <div class="field"><label for="${pre}-tit">Titolo buffo</label><input id="${pre}-tit" type="text" data-k="${K.t}" value="${esc(titolo)}" placeholder="es. Re dei Ghiri"></div>
    <div class="chips">${TITOLI.map(t => `<button class="chip ${titolo === t ? 'on' : ''}" data-a="titolo" data-p="${pre}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
  </div>`;
}
function guidaInstallazione() {
  return `<div class="card col"><h3>Metti l'app sul telefono</h3>
    ${isIOS()
      ? `<p class="small">1. Tocca <b>Condividi</b> (il quadrato con la freccia) in basso in Safari.<br>2. Scegli <b>Aggiungi alla schermata Home</b>.<br>3. Apri l'app dall'icona con la luna.</p>`
      : `<p class="small">1. Apri il menu del browser (i tre puntini).<br>2. Scegli <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.<br>3. Apri l'app dall'icona con la luna.</p>`}
  </div>`;
}

// ---- app principale
function vistaMain() {
  let corpo = '';
  if (S.tab === 'home') corpo = vistaHome();
  if (S.tab === 'famiglia') corpo = vistaFamiglia();
  if (S.tab === 'regole') corpo = vistaRegole();
  if (S.tab === 'admin') corpo = vistaAdmin();
  const voci = [['home', 'Home'], ['famiglia', 'La mia famiglia'], ['regole', 'Regole']];
  if (S.me.is_admin) voci.push(['admin', 'Regia']);
  const nav = voci
    .map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}" aria-current="${S.tab === k ? 'page' : 'false'}">${ICONE[k]}${l}</button>`).join('');
  return `${testata(`<button data-a="tab" data-v="famiglia" style="background:none;border:0;padding:0" aria-label="La mia famiglia">${avatar(S.me, 38)}</button>`)}
    <div class="body in">${corpo}</div><nav class="nav">${nav}</nav>`;
}
function cardPasskey(compatta) {
  if (!PASSKEY_OK) return '';
  if (S.passkey) return compatta ? '' : `<div class="card row"><span class="grow"><b>Face ID / impronta attivo</b><div class="tiny mute">Su un altro telefono puoi entrare anche con email e PIN.</div></span><button class="chip" data-a="attivapasskey">Aggiungi questo telefono</button></div>`;
  if (compatta && passkeyRifiutata()) return '';
  return `<div class="card col"><h3>Entra con Face ID o impronta</h3><p class="small mute">Attivalo ora: la prossima volta entri senza scrivere email e PIN.</p>
    <button class="btn full" data-a="attivapasskey">Attiva Face ID / impronta</button>${compatta ? '<button class="btn ghost full" data-a="nopasskey">Non ora</button>' : ''}</div>`;
}
function promemoria() {
  const r = [];
  if (!S.me.foto_path) r.push(['Carica la tua foto', 'famiglia']);
  if (!S.fam.foto_path) r.push(['Carica la foto di famiglia', 'famiglia']);
  if (S.members.filter(m => m.tipo === 'adulto').length < 2) r.push(['Il partner non si è ancora iscritto: mandagli il link', null]);
  return r;
}
function vistaHome() {
  const fase = S.serata ? S.serata.fase : 'iscrizioni';
  if (fase !== 'iscrizioni') return vistaSerata();
  {
    const ms = new Date(C.DATA_FESTA || '2026-12-31T20:00:00+01:00') - new Date();
    const giorni = Math.floor(ms / 864e5), ore = Math.floor(ms % 864e5 / 36e5);
    const r = promemoria();
    return `<div class="card" style="text-align:center">
        ${ms > 0 ? `<div class="tiny mute" style="font-weight:800;letter-spacing:.08em">MANCANO</div>
        <div class="big-num">${giorni > 0 ? giorni : ore}</div><div class="f" style="font-size:20px">${giorni > 0 ? (giorni === 1 ? 'giorno' : 'giorni') : (ore === 1 ? 'ora' : 'ore')} al Capodanno in Pigiama!</div>`
        : `<div class="f" style="font-size:30px;color:var(--acc)">Ci siamo!</div><p class="mute">Benvenuti alla festa: tra poco si parte.</p>`}
        ${luci()}
      </div>
      <div class="card"><h3>Ciao ${esc(nomeVisto(S.me))}!</h3><p class="small mute">Fai parte della ${esc(nomeFamiglia(S.fam))}.</p></div>
      ${cardPasskey(true)}
      ${r.length ? `<div class="card"><h3>Promemoria</h3>${r.map(([t, tab]) => `<div class="reminder">• <span class="grow">${esc(t)}</span>${tab ? `<button class="chip" data-a="tab" data-v="${tab}">Vai</button>` : ''}</div>`).join('')}</div>` : ''}
      ${!isStandalone() ? guidaInstallazione() : ''}
      <div class="card"><h3>Cosa succede la sera</h3><p class="small mute">Pronostici, votazioni dei pigiami, pegni per chi arriva vestito, premiazione dei bimbi e classifiche finali. Tutto da qui, dal tuo telefono.</p></div>`;
  }
}
function vistaFamiglia() {
  const url = S.fam.foto_path && S.urls[S.fam.foto_path];
  const aperte = S.serata && S.serata.iscrizioni_aperte;
  const adulti = S.members.filter(m => m.tipo === 'adulto'), figli = S.members.filter(m => m.tipo === 'bimbo');
  return `<div class="card col">
      <div class="famphoto">${url ? `<img src="${esc(url)}" alt="Foto di famiglia">` : 'Nessuna foto di famiglia'}</div>
      <div class="row"><label class="btn ghost filebtn grow">${url ? 'Cambia foto' : 'Carica foto'}<input type="file" accept="image/*" data-file="famfoto"></label></div>
      <div class="row"><div class="grow"><div class="f" style="font-size:22px">${esc(nomeFamiglia(S.fam))}</div></div><button class="chip" data-a="famedit">Modifica</button></div>
    </div>
    <div class="card"><h3>Adulti</h3>${adulti.map(p => `<div class="member">${avatar(p)}<div class="grow"><b>${esc(p.nome)} ${esc(p.cognome || '')}</b>${p.soprannome ? `<div class="tiny mute">detto ${esc(p.soprannome)}</div>` : ''}</div>${p.id === S.me.id ? `<button class="chip" data-a="meedit">Modifica</button>` : '<span class="tag">Partner</span>'}</div>`).join('')}
      ${adulti.length < 2 ? `<p class="tiny mute" style="margin-top:8px">Il partner si iscrive dal suo telefono e sceglie "Unisciti".</p>` : ''}</div>
    <div class="card"><h3>Bimbi</h3>${figli.length ? figli.map(k => `<div class="member">${avatar(k)}<div class="grow"><b>${esc(k.nome)}</b><div class="tiny mute">${k.eta} anni · ${esc(k.titolo_buffo)}</div></div>${aperte ? `<button class="chip" data-a="kedit" data-v="${k.id}">Modifica</button>` : ''}</div>`).join('') : '<p class="small mute">Nessun bimbo.</p>'}
      ${aperte ? `<button class="btn ghost full" style="margin-top:10px" data-a="knew">+ Aggiungi un figlio</button>` : `<p class="tiny mute" style="margin-top:8px">Iscrizioni chiuse: per modifiche chiedi a ${esc(C.ORGANIZZATORE || 'Salvatore')}.</p>`}</div>
    ${cardPasskey(false)}
    <button class="btn ghost full" data-a="esci">Esci dall'account</button>`;
}
function vistaRegole() {
  const premi = S.categorie.length ? S.categorie.map(c => esc(c.nome)).join(' · ') : '';
  return `<div class="card"><h3>Dress code</h3><p class="small">Pigiama obbligatorio per tutti, grandi e piccini. Ciabatte consigliate! Chi arriva vestito paga 2 pegni, estratti con la ruota.</p></div>
    <div class="card"><h3>Premi</h3><p class="small">${premi}${premi ? ' · ' : ''}Miglior famiglia · Diploma per ogni bimbo</p></div>
    <div class="card"><h3>Pronostici e jolly</h3><p class="small">Prima delle votazioni indovini chi vince ogni premio: +5 punti per pronostico giusto. Col jolly "Vinco io!" punti su te stesso in una categoria: +10 se vinci, −5 se perdi.</p></div>
    <div class="card"><h3>Come si vota</h3><p class="small">Pagelle: da 1 a 5 stelle ai pigiami delle altre famiglie, bimbi compresi. Premi: un adulto per premio, anche della tua famiglia, ma mai te stesso e mai la stessa persona per due premi. Puoi votare un po' alla volta e confermare quando vuoi.</p></div>
    <div class="card"><h3>Classifiche</h3><p class="small">Adulti: stelle ricevute + pronostici + jolly. Famiglie: media delle stelle di tutti i membri.</p></div>
    <div class="card col"><h3>Le tue foto sono al sicuro</h3>${PRIVACY.map(t => `<p class="small mute">${esc(t)}</p>`).join('')}</div>`;
}

// ---- finestre
function vistaSheet() {
  const s = S.sheet;
  let b = '';
  if (s.tipo === 'figlio') b = `<h2>${s.id ? 'Modifica bimbo' : 'Nuovo bimbo'}</h2>${formFiglio('s', s.nome, s.eta, s.titolo, s.visoPrev, s.visoUrl)}
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="ssalvafiglio" ${s.busy ? 'disabled' : ''}>Salva</button>
    ${s.id ? `<button class="btn danger full" data-a="seliminafiglio" ${s.busy ? 'disabled' : ''}>${s.conferma ? 'Tocca di nuovo per eliminare' : 'Elimina'}</button>` : ''}`;
  if (s.tipo === 'me') b = `<h2>Il tuo profilo</h2>
    <div class="photo-pick"><div class="big">${s.fotoPrev ? `<img src="${s.fotoPrev}" alt="">` : (S.me.foto_path && S.urls[S.me.foto_path] ? `<img src="${esc(S.urls[S.me.foto_path])}" alt="">` : 'Foto')}</div>
      <div class="col grow"><button class="btn ghost" data-a="visocam" data-v="me">Scatta un selfie</button><label class="btn ghost filebtn">Dalla galleria<input type="file" accept="image/*" data-file="visogal" data-dest="me"></label></div></div>
    ${sceltaVoce(s.voce)}
    <div class="field"><label for="s-nome">Nome</label><input id="s-nome" type="text" data-k="nome" value="${esc(s.nome)}"></div>
    <div class="field"><label for="s-cognome">Cognome</label><input id="s-cognome" type="text" data-k="cognome" value="${esc(s.cognome)}"></div>
    <div class="field"><label for="s-sopr">Soprannome (facoltativo)</label><input id="s-sopr" type="text" data-k="soprannome" value="${esc(s.soprannome)}"></div>
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="ssalvame" ${s.busy ? 'disabled' : ''}>Salva</button>`;
  if (s.tipo.startsWith('ad')) b = sheetAdmin(s);
  if (s.tipo === 'fam') b = `<h2>La tua famiglia</h2>
    <div class="field"><label for="s-fc">Cognome della famiglia</label><input id="s-fc" type="text" data-k="cognome" value="${esc(s.cognome)}"></div>
    <div class="field"><label for="s-fn">Nickname della squadra</label><input id="s-fn" type="text" data-k="nickname" value="${esc(s.nickname)}"></div>
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="ssalvafam" ${s.busy ? 'disabled' : ''}>Salva</button>`;
  return `<div class="overlay" data-a="chiudisheet"><div class="sheet in" role="dialog" aria-modal="true">${b}<button class="btn ghost full" data-a="chiudisheet">Annulla</button></div></div>`;
}

// ================================================================ SERATA: PRONOSTICI, VOTI, SPAREGGIO, CLASSIFICHE
S.g = { tutti: [], famiglie: [], pron: {}, pronFam: null, jolly: null, pag: {}, vp: {}, vtab: 'pagelle', sp: null, spVoto: null, ris: null, tick: null };
const FASI_SERATA = ['attesa', 'pronostici', 'votazioni', 'votazioni_chiuse', 'premiazione', 'fine'];
const pers = id => S.g.tutti.find(p => p.id === id) || {};
const fam = id => S.g.famiglie.find(f => f.id === id) || null;
const inGara = () => S.g.tutti.filter(p => p.tipo === 'adulto' && p.presente && !p.senza_pigiama);

async function caricaFase() {
  const f = S.serata && S.serata.fase;
  if (!FASI_SERATA.includes(f)) return;
  const [tutti, famiglie] = await Promise.all([
    q(sb.from('persone').select('*').order('creata_il')),
    q(sb.from('famiglie').select('*').order('cognome'))
  ]);
  S.g.tutti = tutti; S.g.famiglie = famiglie;
  const io = tutti.find(p => p.id === S.me.id); if (io) S.me = io;
  await preparaUrl([...tutti.map(p => p.foto_path), ...tutti.map(p => p.viso_path), ...famiglie.map(x => x.foto_path)]);
  if (f === 'pronostici') await caricaPronostici();
  if (f === 'votazioni' || f === 'votazioni_chiuse') await caricaVoti();
  if (f === 'fine') { try { S.g.ris = await q(sb.rpc('risultati')); } catch (e) { S.g.ris = null; } }
  await caricaSpareggio();
}
async function caricaPronostici() {
  const me = S.me.id;
  const [pr, pf, jo] = await Promise.all([
    q(sb.from('pronostici').select('*').eq('votante_id', me)),
    q(sb.from('pronostici_famiglia').select('*').eq('votante_id', me)),
    q(sb.from('jolly').select('*').eq('votante_id', me))
  ]);
  S.g.pron = {}; pr.forEach(x => { S.g.pron[x.categoria_id] = x.persona_id; });
  S.g.pronFam = pf[0] ? pf[0].famiglia_id : null;
  S.g.jolly = jo[0] ? jo[0].categoria_id : null;
}
async function caricaVoti() {
  const me = S.me.id;
  const [pg, vp] = await Promise.all([
    q(sb.from('pagelle').select('*').eq('votante_id', me)),
    q(sb.from('voti_premi').select('*').eq('votante_id', me))
  ]);
  S.g.pag = {}; pg.forEach(x => { S.g.pag[x.persona_id] = { s: x.stelle, conf: x.confermato }; });
  S.g.vp = {}; vp.forEach(x => { S.g.vp[x.categoria_id] = { pid: x.persona_id, conf: x.confermato }; });
}
async function caricaSpareggio() {
  const id = S.serata && S.serata.spareggio_id;
  if (!id) { S.g.sp = null; S.g.spVoto = null; fermaTick(); return; }
  S.g.sp = await q(sb.from('spareggi').select('*').eq('id', id).single());
  const v = await q(sb.from('voti_spareggio').select('*').eq('spareggio_id', id).eq('votante_id', S.me.id));
  S.g.spVoto = v[0] ? v[0].persona_id : null;
  avviaTick();
}
function avviaTick() { if (!S.g.tick) S.g.tick = setInterval(() => { if (S.g.sp && S.screen === 'main' && !S.sheet) render(); }, 1000); }
function fermaTick() { if (S.g.tick) { clearInterval(S.g.tick); S.g.tick = null; } }

// --- salvataggi (aggiornamento immediato sullo schermo, poi sul server)
async function salva(fn, annulla) {
  try { await fn(); } catch (e) { if (annulla) annulla(); toast(erroreLeggibile(e)); render(); }
}
async function scegliPronostico(cat, pid) {
  if (S.g.jolly === cat) return;
  const prima = S.g.pron[cat]; S.g.pron[cat] = pid; render();
  await salva(() => q(sb.from('pronostici').upsert({ votante_id: S.me.id, categoria_id: cat, persona_id: pid }, { onConflict: 'votante_id,categoria_id' })),
    () => { S.g.pron[cat] = prima; });
}
async function scegliFamiglia(fid) {
  const prima = S.g.pronFam; S.g.pronFam = fid; render();
  await salva(() => q(sb.from('pronostici_famiglia').upsert({ votante_id: S.me.id, famiglia_id: fid }, { onConflict: 'votante_id' })),
    () => { S.g.pronFam = prima; });
}
async function cambiaJolly(cat) {
  const prima = { jolly: S.g.jolly, pron: { ...S.g.pron } };
  if (S.g.jolly === cat) {
    S.g.jolly = null; delete S.g.pron[cat]; render();
    await salva(async () => {
      await q(sb.from('jolly').delete().eq('votante_id', S.me.id));
      await q(sb.from('pronostici').delete().eq('votante_id', S.me.id).eq('categoria_id', cat));
    }, () => { S.g.jolly = prima.jolly; S.g.pron = prima.pron; });
    return;
  }
  const vecchia = S.g.jolly;
  S.g.jolly = cat; S.g.pron[cat] = S.me.id;
  if (vecchia) delete S.g.pron[vecchia];
  render();
  await salva(async () => {
    if (vecchia) await q(sb.from('pronostici').delete().eq('votante_id', S.me.id).eq('categoria_id', vecchia));
    await q(sb.from('jolly').upsert({ votante_id: S.me.id, categoria_id: cat }, { onConflict: 'votante_id' }));
    await q(sb.from('pronostici').upsert({ votante_id: S.me.id, categoria_id: cat, persona_id: S.me.id }, { onConflict: 'votante_id,categoria_id' }));
  }, () => { S.g.jolly = prima.jolly; S.g.pron = prima.pron; });
  toast('Jolly giocato: in bocca al lupo!');
}
async function daiStelle(pid, n) {
  const prima = S.g.pag[pid];
  if (prima && prima.conf) return;
  if (prima && prima.s === n) {
    delete S.g.pag[pid]; render();
    await salva(() => q(sb.from('pagelle').delete().eq('votante_id', S.me.id).eq('persona_id', pid)), () => { S.g.pag[pid] = prima; });
    return;
  }
  S.g.pag[pid] = { s: n, conf: false }; render();
  await salva(() => q(sb.from('pagelle').upsert({ votante_id: S.me.id, persona_id: pid, stelle: n }, { onConflict: 'votante_id,persona_id' })),
    () => { if (prima) S.g.pag[pid] = prima; else delete S.g.pag[pid]; });
}
async function votaPremio(cat, pid) {
  const prima = S.g.vp[cat];
  if (prima && prima.conf) return;
  if (prima && prima.pid === pid) {
    delete S.g.vp[cat]; render();
    await salva(() => q(sb.from('voti_premi').delete().eq('votante_id', S.me.id).eq('categoria_id', cat)), () => { S.g.vp[cat] = prima; });
    return;
  }
  S.g.vp[cat] = { pid, conf: false }; render();
  await salva(() => q(sb.from('voti_premi').upsert({ votante_id: S.me.id, categoria_id: cat, persona_id: pid }, { onConflict: 'votante_id,categoria_id' })),
    () => { if (prima) S.g.vp[cat] = prima; else delete S.g.vp[cat]; });
}
async function confermaVoti() {
  await q(sb.rpc('conferma_voti'));
  await caricaVoti();
  toast('Voti confermati!');
}
async function votaSpareggio(pid) {
  const sp = S.g.sp;
  if (!sp || S.g.spVoto) return;
  S.g.spVoto = pid; render();
  await salva(() => q(sb.from('voti_spareggio').insert({ spareggio_id: sp.id, votante_id: S.me.id, persona_id: pid })), () => { S.g.spVoto = null; });
}

// --- viste
function avatarGara(p, size) {
  if (p.tipo === 'bimbo' && !p.foto_path) {
    const f = fam(p.famiglia_id), url = f && f.foto_path && S.urls[f.foto_path];
    if (url) return `<span class="av" style="width:${size || 44}px;height:${size || 44}px"><img src="${esc(url)}" alt=""></span>`;
  }
  return avatar(p, size);
}
function chipPersona(p, on, attr, disabled, nota) {
  return `<button class="pchip ${on ? 'on' : ''}" ${attr} ${disabled ? 'disabled' : ''} aria-pressed="${on}">${avatarGara(p, 34)}<span>${esc(nomeVisto(p))}${nota ? `<small>${esc(nota)}</small>` : ''}</span></button>`;
}
function vistaSerata() {
  const f = S.serata.fase;
  if (S.g.sp) return vistaSpareggio();
  if (f === 'attesa') return `<div class="card" style="text-align:center;padding:24px">${ICONE.luna}<div class="f" style="font-size:28px">Benvenuti!</div><p class="mute">Tra poco si aprono i pronostici.</p>${luci()}</div>
    ${S.g.famiglie.map(x => `<div class="card row">${(() => { const u = x.foto_path && S.urls[x.foto_path]; return u ? `<span class="av" style="width:56px;height:56px;border-radius:14px"><img src="${esc(u)}" alt=""></span>` : ''; })()}<div class="grow"><b>${esc(nomeFamiglia(x))}</b><div class="tiny mute">${S.g.tutti.filter(p => p.famiglia_id === x.id).map(p => esc(nomeVisto(p))).join(', ')}</div></div></div>`).join('')}`;
  if (!S.me.presente && f !== 'fine') return `<div class="card" style="text-align:center;padding:24px"><h3>Non risulti ancora arrivato</h3><p class="small mute">Chiedi a ${esc(C.ORGANIZZATORE || 'Salvatore')} di segnarti presente.</p></div>`;
  if (f === 'pronostici') return vistaPronostici();
  if (f === 'votazioni') return vistaVotazioni();
  if (f === 'votazioni_chiuse') return `<div class="card" style="text-align:center;padding:30px"><div class="f" style="font-size:26px">Votazioni chiuse</div><p class="mute">I risultati sono segreti fino alla premiazione.</p></div>`;
  if (f === 'premiazione') return `<div class="card" style="text-align:center;padding:44px 18px">${ICONE.luna}<div class="f" style="font-size:36px;color:var(--acc)">Occhi sulla TV!</div><p class="mute">La premiazione è iniziata.</p>${luci()}</div>`;
  if (f === 'fine') return vistaFine();
  return '';
}
function vistaPronostici() {
  const g = inGara(), j = S.g.jolly, cats = S.categorie;
  const fatti = cats.filter(c => S.g.pron[c.id]).length + (S.g.pronFam ? 1 : 0);
  return `<div><div class="f" style="font-size:28px">Chi vince?</div><p class="small mute">Pronostico giusto <b>+${S.serata.punti_pronostico}</b>. Jolly "Vinco io!" su una sola categoria: <b>+${S.serata.punti_jolly_vinto}</b> se vinci, <b>${S.serata.punti_jolly_perso}</b> se perdi.</p></div>
    <div class="card row"><span class="grow small">Fatti <b>${fatti} / ${cats.length + 1}</b></span>${fatti === cats.length + 1 ? '<span class="tag" style="background:var(--ok);color:#0F3320">Completo</span>' : ''}</div>
    ${cats.map(c => {
      const mio = j === c.id;
      return `<div class="card"><div class="row" style="margin-bottom:10px"><b class="grow">${esc(c.nome)}</b>
        ${!S.me.senza_pigiama ? `<button class="chip ${mio ? 'on' : ''}" data-a="gjolly" data-v="${c.id}" ${j && !mio ? 'disabled style="opacity:.35"' : ''}>${mio ? 'Jolly giocato' : 'Vinco io!'}</button>` : ''}</div>
        ${mio ? `<p class="tiny mute" style="margin-bottom:8px">Hai puntato su te stesso. Tocca "Jolly giocato" per annullare.</p>` : ''}
        <div class="pchips">${g.map(p => chipPersona(p, S.g.pron[c.id] === p.id, `data-a="gpron" data-c="${c.id}" data-v="${p.id}"`, mio && p.id !== S.me.id)).join('')}</div></div>`;
    }).join('')}
    <div class="card"><b>Premio famiglia</b><div class="pchips" style="margin-top:10px">${S.g.famiglie.filter(x => S.g.tutti.some(p => p.famiglia_id === x.id && p.presente)).map(x => `<button class="pchip ${S.g.pronFam === x.id ? 'on' : ''}" data-a="gpronfam" data-v="${x.id}" style="padding-left:14px"><span>${esc(x.nickname)}<small>Famiglia ${esc(x.cognome)}</small></span></button>`).join('')}</div></div>
    <p class="tiny mute">Ogni scelta si salva da sola. Puoi cambiare idea finché ${esc(C.ORGANIZZATORE || 'l\'organizzatore')} non chiude i pronostici.</p>`;
}
function vistaVotazioni() {
  const pag = S.g.pag, vp = S.g.vp, cats = S.categorie;
  const npag = Object.keys(pag).length, nvp = Object.keys(vp).length;
  const daConf = Object.values(pag).filter(x => !x.conf).length + Object.values(vp).filter(x => !x.conf).length;
  const tuttiConf = nvp === cats.length && !daConf;
  let corpo = '';
  if (S.g.vtab === 'pagelle') {
    const altre = S.g.famiglie.filter(x => x.id !== S.me.famiglia_id);
    corpo = `<p class="tiny mute">Da 1 a 5 stelle ai pigiami delle altre famiglie, bimbi compresi. Non serve votarli tutti. Tocca di nuovo la stessa stella per togliere il voto.</p>
    ${altre.map(x => {
      const m = S.g.tutti.filter(p => p.famiglia_id === x.id && p.presente && !p.senza_pigiama);
      if (!m.length) return '';
      return `<div class="card"><b>${esc(nomeFamiglia(x))}</b>${m.map(p => {
        const v = pag[p.id];
        return `<div class="member" style="flex-wrap:wrap">${avatarGara(p, 46)}<div class="grow"><b>${esc(nomeVisto(p))}</b><div class="tiny mute">${p.tipo === 'bimbo' ? esc(p.titolo_buffo) : 'Adulto'}</div></div>${v && v.conf ? '<span class="tag">Confermato</span>' : ''}
          <div class="stars" style="flex-basis:100%">${[1, 2, 3, 4, 5].map(n => `<button class="star ${v && v.s >= n ? 'on' : ''}" data-a="gstella" data-p="${p.id}" data-v="${n}" ${v && v.conf ? 'disabled' : ''} aria-label="${n} stelle a ${esc(nomeVisto(p))}">★</button>`).join('')}</div></div>`;
      }).join('')}</div>`;
    }).join('')}`;
  } else {
    const g = inGara().filter(p => p.id !== S.me.id);
    corpo = `<p class="tiny mute">Un adulto per premio, anche della tua famiglia. Mai te stesso, mai la stessa persona per due premi.</p>
    ${cats.map(c => {
      const v = vp[c.id];
      return `<div class="card"><div class="row" style="margin-bottom:10px"><b class="grow">${esc(c.nome)}</b>${v && v.conf ? '<span class="tag">Confermato</span>' : ''}</div>
        <div class="pchips">${g.map(p => {
          const altrove = Object.entries(vp).find(([k, x]) => +k !== c.id && x.pid === p.id);
          const nota = altrove ? 'già votato per ' + ((cats.find(k => k.id === +altrove[0]) || {}).nome || '') : '';
          return chipPersona(p, !!(v && v.pid === p.id), `data-a="gvp" data-c="${c.id}" data-v="${p.id}"`, !!altrove || (v && v.conf), nota);
        }).join('')}</div></div>`;
    }).join('')}`;
  }
  return `<div class="seg"><button class="${S.g.vtab === 'pagelle' ? 'on' : ''}" data-a="gvtab" data-v="pagelle">Pagelle · ${npag}</button><button class="${S.g.vtab === 'premi' ? 'on' : ''}" data-a="gvtab" data-v="premi">Premi · ${nvp}/${cats.length}</button></div>
    ${corpo}
    <div class="card col" style="position:sticky;bottom:64px;background:var(--bg2)">
      ${tuttiConf ? `<div class="row"><span class="grow"><b>Tutti i voti sono confermati</b><div class="tiny mute">Puoi ancora aggiungere pagelle, se vuoi.</div></span></div>`
        : `<div class="small">${daConf ? `<b>${daConf}</b> ${daConf === 1 ? 'voto da confermare' : 'voti da confermare'}` : 'Nessun voto nuovo da confermare'}${nvp < cats.length ? ` · mancano <b>${cats.length - nvp}</b> premi` : ''}</div>`}
      <button class="btn full" data-a="gconferma" ${daConf ? '' : 'disabled'}>Conferma voto</button>
      <p class="tiny mute">Dopo la conferma quei voti non si possono più cambiare. Il resto puoi completarlo dopo.</p>
    </div>`;
}
function vistaSpareggio() {
  const sp = S.g.sp, cat = S.categorie.find(c => c.id === sp.categoria_id) || {};
  const resta = Math.max(0, Math.ceil((new Date(sp.fine) - new Date()) / 1000));
  const chiuso = resta === 0 || sp.vincitore_id;
  return `<div class="card" style="text-align:center;border-color:var(--pink)"><div class="f" style="font-size:30px;color:var(--pink)">Pareggio!</div><p class="small mute">${esc(cat.nome || '')}</p>
      <div class="big-num" style="${resta <= 5 ? 'color:var(--bad)' : ''}">${chiuso ? '–' : resta}</div><p class="tiny mute">${chiuso ? 'Spareggio chiuso: guarda la TV!' : 'secondi per votare'}</p></div>
    ${S.me.tipo !== 'adulto' || !S.me.presente ? '<p class="mute">Solo gli adulti presenti votano.</p>'
      : S.g.spVoto ? `<div class="card" style="text-align:center"><b>Hai votato ${esc(nomeVisto(pers(S.g.spVoto)))}</b><p class="tiny mute">Aspetta il risultato sulla TV.</p></div>`
      : `<div class="col">${sp.candidati.map(id => { const p = pers(id); const io = id === S.me.id; return `<button class="opt" data-a="gsp" data-v="${id}" ${chiuso || io ? 'disabled style="opacity:.4"' : ''}>${avatar(p, 56)}<span class="grow"><b style="font-size:18px">${esc(nomeVisto(p))}</b>${io ? '<br><span class="tiny mute">Non puoi votare te stesso</span>' : ''}</span></button>`; }).join('')}</div>`}`;
}
function vistaFine() {
  const R = S.g.ris;
  if (!R) return `<div class="card">Classifiche non disponibili. <button class="chip" data-a="gaggiorna">Riprova</button></div>`;
  const segno = x => x == null ? '–' : (x > 0 ? '+' : '') + x;
  const io = R.adulti.find(a => a.persona_id === S.me.id);
  const pos = R.adulti.findIndex(a => a.persona_id === S.me.id) + 1;
  return `${io ? `<div class="card"><h3>I tuoi punti · ${pos}° posto</h3><div class="row" style="justify-content:space-between;text-align:center">${[['Pigiama', io.pigiama], ['Pronostico', segno(io.pronostico)], ['Jolly', segno(io.jolly)], ['Totale', io.totale]].map(([l, v]) => `<div><div class="f" style="font-size:26px;color:var(--acc)">${v}</div><div class="tiny mute">${l}</div></div>`).join('')}</div></div>` : ''}
    <div class="card"><h3>Vincitori</h3>${R.premi.map(c => { const p = c.vincitore_id ? pers(c.vincitore_id) : null; return `<div class="member">${p ? avatar(p, 40) : ''}<div class="grow"><div class="tiny mute">${esc(c.nome)}</div><b>${p ? esc(nomeVisto(p)) + ' ' + esc(p.cognome || '') : 'Nessun vincitore'}</b></div></div>`; }).join('')}
      ${R.famiglia_vincitrice ? `<div class="member"><div class="grow"><div class="tiny mute">Miglior famiglia</div><b>${esc(nomeFamiglia(fam(R.famiglia_vincitrice)))}</b></div></div>` : ''}</div>
    <div class="card" style="overflow-x:auto"><h3>Classifica adulti</h3><table class="tab"><tr><th>#</th><th>Nome</th><th class="n">Pig.</th><th class="n">Pron.</th><th class="n">Jolly</th><th class="n">Tot.</th></tr>
      ${R.adulti.map((a, i) => `<tr style="${a.persona_id === S.me.id ? 'color:var(--acc)' : ''}"><td>${i + 1}</td><td>${esc(nomeVisto(pers(a.persona_id)))}</td><td class="n">${a.pigiama}</td><td class="n">${segno(a.pronostico)}</td><td class="n">${segno(a.jolly)}</td><td class="n"><b>${a.totale}</b></td></tr>`).join('')}</table></div>
    <div class="card"><h3>Classifica famiglie</h3><table class="tab"><tr><th>#</th><th>Famiglia</th><th class="n">Media</th></tr>
      ${R.famiglie.map((x, i) => `<tr style="${x.famiglia_id === S.me.famiglia_id ? 'color:var(--acc)' : ''}"><td>${i + 1}</td><td>${esc((fam(x.famiglia_id) || {}).nickname || '')}</td><td class="n">${Number(x.media).toFixed(2).replace('.', ',')}</td></tr>`).join('')}</table></div>`;
}

async function azioneSerata(a, v, el) {
  switch (a) {
    case 'gpron': await scegliPronostico(+el.dataset.c, v); return true;
    case 'gpronfam': await scegliFamiglia(v); return true;
    case 'gjolly': await cambiaJolly(+v); return true;
    case 'gstella': await daiStelle(el.dataset.p, +v); return true;
    case 'gvp': await votaPremio(+el.dataset.c, v); return true;
    case 'gvtab': S.g.vtab = v; window.scrollTo(0, 0); return true;
    case 'gconferma': await confermaVoti(); return true;
    case 'gsp': await votaSpareggio(v); return true;
    case 'gaggiorna': await caricaFase(); return true;
  }
  return false;
}

// ================================================================ ORGANIZZATORE
const FASI_ORDINE = ['iscrizioni', 'attesa', 'pronostici', 'votazioni', 'votazioni_chiuse', 'premiazione', 'fine'];
const FASI_SPIEGA = {
  iscrizioni: 'Gli amici si iscrivono dal link. Nessun voto possibile.',
  attesa: 'La sera della festa: segna arrivi e pigiami. Ti consiglio di chiudere anche le iscrizioni.',
  pronostici: 'Sui telefoni si apre "Chi vince?" con pronostici e jolly.',
  votazioni: 'I pronostici si chiudono e si aprono pagelle e premi.',
  votazioni_chiuse: 'Nessuno può più votare. I risultati restano segreti.',
  premiazione: 'Si sbloccano i risultati e parte la premiazione sulla TV.',
  fine: 'Le classifiche diventano visibili sui telefoni di tutti.'
};
const SUPPORTI = { timer60: 'timer 1 min', timer30: 'timer 30 s', pregi: 'conta pregi', karaoke: 'karaoke', mimo: 'carte film', canzone: 'carte canzoni' };
S.adm = { sez: 'arrivi', famiglie: [], persone: [], avz: null, pegni: [], carte: [], brani: [], cat: [], caricato: false, poll: null };

async function caricaAdmin() {
  const A = S.adm;
  const [famiglie, persone, pegni, carte, brani, cat, serata] = await Promise.all([
    q(sb.from('famiglie').select('*').order('cognome')),
    q(sb.from('persone').select('*').order('creata_il')),
    q(sb.from('pegni').select('*').order('id')),
    q(sb.from('carte').select('*').order('id')),
    q(sb.from('brani_karaoke').select('*').order('ordine')),
    q(sb.from('categorie').select('*').order('ordine')),
    q(sb.from('serata').select('*').eq('id', 1).single())
  ]);
  Object.assign(A, { famiglie, persone, pegni, carte, brani, cat, caricato: true });
  S.serata = serata;
  await Promise.all([aggiornaAvanzamento(false), preparaUrl([...famiglie.map(f => f.foto_path), ...persone.map(p => p.foto_path)])]);
}
async function aggiornaAvanzamento(ridisegna) {
  try { S.adm.avz = await q(sb.rpc('avanzamento')); } catch (e) { console.warn(e); }
  if (ridisegna && S.tab === 'admin' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) render();
}
function avviaPolling() {
  if (S.adm.poll) return;
  S.adm.poll = setInterval(() => {
    if (S.tab === 'admin' && document.visibilityState === 'visible') aggiornaAvanzamento(true);
  }, 5000);
}
const membriDi = famId => S.adm.persone.filter(p => p.famiglia_id === famId).sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'adulto' ? -1 : 1));
const famDi = id => S.adm.famiglie.find(f => f.id === id);
const personaDi = id => S.adm.persone.find(p => p.id === id);

function vistaAdmin() {
  const A = S.adm;
  if (!A.caricato) return `<div class="center"><div class="spinner"></div></div>`;
  const sez = [['arrivi', 'Arrivi'], ['fasi', 'Fasi'], ['show', 'Show'], ['iscritti', 'Iscritti'], ['impost', 'Impost.']]
    .map(([k, l]) => `<button class="${A.sez === k ? 'on' : ''}" data-a="adsez" data-v="${k}">${l}</button>`).join('');
  let b = '';
  if (A.sez === 'arrivi') b = adminArrivi();
  if (A.sez === 'fasi') b = adminFasi();
  if (A.sez === 'iscritti') b = adminIscritti();
  if (A.sez === 'impost') b = adminImpostazioni();
  if (A.sez === 'show') b = vistaShow();
  return `<div class="seg">${sez}</div>${b}`;
}
function contatori() {
  const P = S.adm.persone;
  const pres = P.filter(p => p.presente).length, senza = P.filter(p => p.presente && p.senza_pigiama).length;
  return `<div class="card row" style="justify-content:space-around;text-align:center">
    <div><div class="f" style="font-size:28px;color:var(--acc)">${pres}/${P.length}</div><div class="tiny mute">Presenti</div></div>
    <div><div class="f" style="font-size:28px;color:var(--pink)">${senza}</div><div class="tiny mute">Senza pigiama</div></div>
    <div><div class="f" style="font-size:28px">${P.filter(p => p.tipo === 'bimbo' && p.presente && !p.foto_path).length}</div><div class="tiny mute">Foto bimbi mancanti</div></div></div>`;
}
function adminArrivi() {
  const A = S.adm;
  return `${contatori()}${A.famiglie.map(f => {
    const m = membriDi(f.id);
    return `<div class="card"><div class="row" style="margin-bottom:4px"><div class="grow"><b>${esc(nomeFamiglia(f))}</b></div>${m.some(p => !p.presente) ? `<button class="chip" data-a="adfampres" data-v="${f.id}">Tutti presenti</button>` : ''}</div>
      ${m.map(p => `<div class="member" style="flex-wrap:wrap">${avatar(p, 40)}<div class="grow"><b>${esc(nomeVisto(p))}</b><div class="tiny mute">${p.tipo === 'bimbo' ? `${p.eta} anni` : (p.user_id ? 'Adulto' : 'Adulto senza account')}</div></div>
        <div class="row" style="flex-basis:100%;justify-content:flex-end;gap:8px"><button class="chip ${p.presente ? 'on' : ''}" data-a="adpres" data-v="${p.id}" aria-pressed="${p.presente}">Presente</button>
        ${p.tipo === 'adulto'
          ? `<button class="chip" style="${p.senza_pigiama ? 'background:var(--pink);color:#2A1630;border-color:var(--pink)' : ''}" data-a="adsenza" data-v="${p.id}" aria-pressed="${p.senza_pigiama}">Senza pigiama</button>`
          : `<label class="chip filebtn" style="${p.foto_path ? 'background:var(--ok);color:#0F3320;border-color:var(--ok)' : ''}">${p.foto_path ? 'Foto ok' : 'Foto'}<input type="file" accept="image/*" capture="environment" data-file="kidfoto" data-id="${p.id}"></label>`}
      </div></div>`).join('')}</div>`;
  }).join('')}<p class="tiny mute">Chi non è presente non vota e non può essere votato. Chi è senza pigiama vota, ma non può essere votato, e paga 2 pegni.</p>`;
}
function adminFasi() {
  const A = S.adm, z = A.avz || {}, fase = S.serata.fase, i = FASI_ORDINE.indexOf(fase);
  const prox = FASI_ORDINE[i + 1];
  const mancanti = z.bimbi_senza_foto || [];
  return `<div class="card col"><div class="tiny mute" style="font-weight:800">FASE ATTUALE</div><div class="f" style="font-size:26px;color:var(--acc)">${esc(FASI[fase])}</div><p class="small mute">${esc(FASI_SPIEGA[fase])}</p>
      ${prox ? (prox === 'premiazione' && mancanti.length
        ? `<div class="err">Mancano le foto di: ${mancanti.map(k => esc(k.nome)).join(', ')}</div><button class="btn ghost full" data-a="adsez" data-v="arrivi">Vai agli arrivi per scattarle</button>`
        : `<button class="btn full" data-a="adfase" data-v="${prox}">Passa a: ${esc(FASI[prox])}</button>`) : ''}
    </div>
    <div class="card"><h3>Avanzamento</h3>
      <div class="member"><span class="grow">Presenti</span><b>${z.presenti ?? '–'} / ${z.iscritti ?? '–'}</b></div>
      <div class="member"><span class="grow">Senza pigiama</span><b>${z.senza_pigiama ?? '–'}</b></div>
      <div class="member"><span class="grow">Pronostici completi</span><b>${z.pronostici_completi ?? '–'} / ${z.adulti_presenti ?? '–'}</b></div>
      <div class="member"><span class="grow">Voti confermati (4 premi)</span><b>${z.voti_completi ?? '–'} / ${z.adulti_presenti ?? '–'}</b></div>
      <p class="tiny mute" style="margin-top:8px">Si aggiorna da solo ogni 5 secondi. Solo numeri: nemmeno tu vedi i risultati.</p></div>
    <div class="card"><h3>Iscrizioni</h3><p class="small mute" style="margin-bottom:10px">${S.serata.iscrizioni_aperte ? 'Aperte: gli amici possono iscriversi e modificare i figli.' : 'Chiuse: nuove persone le aggiungi solo tu.'}</p>
      <button class="btn ghost full" data-a="aditer">${S.serata.iscrizioni_aperte ? 'Chiudi le iscrizioni' : 'Riapri le iscrizioni'}</button></div>
    <div class="card"><h3>Tutte le fasi</h3>${FASI_ORDINE.map((k, j) => `<div class="member"><span class="tag" style="${j === i ? 'background:var(--acc);color:#1B2346' : ''}">${j + 1}</span><span class="grow" style="${j < i ? 'opacity:.5' : ''}">${esc(FASI[k])}</span>${j !== i ? `<button class="chip" data-a="adfase" data-v="${k}">${j < i ? 'Torna qui' : 'Vai'}</button>` : ''}</div>`).join('')}</div>`;
}
function adminIscritti() {
  const A = S.adm;
  return `<div class="card small mute">${A.famiglie.length} famiglie · ${A.persone.filter(p => p.tipo === 'adulto').length} adulti · ${A.persone.filter(p => p.tipo === 'bimbo').length} bimbi</div>
  ${A.famiglie.map(f => {
    const m = membriDi(f.id), adulti = m.filter(p => p.tipo === 'adulto').length;
    const avvisi = [];
    if (!f.foto_path) avvisi.push('foto di famiglia mancante');
    if (adulti < 2) avvisi.push(adulti === 0 ? 'nessun adulto' : 'manca il partner');
    m.filter(p => p.tipo === 'adulto' && !p.foto_path).forEach(p => avvisi.push('foto di ' + p.nome + ' mancante'));
    return `<div class="card"><div class="row"><div class="grow"><b>${esc(nomeFamiglia(f))}</b>${avvisi.length ? `<div class="tiny" style="color:var(--pink)">${avvisi.map(esc).join(' · ')}</div>` : ''}</div><button class="chip" data-a="adfamedit" data-v="${f.id}">Modifica</button></div>
      ${m.map(p => `<div class="member">${avatar(p, 38)}<div class="grow"><b>${esc(p.nome)} ${esc(p.cognome || '')}</b><div class="tiny mute">${p.tipo === 'bimbo' ? `${p.eta} anni · ${esc(p.titolo_buffo)}` : (p.soprannome ? 'detto ' + esc(p.soprannome) : (p.user_id ? 'Adulto' : 'Adulto senza account'))}${p.is_admin ? ' · organizzatore' : ''}</div></div><button class="chip" data-a="adedit" data-v="${p.id}">Modifica</button></div>`).join('')}
      <div class="row" style="margin-top:8px">${adulti < 2 ? `<button class="chip grow" data-a="adnew" data-v="${f.id}" data-t="adulto">+ Adulto</button>` : ''}<button class="chip grow" data-a="adnew" data-v="${f.id}" data-t="bimbo">+ Bimbo</button></div></div>`;
  }).join('')}
  <button class="btn ghost full" data-a="adnewfam">+ Nuova famiglia</button>
  <p class="tiny mute">Gli adulti aggiunti da qui non hanno un account: possono essere votati ma non votano dall'app.</p>`;
}
function adminImpostazioni() {
  const A = S.adm, s = S.serata;
  const lista = tipo => A.carte.filter(c => c.tipo === tipo).map(c => `<div class="member"><span class="grow small">${esc(c.testo)}</span><button class="chip" data-a="adcartadel" data-v="${c.id}" aria-label="Elimina">✕</button></div>`).join('') || '<p class="tiny mute">Nessuna carta.</p>';
  return `<div class="card col"><h3>Nomi dei premi</h3>${A.cat.map(c => `<input type="text" id="cat-${c.id}" value="${esc(c.nome)}" aria-label="Premio ${c.ordine}">`).join('')}<button class="btn ghost full" data-a="adsalvacat">Salva i nomi</button></div>
  <div class="card col"><h3>Punti</h3>
    <div class="row"><label class="grow small" for="pt-p">Pronostico giusto</label><input id="pt-p" type="number" style="width:90px" value="${s.punti_pronostico}"></div>
    <div class="row"><label class="grow small" for="pt-jv">Jolly vinto</label><input id="pt-jv" type="number" style="width:90px" value="${s.punti_jolly_vinto}"></div>
    <div class="row"><label class="grow small" for="pt-jp">Jolly perso</label><input id="pt-jp" type="number" style="width:90px" value="${s.punti_jolly_perso}"></div>
    <button class="btn ghost full" data-a="adsalvapunti">Salva i punti</button></div>
  <div class="card"><h3>Pegni sulla ruota</h3><p class="tiny mute" style="margin-bottom:6px">${A.pegni.filter(p => p.attivo).length} attivi. Tocca per attivare o disattivare.</p>
    ${A.pegni.map(p => `<button class="opt ${p.attivo ? 'on' : ''}" style="margin-bottom:6px" data-a="adpegno" data-v="${p.id}"><span class="grow small"><b>${esc(p.testo)}</b>${p.supporto ? `<br><span class="tiny mute">${esc(SUPPORTI[p.supporto] || p.supporto)}</span>` : ''}</span><span class="tag">${p.attivo ? 'Sì' : 'No'}</span></button>`).join('')}
    <div class="row" style="margin-top:8px"><input type="text" id="nuovo-pegno" placeholder="Nuovo pegno"><button class="btn" data-a="adpegnoadd">+</button></div></div>
  <div class="card"><h3>Carte del mimo (film)</h3>${lista('mimo')}<div class="row" style="margin-top:8px"><input type="text" id="nuova-mimo" placeholder="Titolo del film"><button class="btn" data-a="adcartaadd" data-v="mimo">+</button></div></div>
  <div class="card"><h3>Carte "Indovina la canzone"</h3>${lista('canzone')}<div class="row" style="margin-top:8px"><input type="text" id="nuova-canzone" placeholder="Titolo della canzone"><button class="btn" data-a="adcartaadd" data-v="canzone">+</button></div></div>
  <div class="card"><h3>Karaoke</h3>${A.brani.map(b => `<div class="member"><span class="grow small"><b>${esc(b.titolo)}</b><br><span class="tiny mute">${esc(b.url)}</span></span><button class="chip" data-a="adbranodel" data-v="${b.id}" aria-label="Elimina">✕</button></div>`).join('') || '<p class="tiny mute">Nessun brano.</p>'}
    <div class="col" style="margin-top:8px"><input type="text" id="brano-titolo" placeholder="Titolo (es. Jingle Bells)"><input type="text" id="brano-url" inputmode="url" placeholder="Link YouTube della base karaoke"><button class="btn ghost full" data-a="adbranoadd">+ Aggiungi brano</button></div></div>
  <div class="card col"><h3>Dopo la festa</h3><p class="small mute">Cancella definitivamente tutte le foto (visi, famiglie, bimbi).</p><button class="btn danger full" data-a="adcancellafoto">${S.adm.confermaFoto ? 'Tocca di nuovo per cancellare TUTTO' : 'Cancella tutte le foto'}</button></div>`;
}
function sheetAdmin(s) {
  if (s.tipo === 'adpersona') {
    const bimbo = s.ptipo === 'bimbo';
    return `<h2>${s.id ? 'Modifica' : 'Nuovo'} ${bimbo ? 'bimbo' : 'adulto'}</h2>
    <div class="field"><label for="ap-nome">Nome</label><input id="ap-nome" type="text" data-k="nome" value="${esc(s.nome)}"></div>
    ${bimbo ? `<div class="field"><label for="ap-eta">Età</label><input id="ap-eta" type="number" inputmode="numeric" data-k="eta" value="${esc(s.eta)}"></div>
      <div class="field"><label for="ap-tit">Titolo buffo</label><input id="ap-tit" type="text" data-k="titolo" value="${esc(s.titolo)}"></div>`
    : `<div class="field"><label for="ap-cog">Cognome</label><input id="ap-cog" type="text" data-k="cognome" value="${esc(s.cognome)}"></div>
      <div class="field"><label for="ap-sop">Soprannome</label><input id="ap-sop" type="text" data-k="soprannome" value="${esc(s.soprannome)}"></div>
      ${sceltaVoce(s.voce)}`}
    <div class="field"><label for="ap-fam">Famiglia</label><select id="ap-fam" data-k="famiglia_id" style="padding:13px;border-radius:12px;background:var(--bg2);border:1px solid var(--line);min-height:50px">${S.adm.famiglie.map(f => `<option value="${f.id}" ${f.id === s.famiglia_id ? 'selected' : ''}>${esc(nomeFamiglia(f))}</option>`).join('')}</select></div>
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="adsalvapersona" ${s.busy ? 'disabled' : ''}>Salva</button>
    ${s.haAccount ? `<div class="card col"><b>PIN dimenticato?</b><div class="row"><input id="ap-pin" class="otp" type="text" inputmode="numeric" maxlength="6" placeholder="nuovo PIN"><button class="btn" data-a="adpin">Reimposta</button></div><p class="tiny mute">Scrivi 6 cifre e comunicale alla persona: entrerà con quelle.</p></div>` : ''}
    ${s.id && !s.isMe ? `<button class="btn danger full" data-a="adeliminapersona" ${s.busy ? 'disabled' : ''}>${s.conferma ? 'Tocca di nuovo per eliminare' : 'Elimina'}</button>` : ''}`;
  }
  if (s.tipo === 'adfam') return `<h2>${s.id ? 'Modifica famiglia' : 'Nuova famiglia'}</h2>
    <div class="field"><label for="af-c">Cognome</label><input id="af-c" type="text" data-k="cognome" value="${esc(s.cognome)}"></div>
    <div class="field"><label for="af-n">Nickname</label><input id="af-n" type="text" data-k="nickname" value="${esc(s.nickname)}"></div>
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="adsalvafam" ${s.busy ? 'disabled' : ''}>Salva</button>
    ${s.id ? `<button class="btn danger full" data-a="adeliminafam" ${s.busy ? 'disabled' : ''}>${s.conferma ? 'Tocca di nuovo: elimina la famiglia e tutti i suoi membri' : 'Elimina famiglia'}</button>` : ''}`;
  if (s.tipo === 'adfase') return `<h2>Passare a: ${esc(FASI[s.fase])}?</h2><p class="mute">${esc(FASI_SPIEGA[s.fase])}</p>
    ${s.fase === 'attesa' && S.serata.iscrizioni_aperte ? `<label class="check ${s.chiudi ? 'on' : ''}"><input type="checkbox" data-a="adchiudiiscr" ${s.chiudi ? 'checked' : ''}><span>Chiudi anche le iscrizioni</span></label>` : ''}
    ${s.err ? `<div class="err" role="alert">${esc(s.err)}</div>` : ''}
    <button class="btn full" data-a="adconfermafase" ${s.busy ? 'disabled' : ''}>Conferma</button>`;
  return '';
}

async function aggiornaPersona(id, campi) {
  const p = personaDi(id); const prima = { ...p };
  Object.assign(p, campi); render();
  try { await q(sb.from('persone').update(campi).eq('id', id)); }
  catch (e) { Object.assign(p, prima); toast(erroreLeggibile(e)); render(); }
  aggiornaAvanzamento(false);
}
async function cancellaTutteLeFoto() {
  const st = sb.storage.from('foto');
  const cartelle = await q(st.list('', { limit: 1000 }));
  const percorsi = [];
  for (const c of cartelle) {
    const dentro = await q(st.list(c.name, { limit: 1000 }));
    dentro.forEach(f => percorsi.push(`${c.name}/${f.name}`));
  }
  for (let i = 0; i < percorsi.length; i += 100) await q(st.remove(percorsi.slice(i, i + 100)));
  for (const p of S.adm.persone.filter(x => x.foto_path)) await q(sb.from('persone').update({ foto_path: null }).eq('id', p.id));
  for (const f of S.adm.famiglie.filter(x => x.foto_path)) await q(sb.from('famiglie').update({ foto_path: null }).eq('id', f.id));
  S.urls = {};
  return percorsi.length;
}

// ---------------------------------------------------------------- comandi della premiazione
function costruisciPassi() {
  const P = S.adm.persone, st = [{ k: 'intro' }, { k: 'pegniIntro' }];
  const senza = P.filter(p => p.tipo === 'adulto' && p.presente && p.senza_pigiama);
  if (!senza.length) st.push({ k: 'nopegni' });
  senza.forEach(p => { st.push({ k: 'pegno', pid: p.id, g: 1 }); st.push({ k: 'pegno', pid: p.id, g: 2 }); });
  const bimbi = P.filter(p => p.tipo === 'bimbo' && p.presente).sort((a, b) => a.eta - b.eta || a.nome.localeCompare(b.nome));
  if (bimbi.length) { st.push({ k: 'bimbiIntro' }); bimbi.forEach(p => st.push({ k: 'bimbo', pid: p.id })); st.push({ k: 'bimbiFine' }); }
  S.adm.cat.forEach(c => { st.push({ k: 'catTitle', c: c.id }); st.push({ k: 'catFinal', c: c.id }); st.push({ k: 'catWin', c: c.id }); });
  st.push({ k: 'famFinal' }, { k: 'famWin' }, { k: 'clAd' }, { k: 'clFam' }, { k: 'fine' });
  return st;
}
function etichettaPasso(s) {
  const c = s.c ? (S.adm.cat.find(x => x.id === s.c) || {}).nome : '';
  const n = s.pid ? nomeVisto(personaDi(s.pid) || { nome: '?' }) : '';
  return {
    intro: 'Apertura della premiazione', pegniIntro: 'I pegni', nopegni: 'Nessun pegno', pegno: `Pegno ${s.g} di 2 · ${n}`,
    bimbiIntro: 'Chiamata dei bimbi', bimbo: `Bimbo sul palco · ${n}`, bimbiFine: 'Tutti i bimbi insieme',
    catTitle: c, catFinal: `${c} · finalisti`, catWin: `${c} · vincitore`, famFinal: 'Premio famiglia · finaliste',
    famWin: 'Premio famiglia · vincitrice', clAd: 'Classifica adulti', clFam: 'Classifica famiglie', fine: 'Buon anno!'
  }[s.k] || s.k;
}
async function aggiornaTv(patch, altri) {
  const tv = { ...(S.serata.tv || {}), ...patch };
  await q(sb.from('serata').update({ tv, ...(altri || {}) }).eq('id', 1));
  S.serata.tv = tv; Object.assign(S.serata, altri || {});
}
async function controllaPareggio() {
  const tv = S.serata.tv || {}, s = tv.steps && tv.steps[tv.i];
  S.adm.pareggio = null;
  if (!s || s.k !== 'catWin') return;
  try {
    const r = await q(sb.rpc('risultati'));
    const c = r.premi.find(x => x.categoria_id === s.c);
    if (c && c.pareggio && !c.vincitore_id) S.adm.pareggio = { cat: s.c, candidati: c.in_parita };
  } catch (e) { console.warn(e); }
}
function linkTv() { return new URL('tv.html', location.href).href; }
function vistaShow() {
  const tv = S.serata.tv || {}, fase = S.serata.fase, A = S.adm, z = A.avz || {};
  const mus = tv.musica || {}, cd = tv.countdown || {};
  const tvBox = `<div class="card col"><h3>Schermo TV</h3><p class="small mute">Sul portatile collegato alla TV apri questo indirizzo e accedi con la tua email:</p><div class="tag" style="word-break:break-all;font-size:13px;padding:8px 10px">${esc(linkTv())}</div><button class="btn ghost full" data-a="adcopiatv">Copia indirizzo</button></div>`;
  const musica = `<div class="card col"><h3>Musica sulla TV</h3>${(C.MUSICA && Object.values(C.MUSICA).some(l => l.length)) ? `
      <div class="row"><button class="btn ghost grow" data-a="admusica">${mus.on === false ? 'Accendi' : 'Spegni'}</button><button class="btn ghost grow" data-a="adbrano">Brano successivo</button></div>
      <div class="row"><button class="btn ghost" data-a="advol" data-v="-1" aria-label="Volume giù">−</button><span class="grow" style="text-align:center">Volume ${Math.round((mus.vol == null ? .6 : mus.vol) * 100)}%</span><button class="btn ghost" data-a="advol" data-v="1" aria-label="Volume su">+</button></div>`
    : '<p class="small mute">Nessun brano: aggiungi gli MP3 nella cartella "musica" e i loro nomi in config.js.</p>'}</div>`;
  const conto = `<div class="card col"><h3>Countdown di mezzanotte</h3><p class="small mute">Parte da solo sulla TV 5 minuti prima di mezzanotte (orologio del portatile)${cd.rinvio ? `, spostato di ${cd.rinvio} min` : ''}, e interrompe qualsiasi schermata. Dopo "Buon anno!" la TV torna dov'era.</p>
    <div class="row"><button class="btn ghost grow" data-a="adcdora">Avvia ora (10 s)</button><button class="btn ghost grow" data-a="adcdrinvia">Rimanda 1 min</button></div>${cd.rinvio ? `<button class="chip" data-a="adcdazzera">Annulla il rinvio</button>` : ''}</div>`;
  if (!['premiazione', 'fine'].includes(fase) || !tv.steps) {
    return `<div class="card"><h3>Premiazione</h3><p class="small mute">I comandi compaiono quando passi alla fase "Premiazione" dalla scheda Fasi.</p></div>${tvBox}${conto}${musica}`;
  }
  const s = tv.steps[tv.i], tot = tv.steps.length;
  let extra = '';
  if (s.k === 'pegno') {
    const chiave = s.pid + '-' + s.g, uscito = (tv.draws || {})[chiave], pg = uscito && A.pegni.find(x => x.id === uscito);
    extra = `<div class="col" style="margin-top:12px">
      ${pg ? `<div class="card" style="border-color:var(--acc)"><div class="tiny mute">Uscito</div><b>${esc(pg.testo)}</b></div>` : ''}
      ${!pg ? `<button class="btn full" data-a="adgira">Gira la ruota</button>` : `<button class="btn ghost full" data-a="adgira">Rigira</button>`}
      ${pg && pg.supporto === 'timer60' ? `<button class="btn ghost full" data-a="adtimer" data-v="60">Timer 1 minuto</button>` : ''}
      ${pg && pg.supporto === 'timer30' ? `<button class="btn ghost full" data-a="adtimer" data-v="30">Timer 30 secondi</button>` : ''}
      ${pg && pg.supporto === 'pregi' ? `<button class="btn ghost full" data-a="adtimer" data-v="30" data-t="10">Avvia 30 secondi</button><button class="btn full" data-a="adpiu" style="background:var(--ok)">+1 pregio${tv.timer ? ` (${tv.timer.count || 0}/10)` : ''}</button>` : ''}
      ${pg && ['mimo', 'canzone'].includes(pg.supporto) ? `${A.carta ? `<div class="card" style="border-color:var(--pink)"><div class="tiny mute">Solo tu vedi la carta</div><div class="f" style="font-size:24px">${esc(A.carta)}</div></div>` : ''}
        <button class="btn ghost full" data-a="adcarta" data-v="${pg.supporto}">${A.carta ? 'Cambia carta' : 'Pesca una carta'}</button><button class="btn ghost full" data-a="adtimer" data-v="60">Timer 1 minuto</button>` : ''}
      ${pg && pg.supporto === 'karaoke' ? (A.brani.length ? A.brani.map(b => `<button class="opt ${tv.karaoke === b.id ? 'on' : ''}" data-a="adkaraoke" data-v="${b.id}"><span class="grow"><b>${esc(b.titolo)}</b></span></button>`).join('') + '<p class="tiny mute">I bimbi scelgono, tu tocchi il brano: sulla TV compare il pulsante per aprire la base.</p>' : '<p class="small mute">Nessun brano karaoke: aggiungili nelle Impostazioni.</p>') : ''}
    </div>`;
  }
  if (s.k === 'catWin') {
    if (S.serata.spareggio_id) extra = `<div class="card col" style="margin-top:12px;border-color:var(--pink)"><b>Spareggio in corso</b><div class="small">Hanno votato ${z.spareggio_votanti ?? 0} / ${z.adulti_presenti ?? 0}</div>
        ${S.g.sp && S.me.presente ? (S.g.spVoto ? `<div class="tiny mute">Hai votato ${esc(nomeVisto(pers(S.g.spVoto)))}</div>` : `<div class="tiny mute">Vota anche tu:</div><div class="pchips">${S.g.sp.candidati.filter(id => id !== S.me.id).map(id => `<button class="pchip" data-a="gsp" data-v="${id}">${avatar(pers(id), 30)}<span>${esc(nomeVisto(pers(id)))}</span></button>`).join('')}</div>`) : ''}
        <div class="row"><button class="btn ghost grow" data-a="adallunga">+15 secondi</button><button class="btn grow" data-a="adchiudisp">Chiudi spareggio</button></div></div>`;
    else if (A.pareggio && A.pareggio.cat === s.c) extra = `<div class="card col" style="margin-top:12px;border-color:var(--pink)"><b>Pareggio!</b><p class="small mute">Fai sfilare i candidati, poi avvia lo spareggio: compare da solo sui telefoni.</p><button class="btn full" data-a="adspareggio">Avvia spareggio (30 s)</button></div>`;
  }
  return `<div class="card col"><div class="tiny mute" style="font-weight:800">PASSO ${tv.i + 1} DI ${tot}</div><div class="f" style="font-size:24px">${esc(etichettaPasso(s))}</div>
      ${tv.steps[tv.i + 1] ? `<div class="tiny mute">Dopo: ${esc(etichettaPasso(tv.steps[tv.i + 1]))}</div>` : ''}
      <div class="row"><button class="btn ghost" data-a="adindietro" ${tv.i === 0 ? 'disabled' : ''}>Indietro</button><button class="btn grow" data-a="adavanti" ${tv.i >= tot - 1 || S.serata.spareggio_id ? 'disabled' : ''}>Avanti</button></div>${extra}</div>
    ${conto}${musica}${tvBox}`;
}
function scegliPegno(tv, s) {
  const attivi = S.adm.pegni.filter(p => p.attivo);
  const usati = Object.values(tv.draws || {});
  const altroMio = (tv.draws || {})[s.pid + '-' + (s.g === 1 ? 2 : 1)];
  const attuale = (tv.draws || {})[s.pid + '-' + s.g];
  let pool = attivi.filter(p => !usati.includes(p.id));
  if (!pool.length) pool = attivi.filter(p => p.id !== altroMio && p.id !== attuale);
  if (!pool.length) pool = attivi;
  return pool[Math.floor(Math.random() * pool.length)];
}
async function azioneShow(a, v, el) {
  const tv = S.serata.tv || {}, A = S.adm;
  const s = tv.steps && tv.steps[tv.i];
  switch (a) {
    case 'adavanti': case 'adindietro': {
      const i = tv.i + (a === 'adavanti' ? 1 : -1);
      if (i < 0 || i >= tv.steps.length) return true;
      A.carta = null; A.pareggio = null;
      const altri = {};
      if (tv.steps[i].k === 'fine') altri.fase = 'fine';
      else if (S.serata.fase === 'fine') altri.fase = 'premiazione';
      await aggiornaTv({ i, spin: null, timer: null, card: null, karaoke: null }, altri);
      await controllaPareggio();
      return true;
    }
    case 'adgira': {
      const p = scegliPegno(tv, s); if (!p) { toast('Nessun pegno attivo'); return true; }
      const draws = { ...(tv.draws || {}), [s.pid + '-' + s.g]: p.id };
      A.carta = null;
      await aggiornaTv({ draws, spin: { key: s.pid + '-' + s.g, pegno: p.id, at: Date.now() }, timer: null, card: null, karaoke: null });
      toast('La ruota gira sulla TV…');
      return true;
    }
    case 'adtimer': await aggiornaTv({ timer: { id: Date.now(), sec: +v, target: el.dataset.t ? +el.dataset.t : 0, count: 0 } }); return true;
    case 'adpiu': {
      if (!tv.timer) { toast('Avvia prima il timer'); return true; }
      await aggiornaTv({ timer: { ...tv.timer, count: (tv.timer.count || 0) + 1 } }); return true;
    }
    case 'adcarta': {
      const libere = A.carte.filter(c => c.tipo === v && !c.usata && c.testo !== A.carta);
      const pool = libere.length ? libere : A.carte.filter(c => c.tipo === v && c.testo !== A.carta);
      if (!pool.length) { toast('Nessuna carta: aggiungile nelle Impostazioni'); return true; }
      const c = pool[Math.floor(Math.random() * pool.length)];
      A.carta = c.testo; c.usata = true;
      q(sb.from('carte').update({ usata: true }).eq('id', c.id)).catch(() => {});
      await aggiornaTv({ card: Date.now() }); return true;
    }
    case 'adkaraoke': await aggiornaTv({ karaoke: +v }); return true;
    case 'adspareggio': {
      const p = A.pareggio; if (!p) return true;
      await q(sb.rpc('avvia_spareggio', { p_categoria: p.cat, p_candidati: p.candidati, p_secondi: 30 }));
      S.serata.spareggio_id = 'in-corso'; toast('Spareggio avviato sui telefoni'); aggiornaAvanzamento(false); return true;
    }
    case 'adallunga': await q(sb.rpc('allunga_spareggio', { p_secondi: 15 })); toast('+15 secondi'); return true;
    case 'adchiudisp': {
      await q(sb.rpc('chiudi_spareggio'));
      S.serata.spareggio_id = null; A.pareggio = null; toast('Spareggio chiuso: il vincitore appare sulla TV'); return true;
    }
    case 'adcdora': await aggiornaTv({ countdown: { ...(tv.countdown || {}), ora: Date.now() } }); toast('Countdown di prova sulla TV'); return true;
    case 'adcdrinvia': await aggiornaTv({ countdown: { ...(tv.countdown || {}), rinvio: ((tv.countdown || {}).rinvio || 0) + 1 } }); return true;
    case 'adcdazzera': await aggiornaTv({ countdown: { ...(tv.countdown || {}), rinvio: 0 } }); return true;
    case 'admusica': { const m = tv.musica || {}; await aggiornaTv({ musica: { ...m, on: m.on === false } }); return true; }
    case 'adbrano': await aggiornaTv({ musica: { ...(tv.musica || {}), next: Date.now() } }); return true;
    case 'advol': { const m = tv.musica || {}, vol = Math.min(1, Math.max(0, Math.round(((m.vol == null ? .6 : m.vol) + (+v) * .1) * 10) / 10)); await aggiornaTv({ musica: { ...m, vol } }); return true; }
    case 'adcopiatv': try { await navigator.clipboard.writeText(linkTv()); toast('Indirizzo copiato'); } catch (e) { toast(linkTv()); } return true;
  }
  return false;
}

// Restituisce true se l'azione era dell'organizzatore
async function azioneAdmin(a, v, el) {
  const A = S.adm, s = S.sheet;
  const rs = await azioneShow(a, v, el); if (rs) return rs;
  switch (a) {
    case 'adsez': A.sez = v; A.confermaFoto = false; if (v === 'fasi') aggiornaAvanzamento(true); if (v === 'show') await controllaPareggio(); return true;
    case 'adpres': { const p = personaDi(v); await aggiornaPersona(v, p.presente ? { presente: false, senza_pigiama: false } : { presente: true }); return true; }
    case 'adsenza': { const p = personaDi(v); await aggiornaPersona(v, p.senza_pigiama ? { senza_pigiama: false } : { senza_pigiama: true, presente: true }); return true; }
    case 'adfampres': for (const p of membriDi(v).filter(x => !x.presente)) await aggiornaPersona(p.id, { presente: true }); return true;
    case 'adfase': S.sheet = { tipo: 'adfase', fase: v, chiudi: true, err: '' }; return true;
    case 'adconfermafase': {
      s.busy = true; render();
      try {
        if (s.fase === 'premiazione') {
          await aggiornaAvanzamento(false);
          const m = (A.avz && A.avz.bimbi_senza_foto) || [];
          if (m.length) throw new Error('Mancano le foto di: ' + m.map(k => k.nome).join(', '));
        }
        const campi = { fase: s.fase, aggiornato_il: new Date().toISOString() };
        if (s.fase === 'premiazione') {
          await caricaAdmin();
          const vecchio = S.serata.tv || {};
          campi.tv = { musica: vecchio.musica, countdown: vecchio.countdown, steps: costruisciPassi(), i: 0, draws: {}, spin: null, timer: null, card: null, karaoke: null };
        }
        if (s.fase === 'attesa' && S.serata.iscrizioni_aperte && s.chiudi) campi.iscrizioni_aperte = false;
        await q(sb.from('serata').update(campi).eq('id', 1));
        Object.assign(S.serata, campi);
        S.sheet = null; toast('Fase: ' + FASI[s.fase]);
        if (s.fase === 'premiazione') A.sez = 'show';
        aggiornaAvanzamento(false);
      } catch (e) { s.err = erroreLeggibile(e); s.busy = false; }
      return true;
    }
    case 'aditer': {
      const nuovo = !S.serata.iscrizioni_aperte;
      await q(sb.from('serata').update({ iscrizioni_aperte: nuovo }).eq('id', 1));
      S.serata.iscrizioni_aperte = nuovo; toast(nuovo ? 'Iscrizioni riaperte' : 'Iscrizioni chiuse');
      return true;
    }
    case 'adedit': {
      const p = personaDi(v);
      S.sheet = { tipo: 'adpersona', id: p.id, ptipo: p.tipo, nome: p.nome, cognome: p.cognome || '', soprannome: p.soprannome || '', eta: p.eta == null ? '' : String(p.eta), titolo: p.titolo_buffo || '', famiglia_id: p.famiglia_id, isMe: p.id === S.me.id, haAccount: !!p.user_id, voce: p.voce || null, err: '' };
      return true;
    }
    case 'adnew': S.sheet = { tipo: 'adpersona', id: null, ptipo: el.dataset.t, nome: '', cognome: famDi(v).cognome, soprannome: '', eta: '', titolo: '', famiglia_id: v, err: '' }; return true;
    case 'adsalvapersona': {
      const bimbo = s.ptipo === 'bimbo';
      const campi = { nome: s.nome.trim(), famiglia_id: s.famiglia_id };
      if (!campi.nome) { s.err = 'Il nome è obbligatorio.'; return true; }
      if (bimbo) {
        campi.eta = parseInt(s.eta, 10); campi.titolo_buffo = s.titolo.trim();
        if (isNaN(campi.eta) || campi.eta < 0 || campi.eta > 17) { s.err = 'Età tra 0 e 17 anni.'; return true; }
        if (!campi.titolo_buffo) { s.err = 'Il titolo buffo è obbligatorio.'; return true; }
      } else {
        campi.cognome = s.cognome.trim(); campi.soprannome = s.soprannome.trim() || null; campi.voce = s.voce || null;
        if (!campi.cognome) { s.err = 'Il cognome è obbligatorio.'; return true; }
      }
      s.busy = true; render();
      try {
        if (s.id) await q(sb.from('persone').update(campi).eq('id', s.id));
        else await q(sb.from('persone').insert({ id: uuid(), tipo: s.ptipo, ...campi }));
        await caricaAdmin(); if (S.me) await caricaFamiglia();
        S.sheet = null; toast('Salvato');
      } catch (e) { s.err = erroreLeggibile(e); s.busy = false; }
      return true;
    }
    case 'adeliminapersona': {
      if (!s.conferma) { s.conferma = true; return true; }
      s.busy = true; render();
      try {
        const p = personaDi(s.id);
        await q(sb.from('persone').delete().eq('id', s.id));
        if (p && p.foto_path) await rimuoviFoto(p.foto_path);
        await caricaAdmin(); S.sheet = null; toast('Eliminato');
      } catch (e) { s.err = erroreLeggibile(e); s.busy = false; }
      return true;
    }
    case 'adpin': {
      const pin = (document.getElementById('ap-pin').value || '').replace(/\D/g, '');
      if (pin.length !== 6) { toast('Il PIN deve avere 6 cifre'); return 'fatto'; }
      try { await q(sb.rpc('reimposta_pin', { p_persona: s.id, p_pin: pin })); toast('PIN reimpostato: ' + pin); }
      catch (e) { toast(erroreLeggibile(e)); }
      return 'fatto';
    }
    case 'adfamedit': { const f = famDi(v); S.sheet = { tipo: 'adfam', id: f.id, cognome: f.cognome, nickname: f.nickname, err: '' }; return true; }
    case 'adnewfam': S.sheet = { tipo: 'adfam', id: null, cognome: '', nickname: '', err: '' }; return true;
    case 'adsalvafam': {
      if (!s.cognome.trim() || !s.nickname.trim()) { s.err = 'Cognome e nickname sono obbligatori.'; return true; }
      s.busy = true; render();
      try {
        const campi = { cognome: s.cognome.trim(), nickname: s.nickname.trim() };
        if (s.id) await q(sb.from('famiglie').update(campi).eq('id', s.id));
        else await q(sb.from('famiglie').insert({ id: uuid(), ...campi, creata_da: S.session.user.id }));
        await caricaAdmin(); if (S.me) await caricaFamiglia();
        S.sheet = null; toast('Salvato');
      } catch (e) { s.err = erroreLeggibile(e); s.busy = false; }
      return true;
    }
    case 'adeliminafam': {
      if (s.id === S.me.famiglia_id) { s.err = 'Non puoi eliminare la tua famiglia.'; return true; }
      if (!s.conferma) { s.conferma = true; return true; }
      s.busy = true; render();
      try { await q(sb.from('famiglie').delete().eq('id', s.id)); await caricaAdmin(); S.sheet = null; toast('Famiglia eliminata'); }
      catch (e) { s.err = erroreLeggibile(e); s.busy = false; }
      return true;
    }
    case 'adsalvacat': {
      for (const c of A.cat) {
        const nome = (document.getElementById('cat-' + c.id).value || '').trim();
        if (nome && nome !== c.nome) { await q(sb.from('categorie').update({ nome }).eq('id', c.id)); c.nome = nome; }
      }
      S.categorie = A.cat.map(c => ({ ...c })); toast('Nomi dei premi salvati'); return true;
    }
    case 'adsalvapunti': {
      const campi = { punti_pronostico: +document.getElementById('pt-p').value, punti_jolly_vinto: +document.getElementById('pt-jv').value, punti_jolly_perso: +document.getElementById('pt-jp').value };
      if (Object.values(campi).some(x => isNaN(x))) { toast('Scrivi dei numeri'); return true; }
      await q(sb.from('serata').update(campi).eq('id', 1)); Object.assign(S.serata, campi); toast('Punti salvati'); return true;
    }
    case 'adpegno': { const p = A.pegni.find(x => x.id === +v); p.attivo = !p.attivo; render(); await q(sb.from('pegni').update({ attivo: p.attivo }).eq('id', p.id)); return true; }
    case 'adpegnoadd': {
      const t = document.getElementById('nuovo-pegno').value.trim(); if (!t) return true;
      await q(sb.from('pegni').insert({ testo: t })); A.pegni = await q(sb.from('pegni').select('*').order('id')); toast('Pegno aggiunto'); return true;
    }
    case 'adcartaadd': {
      const inp = document.getElementById('nuova-' + v), t = inp.value.trim(); if (!t) return true;
      await q(sb.from('carte').insert({ tipo: v, testo: t })); A.carte = await q(sb.from('carte').select('*').order('id'));
      render(); setTimeout(() => document.getElementById('nuova-' + v)?.focus(), 30); return 'fatto';
    }
    case 'adcartadel': await q(sb.from('carte').delete().eq('id', +v)); A.carte = A.carte.filter(c => c.id !== +v); return true;
    case 'adbranoadd': {
      const t = document.getElementById('brano-titolo').value.trim(), u = document.getElementById('brano-url').value.trim();
      if (!t || !/^https?:\/\//.test(u)) { toast('Serve il titolo e un link che inizi con https://'); return true; }
      await q(sb.from('brani_karaoke').insert({ titolo: t, url: u, ordine: A.brani.length + 1 }));
      A.brani = await q(sb.from('brani_karaoke').select('*').order('ordine')); toast('Brano aggiunto'); return true;
    }
    case 'adbranodel': await q(sb.from('brani_karaoke').delete().eq('id', +v)); A.brani = A.brani.filter(b => b.id !== +v); return true;
    case 'adcancellafoto': {
      if (!A.confermaFoto) { A.confermaFoto = true; return true; }
      A.confermaFoto = false; toast('Cancellazione in corso…');
      const n = await cancellaTutteLeFoto(); await caricaAdmin(); await caricaFamiglia();
      toast(`${n} foto cancellate`); return true;
    }
  }
  return false;
}

// ================================================================ EVENTI
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.k;
  if (!k) return;
  const dest = S.sheet || S.wiz;
  if (dest) dest[k] = e.target.value;
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (['email', 'pin', 'pin2'].includes(e.target.id)) entra();
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.a === 'privacy') { S.wiz.privacy = t.checked; return render(); }
  if (t.dataset.a === 'adchiudiiscr') { S.sheet.chiudi = t.checked; return render(); }
  const tipo = t.dataset.file;
  if (!tipo || !t.files || !t.files[0]) return;
  const file = t.files[0];
  if (tipo === 'visogal') { t.value = ''; await prendiViso(t.dataset.dest, { file }); render(); return; }
  try {
    if (tipo === 'wizfoto') {
      const blob = await riduci(file, 900);
      S.wiz.foto = blob; S.wiz.fotoPrev = URL.createObjectURL(blob); S.wiz.err = '';
      render();
    }
    if (tipo === 'famfoto') {
      toast('Caricamento foto…');
      await cambiaFotoFamiglia(file);
      toast('Foto di famiglia aggiornata'); render();
    }
    if (tipo === 'kidfoto') {
      const p = personaDi(t.dataset.id);
      toast('Caricamento foto di ' + p.nome + '…');
      const blob = await riduci(file, 1000), vecchia = p.foto_path;
      const path = await caricaFoto(`${p.famiglia_id}/${p.id}-${Date.now()}.jpg`, blob);
      await q(sb.from('persone').update({ foto_path: path }).eq('id', p.id));
      await rimuoviFoto(vecchia);
      p.foto_path = path; await preparaUrl([path]); aggiornaAvanzamento(false);
      toast('Foto di ' + p.nome + ' salvata'); render();
    }
    if (tipo === 'mefoto') {
      const blob = await riduci(file, 900);
      S.sheet.foto = blob; S.sheet.fotoPrev = URL.createObjectURL(blob);
      render();
    }
  } catch (err) { toast(erroreLeggibile(err)); }
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const a = el.dataset.a, v = el.dataset.v;
  if (a === 'chiudisheet' && e.target !== el) return;   // clic dentro la finestra
  if (a === 'privacy' || a === 'adchiudiiscr') return;  // gestiti da change
  try {
    switch (a) {
      case 'entra': return entra();
      case 'passkey': return entraConPasskey();
      case 'logintab': leggiLogin(); S.login.step = v; S.login.err = ''; break;
      case 'attivapasskey': return attivaPasskey();
      case 'nopasskey': try { localStorage.setItem('pigiama-passkey-no-' + S.session.user.id, '1'); } catch (err) { /* niente */ } break;
      case 'esci': return esci();
      case 'tab':
        S.tab = v; S.sheet = null; window.scrollTo(0, 0);
        if (v === 'admin') { render(); await caricaAdmin(); avviaPolling(); }
        break;

      case 'wavanti': return wizAvanti();
      case 'windietro': S.wiz.step = Math.max(0, S.wiz.step - 1); S.wiz.err = ''; break;
      case 'wmode': S.wiz.mode = v; S.wiz.err = ''; if (v === 'unisci') S.wiz.famiglie = null; break;
      case 'wfam': S.wiz.famId = v; S.wiz.err = ''; break;
      case 'titolo': {
        const dest = el.dataset.p === 's' ? S.sheet : S.wiz;
        dest[el.dataset.p === 's' ? 'titolo' : 'kTitolo'] = v;
        break;
      }
      case 'kadd': {
        const w = S.wiz; w.busy = true; w.err = ''; render();
        try {
          await salvaFiglio({ nome: w.kNome, eta: w.kEta, titolo: w.kTitolo }, null, w.kViso);
          w.kNome = ''; w.kEta = ''; w.kTitolo = ''; w.kViso = null; w.kVisoPrev = null;
          toast('Bimbo aggiunto');
        } catch (err) { w.err = erroreLeggibile(err); }
        w.busy = false; break;
      }

      case 'knew': S.sheet = { tipo: 'figlio', id: null, nome: '', eta: '', titolo: '', err: '' }; break;
      case 'voce': (S.sheet || S.wiz).voce = v; break;
      case 'visocam': await prendiViso(v, { modo: 'camera' }); break;
      case 'kedit': {
        const k = S.members.find(m => m.id === v);
        S.sheet = { tipo: 'figlio', id: k.id, nome: k.nome, eta: String(k.eta), titolo: k.titolo_buffo, err: '', visoUrl: k.viso_path && S.urls[k.viso_path] };
        break;
      }
      case 'ssalvafiglio': {
        const s = S.sheet; s.busy = true; s.err = ''; render();
        try { await salvaFiglio(s, s.id, s.viso); S.sheet = null; toast('Salvato'); }
        catch (err) { s.err = erroreLeggibile(err); s.busy = false; }
        break;
      }
      case 'seliminafiglio': {
        const s = S.sheet;
        if (!s.conferma) { s.conferma = true; break; }
        s.busy = true; render();
        try { await eliminaFiglio(s.id); S.sheet = null; toast('Bimbo eliminato'); }
        catch (err) { s.err = erroreLeggibile(err); s.busy = false; }
        break;
      }
      case 'meedit': S.sheet = { tipo: 'me', nome: S.me.nome, cognome: S.me.cognome || '', soprannome: S.me.soprannome || '', voce: S.me.voce || null, err: '' }; break;
      case 'ssalvame': {
        const s = S.sheet;
        if (!s.nome.trim() || !s.cognome.trim()) { s.err = 'Nome e cognome sono obbligatori.'; break; }
        s.busy = true; render();
        try {
          await q(sb.from('persone').update({ nome: s.nome.trim(), cognome: s.cognome.trim(), soprannome: s.soprannome.trim() || null, voce: s.voce || null }).eq('id', S.me.id));
          if (s.foto) await cambiaMiaFoto(s.foto); else await caricaFamiglia();
          S.sheet = null; toast('Profilo aggiornato');
        } catch (err) { s.err = erroreLeggibile(err); s.busy = false; }
        break;
      }
      case 'famedit': S.sheet = { tipo: 'fam', cognome: S.fam.cognome, nickname: S.fam.nickname, err: '' }; break;
      case 'ssalvafam': {
        const s = S.sheet;
        if (!s.cognome.trim() || !s.nickname.trim()) { s.err = 'Cognome e nickname sono obbligatori.'; break; }
        s.busy = true; render();
        try {
          await q(sb.from('famiglie').update({ cognome: s.cognome.trim(), nickname: s.nickname.trim() }).eq('id', S.fam.id));
          await caricaFamiglia(); S.sheet = null; toast('Famiglia aggiornata');
        } catch (err) { s.err = erroreLeggibile(err); s.busy = false; }
        break;
      }
      case 'chiudisheet': S.sheet = null; break;
      default: {
        if (a.startsWith('g') && S.me) { const r = await azioneSerata(a, v, el); if (!r) return; break; }
        if (!a.startsWith('ad') || !S.me || !S.me.is_admin) return;
        const r = await azioneAdmin(a, v, el);
        if (!r || r === 'fatto') return;
      }
    }
  } catch (err) { toast(erroreLeggibile(err)); }
  render();
});

// Quando l'app torna in primo piano, aggiorna i dati (es. il partner ha aggiunto i figli)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.screen === 'main' && S.tab === 'admin') { caricaAdmin().then(render).catch(() => {}); return; }
  if (document.visibilityState === 'visible' && S.screen === 'main') {
    Promise.all([
      caricaFamiglia(),
      q(sb.from('serata').select('*').eq('id', 1).single()).then(x => { S.serata = x; })
    ]).then(caricaFase).then(render).catch(() => {});
  }
});

// ================================================================ AVVIO
if (!sb) { S.screen = 'config'; render(); return; }
sb.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') { S.screen = 'login'; render(); }
});
caricaTutto();

})();
