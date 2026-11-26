// =====================================================
// CONFIGURAZIONE — Capodanno in Pigiama
// Supabase › Project Settings › API
// =====================================================
window.CONFIG = {
  SUPABASE_URL: 'https://lmmpezprjsimpwbybios.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_PlmqE7dTMua939jhGp1fvw_ic-a110i',

  // Data e ora della festa (ora italiana)
  DATA_FESTA: '2026-12-31T20:00:00+01:00',

  // Nome dell'organizzatore, usato nei testi
  ORGANIZZATORE: 'Salvatore',

  // Suoni degli omini (file MP3 nella cartella "suoni").
  // Se un file manca, l'omino usa un verso generato dall'app.
  SUONI: {
    uomo:  { ahia: ['suoni/uomo-ahia.mp3'],  urlo: ['suoni/uomo-urlo.mp3'] },
    donna: { ahia: ['suoni/donna-ahia.mp3'], urlo: ['suoni/donna-urlo.mp3'] },
    bimbo: { ahia: ['suoni/bimbo-ahia.mp3'], urlo: ['suoni/bimbo-urlo.mp3'] },
    tonfo: ['suoni/tonfo.mp3']
  },

  // Effetti sonori dello schermo TV (file MP3 nella cartella "suoni/tv").
  // Se un file manca, la TV usa un suono generato.
  SUONI_TV: {
    rullo:    ['suoni/tv/rullo.mp3'],     // prima di svelare un vincitore (2-3 s, finisce col piatto)
    applausi: ['suoni/tv/applausi.mp3'],  // insieme alla fanfara
    ding:     ['suoni/tv/ding.mp3'],      // pegno estratto, punto segnato nel mimo/canzone
    tic:      ['suoni/tv/tic.mp3'],       // ruota che gira, ultimi 5 secondi dei timer (cortissimo!)
    bip:      ['suoni/tv/bip.mp3'],       // ultimi secondi prima di mezzanotte
    fine:     ['suoni/tv/fine.mp3'],      // tempo scaduto
    botti:    ['suoni/tv/botti.mp3']      // fuochi d'artificio a mezzanotte
  },

  // Spotify sulla TV (facoltativo, serve Premium). Se è compilato, la musica arriva da queste playlist;
  // se Spotify non è collegato o non va, la TV usa gli MP3 qui sotto.
  // Per ogni momento incolla il link della playlist (Spotify › Condividi › Copia link della playlist).
  SPOTIFY: {
    clientId: '0f994dfd8c794e27a7f68d9827ebcf4a',
    playlist: {
      cena:        'https://open.spotify.com/playlist/2OxJrcgA6AQGk1sSQ8ZZ2a',
      pegni:       'https://open.spotify.com/playlist/48I6rPdTiVm3fyPRUUaa4f',
      premiazione: 'https://open.spotify.com/playlist/2V7ZRCHDQ11JvNZF4Ghxzc',
      finale:      'https://open.spotify.com/playlist/5uoSkNuNNoDJNDutYwilb5',
      festa:       'https://open.spotify.com/playlist/4XZRMPE0wRltzv2U16Y3C4'
    }
  },

  // Musica di sottofondo dello schermo TV (file MP3 nella cartella "musica").
  // Per più brani: cena: ['musica/cena.mp3', 'musica/cena-2.mp3']
  // Se pegni o finale mancano, la TV usa rispettivamente la musica di cena e quella di festa.
  MUSICA: {
    cena:        ['musica/cena.mp3'],         // arrivi, pronostici, votazioni
    pegni:       ['musica/pegni.mp3'],        // premiazione: pegni e bimbi (allegra, si ride)
    premiazione: ['musica/premiazione.mp3'],  // premiazione: i 4 premi (suspense)
    finale:      ['musica/finale.mp3'],       // premiazione: famiglie e classifica
    festa:       ['musica/festa.mp3']         // dopo mezzanotte e a fine serata
  }
};
