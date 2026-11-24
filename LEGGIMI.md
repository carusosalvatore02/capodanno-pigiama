# Capodanno in Pigiama – app completa

Contiene: serata per gli ospiti (pronostici e jolly, pagelle, premi, conferma voto, spareggio live, classifiche finali), pannello organizzatore (scheda Regia: arrivi, fasi, iscritti, impostazioni), accesso con codice via email, iscrizione (chi sei, famiglia, figli, foto di famiglia, privacy),
Home con conto alla rovescia e promemoria, La mia famiglia (modifiche e foto), Regole.

## Come metterla online (GitHub Pages)
1. Crea un repository su GitHub (es. `capodanno-pigiama`).
2. Carica TUTTI i file e le cartelle di questo pacchetto (index.html, app.js, config.js, sw.js,
   manifest.webmanifest, cartelle icons e vendor).
3. Settings › Pages › Branch `main` › cartella `/ (root)` › Save.
4. Dopo 1–2 minuti l'app è su `https://<tuo-utente>.github.io/capodanno-pigiama/`.

## Collegarla a Supabase
In `config.js` incolla:
- SUPABASE_URL e SUPABASE_ANON_KEY (Supabase › Project Settings › API)

In Supabase:
- SQL Editor: esegui `supabase_schema.sql` (se non l'hai già fatto)
- Authentication › URL Configuration › Site URL: l'indirizzo GitHub Pages dell'app
- Authentication › Email Templates: in "Magic Link" e "Confirm signup" inserisci `{{ .Token }}`
  (es. "Il tuo codice per Capodanno in Pigiama è: {{ .Token }}")
- Authentication › SMTP: collega un servizio di invio email (Brevo o Resend), altrimenti
  le email arrivano solo ai membri del team Supabase

## Diventare organizzatore
Dopo esserti iscritto dall'app, nell'SQL Editor:
    update public.persone set is_admin = true
    where user_id = (select id from auth.users where email = 'LA-TUA-EMAIL');

## Aggiornamenti
A ogni nuova versione cambia `VERSIONE` in `sw.js` (es. pigiama-v2), così i telefoni scaricano i file nuovi.

## Schermo TV
Sul portatile collegato alla TV apri `https://<tuo-utente>.github.io/capodanno-pigiama/tv.html`,
accedi con la tua email e tocca "Avvia schermo TV" (sblocca suoni e musica, va a schermo intero).
Poi non serve più toccarlo: si comanda tutto dal telefono, scheda Regia › Show.
Disattiva lo standby del portatile.

## Musica
Metti i file MP3 (liberi da diritti) nella cartella `musica` e scrivi i loro nomi in `config.js`, voce MUSICA.

## Ancora da fare
Accesso con Face ID / impronta (per ora si entra con il codice via email, che resta valido per settimane).
