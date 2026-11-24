-- =====================================================================
-- CAPODANNO IN PIGIAMA — schema database Supabase
-- Da incollare ed eseguire tutto insieme nell'editor SQL di Supabase,
-- su un progetto nuovo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. STATO DELLA SERATA (una sola riga)
-- ---------------------------------------------------------------------
create table public.serata (
  id                 int primary key default 1 check (id = 1),
  fase               text not null default 'iscrizioni'
                     check (fase in ('iscrizioni','attesa','pronostici','votazioni',
                                     'votazioni_chiuse','premiazione','fine')),
  iscrizioni_aperte  boolean not null default true,
  tv                 jsonb not null default '{}'::jsonb,  -- passo corrente dello schermo TV
  spareggio_id       uuid,                               -- spareggio in corso
  countdown          jsonb not null default '{}'::jsonb, -- {"rinvio_minuti":0,"avvio_manuale":null}
  punti_pronostico   int not null default 5,
  punti_jolly_vinto  int not null default 10,
  punti_jolly_perso  int not null default -5,
  aggiornato_il      timestamptz not null default now()
);
insert into public.serata default values;

-- ---------------------------------------------------------------------
-- 2. FAMIGLIE E PERSONE
-- ---------------------------------------------------------------------
create table public.famiglie (
  id         uuid primary key default gen_random_uuid(),
  cognome    text not null check (length(trim(cognome)) > 0),
  nickname   text not null check (length(trim(nickname)) > 0),
  foto_path  text,
  creata_da  uuid references auth.users(id) on delete set null,
  creata_il  timestamptz not null default now()
);

create table public.persone (
  id             uuid primary key default gen_random_uuid(),
  famiglia_id    uuid not null references public.famiglie(id) on delete cascade,
  tipo           text not null check (tipo in ('adulto','bimbo')),
  user_id        uuid unique references auth.users(id) on delete cascade,
  nome           text not null check (length(trim(nome)) > 0),
  cognome        text,
  soprannome     text,
  eta            int,
  titolo_buffo   text,
  foto_path      text,          -- adulti: viso · bimbi: foto in pigiama
  presente       boolean not null default false,
  senza_pigiama  boolean not null default false,
  is_admin       boolean not null default false,
  creata_il      timestamptz not null default now(),
  check (tipo = 'adulto' and cognome is not null and length(trim(cognome)) > 0
      or tipo = 'bimbo'  and user_id is null and eta between 0 and 17
                         and titolo_buffo is not null and length(trim(titolo_buffo)) > 0)
);
create index on public.persone (famiglia_id);

-- ---------------------------------------------------------------------
-- 3. FUNZIONI DI SUPPORTO
-- ---------------------------------------------------------------------
create or replace function public.mio_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from persone where user_id = auth.uid()
$$;

create or replace function public.mia_famiglia() returns uuid
language sql stable security definer set search_path = public as $$
  select famiglia_id from persone where user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from persone where user_id = auth.uid()), false)
$$;

create or replace function public.fase_attuale() returns text
language sql stable security definer set search_path = public as $$
  select fase from serata where id = 1
$$;

create or replace function public.iscrizioni_aperte() returns boolean
language sql stable security definer set search_path = public as $$
  select iscrizioni_aperte from serata where id = 1
$$;

-- Famiglie a cui ci si può unire (con meno di 2 adulti): usata durante l'iscrizione
create or replace function public.famiglie_disponibili()
returns table (id uuid, cognome text, nickname text, adulti int)
language sql stable security definer set search_path = public as $$
  select f.id, f.cognome, f.nickname,
         (select count(*)::int from persone p where p.famiglia_id = f.id and p.tipo = 'adulto')
  from famiglie f
  where (select count(*) from persone p where p.famiglia_id = f.id and p.tipo = 'adulto') < 2
  order by f.cognome, f.nickname
$$;

-- ---------------------------------------------------------------------
-- 4. PROTEZIONI SULLE PERSONE
--    Gli ospiti non possono cambiare presenza, pigiama, ruolo admin.
--    Massimo 2 adulti per famiglia.
-- ---------------------------------------------------------------------
create or replace function public.trg_persone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Editor SQL / service role: nessun controllo
  if auth.uid() is null then
    return new;
  end if;

  if not is_admin() then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.presente := false;
      new.senza_pigiama := false;
    else
      new.is_admin      := old.is_admin;
      new.presente      := old.presente;
      new.senza_pigiama := old.senza_pigiama;
      new.user_id       := old.user_id;
      new.tipo          := old.tipo;
      new.famiglia_id   := old.famiglia_id;
    end if;
  elsif tg_op = 'UPDATE' then
    new.is_admin := old.is_admin;   -- il ruolo admin si assegna solo dall'editor SQL
  end if;

  if new.tipo = 'adulto' and
     (select count(*) from persone
       where famiglia_id = new.famiglia_id and tipo = 'adulto' and id <> new.id) >= 2 then
    raise exception 'Questa famiglia ha già 2 adulti';
  end if;
  return new;
end $$;

create trigger persone_protezione
before insert or update on public.persone
for each row execute function public.trg_persone();

-- ---------------------------------------------------------------------
-- 5. PREMI
-- ---------------------------------------------------------------------
create table public.categorie (
  id      int primary key,
  nome    text not null,
  ordine  int not null
);
insert into public.categorie (id, nome, ordine) values
  (1, 'Il pigiama più bello', 1),
  (2, 'Il più divertente',    2),
  (3, 'Pigiama da Ricovero',  3),
  (4, 'Pigiama da Castità',   4);

-- ---------------------------------------------------------------------
-- 6. PRONOSTICI E JOLLY
-- ---------------------------------------------------------------------
create table public.pronostici (
  votante_id    uuid not null references public.persone(id) on delete cascade,
  categoria_id  int  not null references public.categorie(id),
  persona_id    uuid not null references public.persone(id) on delete cascade,
  primary key (votante_id, categoria_id)
);

create table public.pronostici_famiglia (
  votante_id   uuid primary key references public.persone(id) on delete cascade,
  famiglia_id  uuid not null references public.famiglie(id) on delete cascade
);

create table public.jolly (
  votante_id    uuid primary key references public.persone(id) on delete cascade,
  categoria_id  int  not null references public.categorie(id)
);

create or replace function public.trg_pronostici() returns trigger
language plpgsql security definer set search_path = public as $$
declare v persone; t persone;
begin
  if fase_attuale() <> 'pronostici' then
    raise exception 'I pronostici non sono aperti';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select * into v from persone where id = new.votante_id;
  if v.tipo <> 'adulto' or not v.presente then
    raise exception 'Non puoi fare pronostici';
  end if;

  if tg_table_name = 'pronostici' then
    select * into t from persone where id = new.persona_id;
    if t.tipo <> 'adulto' or not t.presente or t.senza_pigiama then
      raise exception 'Questa persona non è in gara';
    end if;
  elsif tg_table_name = 'jolly' then
    if v.senza_pigiama then
      raise exception 'Senza pigiama non puoi giocare il jolly';
    end if;
  end if;
  return new;
end $$;

create trigger pronostici_controllo before insert or update or delete on public.pronostici
for each row execute function public.trg_pronostici();
create trigger pronostici_famiglia_controllo before insert or update or delete on public.pronostici_famiglia
for each row execute function public.trg_pronostici();
create trigger jolly_controllo before insert or update or delete on public.jolly
for each row execute function public.trg_pronostici();

-- ---------------------------------------------------------------------
-- 7. VOTAZIONI: PAGELLE E PREMI
-- ---------------------------------------------------------------------
create table public.pagelle (
  votante_id  uuid not null references public.persone(id) on delete cascade,
  persona_id  uuid not null references public.persone(id) on delete cascade,
  stelle      int  not null check (stelle between 1 and 5),
  confermato  boolean not null default false,
  primary key (votante_id, persona_id)
);

create table public.voti_premi (
  votante_id    uuid not null references public.persone(id) on delete cascade,
  categoria_id  int  not null references public.categorie(id),
  persona_id    uuid not null references public.persone(id) on delete cascade,
  confermato    boolean not null default false,
  primary key (votante_id, categoria_id),
  unique (votante_id, persona_id)          -- mai la stessa persona per due premi
);

create or replace function public.trg_voti() returns trigger
language plpgsql security definer set search_path = public as $$
declare v persone; t persone;
begin
  if fase_attuale() <> 'votazioni' then
    raise exception 'Le votazioni non sono aperte';
  end if;
  if tg_op in ('UPDATE','DELETE') and old.confermato then
    raise exception 'Questo voto è già confermato';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select * into v from persone where id = new.votante_id;
  select * into t from persone where id = new.persona_id;

  if v.tipo <> 'adulto' or not v.presente then
    raise exception 'Non puoi votare';
  end if;
  if not t.presente or t.senza_pigiama then
    raise exception 'Questa persona non può essere votata';
  end if;

  if tg_table_name = 'pagelle' then
    if t.famiglia_id = v.famiglia_id then
      raise exception 'Nelle pagelle puoi votare solo le altre famiglie';
    end if;
  else
    if t.tipo <> 'adulto' then
      raise exception 'I premi sono solo per gli adulti';
    end if;
    if t.id = v.id then
      raise exception 'Non puoi votare te stesso';
    end if;
  end if;
  return new;
end $$;

create trigger pagelle_controllo before insert or update or delete on public.pagelle
for each row execute function public.trg_voti();
create trigger voti_premi_controllo before insert or update or delete on public.voti_premi
for each row execute function public.trg_voti();

-- Conferma dei voti dati fin qui
create or replace function public.conferma_voti() returns void
language plpgsql security definer set search_path = public as $$
begin
  if fase_attuale() <> 'votazioni' then
    raise exception 'Le votazioni non sono aperte';
  end if;
  update pagelle    set confermato = true where votante_id = mio_id() and not confermato;
  update voti_premi set confermato = true where votante_id = mio_id() and not confermato;
end $$;

-- ---------------------------------------------------------------------
-- 8. SPAREGGI
-- ---------------------------------------------------------------------
create table public.spareggi (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  int not null references public.categorie(id),
  candidati     uuid[] not null,
  fine          timestamptz not null,
  vincitore_id  uuid references public.persone(id),
  creato_il     timestamptz not null default now()
);

create table public.voti_spareggio (
  spareggio_id  uuid not null references public.spareggi(id) on delete cascade,
  votante_id    uuid not null references public.persone(id) on delete cascade,
  persona_id    uuid not null references public.persone(id) on delete cascade,
  primary key (spareggio_id, votante_id)
);

create or replace function public.trg_voti_spareggio() returns trigger
language plpgsql security definer set search_path = public as $$
declare s spareggi; v persone;
begin
  select * into s from spareggi where id = new.spareggio_id;
  if s.id is distinct from (select spareggio_id from serata where id = 1)
     or s.vincitore_id is not null or now() > s.fine then
    raise exception 'Lo spareggio è chiuso';
  end if;
  if not (new.persona_id = any (s.candidati)) then
    raise exception 'Candidato non valido';
  end if;
  select * into v from persone where id = new.votante_id;
  if v.tipo <> 'adulto' or not v.presente then
    raise exception 'Non puoi votare';
  end if;
  if new.persona_id = v.id then
    raise exception 'Non puoi votare te stesso';
  end if;
  return new;
end $$;

create trigger voti_spareggio_controllo before insert or update on public.voti_spareggio
for each row execute function public.trg_voti_spareggio();

-- Avvia uno spareggio (solo admin): candidati in parità, durata in secondi
create or replace function public.avvia_spareggio(p_categoria int, p_candidati uuid[], p_secondi int default 30)
returns uuid language plpgsql security definer set search_path = public as $$
declare nuovo uuid;
begin
  if not is_admin() then raise exception 'Solo l''organizzatore'; end if;
  insert into spareggi (categoria_id, candidati, fine)
  values (p_categoria, p_candidati, now() + make_interval(secs => p_secondi))
  returning id into nuovo;
  update serata set spareggio_id = nuovo, aggiornato_il = now() where id = 1;
  return nuovo;
end $$;

-- Aggiunge secondi allo spareggio in corso (solo admin)
create or replace function public.allunga_spareggio(p_secondi int default 15)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo l''organizzatore'; end if;
  update spareggi set fine = greatest(fine, now()) + make_interval(secs => p_secondi)
  where id = (select spareggio_id from serata where id = 1) and vincitore_id is null;
end $$;

-- Chiude lo spareggio: più voti, poi più stelle nelle pagelle, poi sorteggio
create or replace function public.chiudi_spareggio()
returns uuid language plpgsql security definer set search_path = public as $$
declare s spareggi; vince uuid;
begin
  if not is_admin() then raise exception 'Solo l''organizzatore'; end if;
  select * into s from spareggi where id = (select spareggio_id from serata where id = 1);
  if s.id is null then raise exception 'Nessuno spareggio in corso'; end if;

  select c.pid into vince
  from unnest(s.candidati) as c(pid)
  order by (select count(*) from voti_spareggio vs where vs.spareggio_id = s.id and vs.persona_id = c.pid) desc,
           (select coalesce(sum(stelle), 0) from pagelle pg where pg.persona_id = c.pid and pg.confermato) desc,
           random()
  limit 1;

  update spareggi set vincitore_id = vince, fine = least(fine, now()) where id = s.id;
  update serata set spareggio_id = null, aggiornato_il = now() where id = 1;
  return vince;
end $$;

-- ---------------------------------------------------------------------
-- 9. PEGNI, CARTE, KARAOKE
-- ---------------------------------------------------------------------
create table public.pegni (
  id        serial primary key,
  testo     text not null,
  supporto  text check (supporto in ('timer60','timer30','pregi','karaoke','mimo','canzone')),
  attivo    boolean not null default true
);
insert into public.pegni (testo, supporto) values
  ('Indossa il pigiama d''emergenza', null),
  ('Discorso di auguri improvvisato, in rima, di almeno 1 minuto', 'timer60'),
  ('Karaoke: canzone scelta dai bimbi', 'karaoke'),
  ('Mimo: pesca una carta e mima un film', 'mimo'),
  ('Dichiarazione d''amore teatrale al partner, in ginocchio', null),
  ('Cappello da notte fino a fine serata', null),
  ('Televendita: vendi una pantofola in 30 secondi', 'timer30'),
  ('10 pregi del partner in 30 secondi', 'pregi'),
  ('Indovina la canzone: canticchiala a bocca chiusa', 'canzone'),
  ('Faccia da selfie: un selfie con ogni ospite, smorfia scelta dai bimbi', null);

create table public.estrazioni_pegni (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.persone(id) on delete cascade,
  pegno_id    int  not null references public.pegni(id),
  giro        int  not null check (giro in (1, 2)),
  pagato      boolean not null default false,
  creata_il   timestamptz not null default now(),
  unique (persona_id, giro),
  unique (persona_id, pegno_id)
);

create table public.carte (
  id     serial primary key,
  tipo   text not null check (tipo in ('mimo','canzone')),
  testo  text not null,
  usata  boolean not null default false
);

create table public.brani_karaoke (
  id      serial primary key,
  titolo  text not null,
  url     text not null,
  ordine  int not null default 0
);

-- ---------------------------------------------------------------------
-- 10. AVANZAMENTO (solo numeri, mai risultati)
-- ---------------------------------------------------------------------
create or replace function public.avanzamento() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'iscritti',        (select count(*) from persone),
    'presenti',        (select count(*) from persone where presente),
    'adulti_presenti', (select count(*) from persone where presente and tipo = 'adulto'),
    'senza_pigiama',   (select count(*) from persone where presente and senza_pigiama),
    'pronostici_completi', (
       select count(*) from persone v
       where v.presente and v.tipo = 'adulto'
         and exists (select 1 from pronostici_famiglia pf where pf.votante_id = v.id)
         and (select count(*) from pronostici p where p.votante_id = v.id) = (select count(*) from categorie)),
    'voti_completi', (
       select count(*) from persone v
       where v.presente and v.tipo = 'adulto'
         and (select count(*) from voti_premi vp where vp.votante_id = v.id and vp.confermato)
             = (select count(*) from categorie)),
    'bimbi_senza_foto', (
       select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome)), '[]'::jsonb)
       from persone where presente and tipo = 'bimbo' and foto_path is null),
    'spareggio_votanti', (
       select count(*) from voti_spareggio
       where spareggio_id = (select spareggio_id from serata where id = 1))
  )
$$;

-- ---------------------------------------------------------------------
-- 11. RISULTATI (disponibili solo da "premiazione" in poi)
-- ---------------------------------------------------------------------
create or replace function public.risultati() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s            serata;
  c            record;
  out_cat      jsonb := '[]'::jsonb;
  classifica   jsonb;
  top_voti     int;
  in_parita    uuid[];
  vince        uuid;
  vincitori    jsonb := '{}'::jsonb;   -- categoria_id -> persona_id
  fam          jsonb;
  fam_vince    uuid;
  adulti       jsonb;
begin
  select * into s from serata where id = 1;
  if s.fase not in ('premiazione','fine') then
    raise exception 'I risultati non sono ancora disponibili';
  end if;

  -- 4 premi adulti
  for c in select * from categorie order by ordine loop
    select coalesce(jsonb_agg(x order by x.voti desc, x.stelle desc), '[]'::jsonb) into classifica
    from (
      select p.id as persona_id,
             (select count(*) from voti_premi vp
               where vp.categoria_id = c.id and vp.persona_id = p.id and vp.confermato)::int as voti,
             (select coalesce(sum(stelle), 0) from pagelle pg
               where pg.persona_id = p.id and pg.confermato)::int as stelle
      from persone p
      where p.tipo = 'adulto' and p.presente and not p.senza_pigiama
    ) x
    where x.voti > 0;

    top_voti := coalesce((classifica -> 0 ->> 'voti')::int, 0);
    select array_agg((e ->> 'persona_id')::uuid) into in_parita
    from jsonb_array_elements(classifica) e
    where (e ->> 'voti')::int = top_voti and top_voti > 0;

    -- vincitore: spareggio chiuso, oppure unico più votato
    select sp.vincitore_id into vince from spareggi sp
    where sp.categoria_id = c.id and sp.vincitore_id is not null
    order by sp.creato_il desc limit 1;
    if vince is null and coalesce(array_length(in_parita, 1), 0) = 1 then
      vince := in_parita[1];
    end if;
    if vince is not null then
      vincitori := vincitori || jsonb_build_object(c.id::text, vince);
    end if;

    out_cat := out_cat || jsonb_build_object(
      'categoria_id', c.id,
      'nome',         c.nome,
      'classifica',   classifica,
      'vincitore_id', vince,
      'pareggio',     vince is null and coalesce(array_length(in_parita, 1), 0) > 1,
      'in_parita',    to_jsonb(coalesce(in_parita, '{}'::uuid[])),
      'jolly_finalisti', (
         select coalesce(jsonb_agg(j.votante_id), '[]'::jsonb) from jolly j
         where j.categoria_id = c.id
           and j.votante_id in (select (e ->> 'persona_id')::uuid
                                from jsonb_array_elements(classifica) with ordinality as t(e, n)
                                where n <= 3)),
      'indovinato_da', (
         select coalesce(jsonb_agg(v.votante_id), '[]'::jsonb)
         from (select pr.votante_id from pronostici pr
                where pr.categoria_id = c.id and pr.persona_id = vince
                  and not exists (select 1 from jolly j where j.votante_id = pr.votante_id and j.categoria_id = c.id)
               union
               select j.votante_id from jolly j
                where j.categoria_id = c.id and j.votante_id = vince) v)
    );
    vince := null;
  end loop;

  -- Famiglie: media delle stelle per membro presente (bimbi compresi)
  select coalesce(jsonb_agg(f order by f.media desc, f.totale desc), '[]'::jsonb) into fam
  from (
    select fa.id as famiglia_id,
           round(coalesce(sum(st.tot), 0)::numeric / nullif(count(p.id), 0), 2) as media,
           coalesce(sum(st.tot), 0)::int as totale,
           count(p.id)::int as membri
    from famiglie fa
    join persone p on p.famiglia_id = fa.id and p.presente
    left join (select persona_id, sum(stelle) as tot from pagelle where confermato group by persona_id) st
           on st.persona_id = p.id
    group by fa.id
  ) f;
  fam_vince := (fam -> 0 ->> 'famiglia_id')::uuid;

  -- Classifica adulti: pigiama + pronostico + jolly
  select coalesce(jsonb_agg(a order by a.totale desc, a.pigiama desc), '[]'::jsonb) into adulti
  from (
    select p.id as persona_id,
           pig.pigiama,
           pro.pronostico,
           jo.jolly,
           pig.pigiama + pro.pronostico + coalesce(jo.jolly, 0) as totale
    from persone p
    cross join lateral (
      select coalesce(sum(stelle), 0)::int as pigiama
      from pagelle pg where pg.persona_id = p.id and pg.confermato) pig
    cross join lateral (
      select (
        (select count(*) from pronostici pr
          where pr.votante_id = p.id
            and pr.persona_id::text = vincitori ->> pr.categoria_id::text
            and not exists (select 1 from jolly j where j.votante_id = p.id and j.categoria_id = pr.categoria_id))
        + (select count(*) from pronostici_famiglia pf
            where pf.votante_id = p.id and pf.famiglia_id = fam_vince)
      )::int * s.punti_pronostico as pronostico) pro
    cross join lateral (
      select case when j.votante_id is null then null
                  when vincitori ->> j.categoria_id::text = p.id::text then s.punti_jolly_vinto
                  else s.punti_jolly_perso end as jolly
      from (select 1) dummy
      left join jolly j on j.votante_id = p.id) jo
    where p.tipo = 'adulto' and p.presente
  ) a;

  return jsonb_build_object(
    'premi',              out_cat,
    'famiglie',           fam,
    'famiglia_vincitrice', fam_vince,
    'famiglia_indovinata_da', (
       select coalesce(jsonb_agg(votante_id), '[]'::jsonb)
       from pronostici_famiglia where famiglia_id = fam_vince),
    'adulti',             adulti
  );
end $$;

-- ---------------------------------------------------------------------
-- 12. SICUREZZA (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.serata               enable row level security;
alter table public.famiglie             enable row level security;
alter table public.persone              enable row level security;
alter table public.categorie            enable row level security;
alter table public.pronostici           enable row level security;
alter table public.pronostici_famiglia  enable row level security;
alter table public.jolly                enable row level security;
alter table public.pagelle              enable row level security;
alter table public.voti_premi           enable row level security;
alter table public.spareggi             enable row level security;
alter table public.voti_spareggio       enable row level security;
alter table public.pegni                enable row level security;
alter table public.estrazioni_pegni     enable row level security;
alter table public.carte                enable row level security;
alter table public.brani_karaoke        enable row level security;

-- Serata: la leggono tutti gli iscritti, la cambia solo l'organizzatore
create policy serata_lettura on public.serata for select to authenticated using (true);
create policy serata_modifica on public.serata for update to authenticated
  using (is_admin()) with check (is_admin());

-- Famiglie
create policy famiglie_lettura on public.famiglie for select to authenticated
  using (mio_id() is not null or is_admin());
create policy famiglie_creazione on public.famiglie for insert to authenticated
  with check ((iscrizioni_aperte() and mio_id() is null and creata_da = auth.uid()) or is_admin());
create policy famiglie_modifica on public.famiglie for update to authenticated
  using (id = mia_famiglia() or creata_da = auth.uid() or is_admin())
  with check (id = mia_famiglia() or creata_da = auth.uid() or is_admin());
create policy famiglie_eliminazione on public.famiglie for delete to authenticated
  using (is_admin());

-- Persone
create policy persone_lettura on public.persone for select to authenticated
  using (mio_id() is not null or is_admin());
create policy persone_creazione on public.persone for insert to authenticated
  with check (
    is_admin()
    or (iscrizioni_aperte() and tipo = 'adulto' and user_id = auth.uid())
    or (iscrizioni_aperte() and tipo = 'bimbo'  and famiglia_id = mia_famiglia())
  );
create policy persone_modifica on public.persone for update to authenticated
  using (is_admin() or user_id = auth.uid()
         or (tipo = 'bimbo' and famiglia_id = mia_famiglia() and iscrizioni_aperte()))
  with check (is_admin() or user_id = auth.uid()
         or (tipo = 'bimbo' and famiglia_id = mia_famiglia() and iscrizioni_aperte()));
create policy persone_eliminazione on public.persone for delete to authenticated
  using (is_admin() or (tipo = 'bimbo' and famiglia_id = mia_famiglia() and iscrizioni_aperte()));

-- Categorie, pegni, karaoke: lettura per gli iscritti, modifica solo admin
create policy categorie_lettura on public.categorie for select to authenticated using (true);
create policy categorie_admin on public.categorie for all to authenticated
  using (is_admin()) with check (is_admin());

create policy pegni_lettura on public.pegni for select to authenticated using (true);
create policy pegni_admin on public.pegni for all to authenticated
  using (is_admin()) with check (is_admin());

create policy estrazioni_lettura on public.estrazioni_pegni for select to authenticated using (true);
create policy estrazioni_admin on public.estrazioni_pegni for all to authenticated
  using (is_admin()) with check (is_admin());

create policy karaoke_lettura on public.brani_karaoke for select to authenticated using (true);
create policy karaoke_admin on public.brani_karaoke for all to authenticated
  using (is_admin()) with check (is_admin());

-- Carte: le vede solo l'organizzatore
create policy carte_admin on public.carte for all to authenticated
  using (is_admin()) with check (is_admin());

-- Pronostici, jolly, pagelle, voti: ognuno vede e modifica SOLO i propri.
-- Nessuno (nemmeno l'organizzatore) legge quelli degli altri.
create policy pronostici_propri on public.pronostici for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());
create policy pronostici_famiglia_propri on public.pronostici_famiglia for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());
create policy jolly_proprio on public.jolly for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());
create policy pagelle_proprie on public.pagelle for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());
create policy voti_premi_propri on public.voti_premi for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());

-- Spareggi: tutti vedono quello in corso, il proprio voto resta privato
create policy spareggi_lettura on public.spareggi for select to authenticated using (true);
create policy voti_spareggio_propri on public.voti_spareggio for all to authenticated
  using (votante_id = mio_id()) with check (votante_id = mio_id());

-- ---------------------------------------------------------------------
-- 13. FOTO (spazio privato)
--     Percorsi: <id famiglia>/<nome file>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('foto', 'foto', false)
on conflict (id) do nothing;

create policy foto_lettura on storage.objects for select to authenticated
  using (bucket_id = 'foto' and (public.mio_id() is not null or public.is_admin()));
create policy foto_caricamento on storage.objects for insert to authenticated
  with check (bucket_id = 'foto'
              and ((storage.foldername(name))[1] = public.mia_famiglia()::text or public.is_admin()));
create policy foto_modifica on storage.objects for update to authenticated
  using (bucket_id = 'foto'
         and ((storage.foldername(name))[1] = public.mia_famiglia()::text or public.is_admin()));
create policy foto_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'foto'
         and ((storage.foldername(name))[1] = public.mia_famiglia()::text or public.is_admin()));

-- ---------------------------------------------------------------------
-- 14. TEMPO REALE (app e TV seguono la regia)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.serata;
alter publication supabase_realtime add table public.spareggi;
alter publication supabase_realtime add table public.estrazioni_pegni;

-- ---------------------------------------------------------------------
-- 15. PERMESSI SULLE FUNZIONI
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.mio_id(), public.mia_famiglia(), public.is_admin(),
                          public.fase_attuale(), public.iscrizioni_aperte(),
                          public.famiglie_disponibili(), public.conferma_voti(),
                          public.avvia_spareggio(int, uuid[], int), public.allunga_spareggio(int),
                          public.chiudi_spareggio(), public.avanzamento(), public.risultati()
  to authenticated;

-- =====================================================================
-- FINE. Dopo esserti iscritto dall'app, rendi admin il tuo account con:
--   update public.persone set is_admin = true
--   where user_id = (select id from auth.users where email = 'LA-TUA-EMAIL');
-- =====================================================================
