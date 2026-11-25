-- =====================================================================
-- CAPODANNO IN PIGIAMA — aggiornamento: omini animati
-- Da eseguire una volta nell'SQL Editor di Supabase.
-- =====================================================================

-- Voce dell'omino (solo adulti: m = maschile, f = femminile; i bimbi hanno la voce da bimbo)
alter table public.persone add column if not exists voce text check (voce in ('m', 'f'));

-- Pigiama natalizio assegnato a caso (0..7), uguale su tutti i telefoni
alter table public.persone add column if not exists pigiama int not null default floor(random() * 8)::int;

-- Foto del viso dei bimbi (per gli adulti il viso è già in foto_path;
-- per i bimbi foto_path resta la foto in pigiama scattata all'arrivo)
alter table public.persone add column if not exists viso_path text;

-- Quanti iscritti ci sono: serve alla schermata di accesso per disegnare
-- altrettanti omini con la faccina disegnata (nessuna foto, nessun nome)
create or replace function public.conteggio_omini()
returns int
language sql stable security definer set search_path = public
as $$ select count(*)::int from persone $$;

revoke execute on function public.conteggio_omini() from public;
grant execute on function public.conteggio_omini() to anon, authenticated;
