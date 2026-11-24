// =====================================================
// CONFIGURAZIONE — da compilare una volta sola
// Supabase › Project Settings › API
// =====================================================
window.CONFIG = {
  SUPABASE_URL: 'https://lmmpezprjsimpwbybios.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_PlmqE7dTMua939jhGp1fvw_ic-a110i',

  // Data e ora della festa (ora italiana)
  DATA_FESTA: '2026-12-31T20:00:00+01:00',

  // Nome dell'organizzatore, usato nei testi
  ORGANIZZATORE: 'Salvatore',

  // Musica di sottofondo dello schermo TV (file MP3 liberi da diritti nella cartella "musica").
  // Esempio: cena: ['musica/jazz-natalizio.mp3', 'musica/swing.mp3']
  MUSICA: {
    cena: [],          // arrivi, pronostici, votazioni
    premiazione: [],   // suspense, quiz show
    festa: []          // dopo mezzanotte e a fine serata
  }
};
