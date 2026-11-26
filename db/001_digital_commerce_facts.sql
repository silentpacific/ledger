-- Digital Commerce Facts: database v1
-- Paste into the Supabase SQL editor and run once.
-- Every table is append-friendly: scans add observations; nothing is overwritten,
-- so history and change events build up automatically.
-- Row Level Security is on for every table with no public policies:
-- only the service-role key (server-side) can read or write.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Domains: one row per website tracked
-- ---------------------------------------------------------------------------
create table public.domains (
  id               bigint generated always as identity primary key,
  domain           text not null unique,
  site_type        text check (site_type in ('ecommerce','marketplace','saas','services','lead_gen')),
  segment          text,
  country          text not null default 'AU',
  platform         text,
  opted_out        boolean not null default false,   -- honour removal requests
  first_scanned_at timestamptz,
  last_scanned_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scans: one row per scan run; raw payload kept for re-processing
-- ---------------------------------------------------------------------------
create table public.scans (
  id             uuid primary key default gen_random_uuid(),
  domain_id      bigint not null references public.domains(id) on delete cascade,
  started_at     timestamptz not null,
  finished_at    timestamptz,
  schema_version text not null,
  scanner        text,
  scan_location  text,
  device         text,
  logged_in      boolean not null default false,
  status         text not null check (status in ('complete','partial','failed')),
  robots_note    text,
  issues         jsonb not null default '[]'::jsonb,
  raw_payload    jsonb not null,
  created_at     timestamptz not null default now(),
  unique (domain_id, started_at)                      -- the same scan can't be loaded twice
);

create table public.scan_pages (
  id             bigint generated always as identity primary key,
  scan_id        uuid not null references public.scans(id) on delete cascade,
  url            text not null,
  http_status    int,
  robots_allowed boolean,
  fetch_method   text,
  content_hash   text,                                -- change detection for policy pages
  note           text
);

-- ---------------------------------------------------------------------------
-- Fact definitions: the catalogue of fields (auto-registered on first sight)
-- ---------------------------------------------------------------------------
create table public.fact_definitions (
  key             text primary key,
  category        text not null check (category in (
                    'site_identity','policies','shipping','products','promotions','payments',
                    'tech_stack','journey_performance','trust_support','external_reviews',
                    'loyalty','content_marketing','ai_readiness')),
  value_type      text,
  unit            text,
  description     text,
  auto_registered boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Observations: append-only; one row per fact per scan
-- ---------------------------------------------------------------------------
create table public.observations (
  id                bigint generated always as identity primary key,
  scan_id           uuid not null references public.scans(id) on delete cascade,
  domain_id         bigint not null references public.domains(id) on delete cascade,
  fact_key          text not null references public.fact_definitions(key),
  status            text not null check (status in (
                      'observed','not_observed','not_offered','not_applicable','inferred','conflicting')),
  value             jsonb,
  unit              text,
  source_url        text,
  evidence          text,
  evidence_verified boolean,          -- set by the scanner: evidence text found on the fetched page
  method            text check (method in ('code','structured_data','ai_text','ai_vision','external_api')),
  confidence        text check (confidence in ('high','medium','low')),
  note              text,
  observed_at       timestamptz not null,
  unique (scan_id, fact_key)
);
create index observations_domain_fact_time on public.observations (domain_id, fact_key, observed_at desc);

-- ---------------------------------------------------------------------------
-- Change events: written automatically when a fact differs from the last scan
-- ---------------------------------------------------------------------------
create table public.change_events (
  id                      bigint generated always as identity primary key,
  domain_id               bigint not null references public.domains(id) on delete cascade,
  fact_key                text not null references public.fact_definitions(key),
  event_type              text not null check (event_type in ('value_changed','status_changed')),
  previous_status         text,
  previous_value          jsonb,
  new_status              text not null,
  new_value               jsonb,
  previous_observed_at    timestamptz,
  detected_at             timestamptz not null,
  likely_scanner_gap      boolean not null default false,  -- fact vanished: probably a missed read, not a real change
  previous_observation_id bigint references public.observations(id) on delete set null,
  new_observation_id      bigint not null references public.observations(id) on delete cascade,
  created_at              timestamptz not null default now()
);
create index change_events_domain_time on public.change_events (domain_id, detected_at desc);

create or replace function public.detect_change() returns trigger
language plpgsql as $$
declare
  prev public.observations%rowtype;
begin
  select * into prev
    from public.observations
   where domain_id = new.domain_id
     and fact_key  = new.fact_key
     and scan_id  <> new.scan_id
     and observed_at < new.observed_at
   order by observed_at desc
   limit 1;

  if found and (prev.status is distinct from new.status or prev.value is distinct from new.value) then
    insert into public.change_events (
      domain_id, fact_key, event_type,
      previous_status, previous_value, new_status, new_value,
      previous_observed_at, detected_at, likely_scanner_gap,
      previous_observation_id, new_observation_id)
    values (
      new.domain_id, new.fact_key,
      case when prev.status is distinct from new.status then 'status_changed' else 'value_changed' end,
      prev.status, prev.value, new.status, new.value,
      prev.observed_at, new.observed_at,
      (prev.status = 'observed' and new.status = 'not_observed'),
      prev.id, new.id);
  end if;
  return new;
end $$;

create trigger observations_detect_change
  after insert on public.observations
  for each row execute function public.detect_change();

-- ---------------------------------------------------------------------------
-- Promotions: one row per distinct promotion, with every sighting
-- ---------------------------------------------------------------------------
create table public.promotions (
  id            bigint generated always as identity primary key,
  domain_id     bigint not null references public.domains(id) on delete cascade,
  promo_key     text not null,          -- md5 of normalised name + stated start
  name          text not null,
  promo_type    text,
  discount      text,
  stated_start  date,
  stated_end    date,
  source        text,                   -- homepage, offer T&Cs page, etc.
  first_seen_at timestamptz not null,
  last_seen_at  timestamptz not null,
  times_seen    int not null default 1,
  unique (domain_id, promo_key)
);

create table public.promotion_sightings (
  id           bigint generated always as identity primary key,
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  scan_id      uuid not null references public.scans(id) on delete cascade,
  seen_at      timestamptz not null,
  live         boolean not null,        -- shown as running now, vs listed in historic terms
  placement    text[],
  unique (promotion_id, scan_id)
);

-- ---------------------------------------------------------------------------
-- Products and prices: change-only price periods (watch list)
-- ---------------------------------------------------------------------------
create table public.products (
  id            bigint generated always as identity primary key,
  domain_id     bigint not null references public.domains(id) on delete cascade,
  external_id   text not null,          -- e.g. Shopify product id
  handle        text,
  title         text,
  product_type  text,
  url           text,
  gtin          text,
  first_seen_at timestamptz not null,
  last_seen_at  timestamptz not null,
  unique (domain_id, external_id)
);

create table public.price_periods (
  id                bigint generated always as identity primary key,
  product_id        bigint not null references public.products(id) on delete cascade,
  price             numeric(12,2),
  compare_at_price  numeric(12,2),
  currency          text not null default 'AUD',
  available         boolean,
  valid_from        timestamptz not null,
  valid_to          timestamptz,          -- null = current
  last_confirmed_at timestamptz not null
);
create index price_periods_product_current on public.price_periods (product_id) where valid_to is null;

-- Records a price reading: extends the current period if nothing changed, else opens a new one.
create or replace function public.record_price(
  p_product_id bigint, p_price numeric, p_compare_at numeric, p_available boolean,
  p_seen_at timestamptz, p_currency text default 'AUD')
returns void language plpgsql as $$
declare
  cur public.price_periods%rowtype;
begin
  select * into cur from public.price_periods
   where product_id = p_product_id and valid_to is null
   for update;

  if found and cur.price is not distinct from p_price
           and cur.compare_at_price is not distinct from p_compare_at
           and cur.available is not distinct from p_available then
    update public.price_periods set last_confirmed_at = p_seen_at where id = cur.id;
  else
    if found then
      update public.price_periods set valid_to = p_seen_at where id = cur.id;
    end if;
    insert into public.price_periods (product_id, price, compare_at_price, currency, available,
                                      valid_from, last_confirmed_at)
    values (p_product_id, p_price, p_compare_at, p_currency, p_available, p_seen_at, p_seen_at);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ingest: load one scan file (the JSON format the scanner produces)
-- ---------------------------------------------------------------------------
create or replace function public.ingest_scan(payload jsonb) returns uuid
language plpgsql as $$
declare
  s          jsonb := payload->'scan';
  v_domain   bigint;
  v_scan     uuid;
  v_started  timestamptz := (payload->'scan'->>'scan_started_at')::timestamptz;
  f          jsonb;
  p          jsonb;
  v_key      text;
  v_promo    bigint;
  v_product  bigint;
begin
  if s is null or s->>'domain' is null or v_started is null then
    raise exception 'payload needs scan.domain and scan.scan_started_at';
  end if;

  insert into public.domains (domain, site_type, segment, first_scanned_at, last_scanned_at)
  values (lower(s->>'domain'), s->>'site_type', s->>'segment', v_started, v_started)
  on conflict (domain) do update
    set site_type       = coalesce(excluded.site_type, domains.site_type),
        segment         = coalesce(excluded.segment, domains.segment),
        first_scanned_at = least(domains.first_scanned_at, excluded.first_scanned_at),
        last_scanned_at  = greatest(domains.last_scanned_at, excluded.last_scanned_at)
  returning id into v_domain;

  if (select opted_out from public.domains where id = v_domain) then
    raise exception 'domain % has opted out; scan not stored', s->>'domain';
  end if;

  insert into public.scans (domain_id, started_at, finished_at, schema_version, scanner,
                            scan_location, device, logged_in, status, robots_note, issues, raw_payload)
  values (v_domain, v_started, (s->>'scan_finished_at')::timestamptz,
          coalesce(s->>'schema_version','unknown'), s->>'scanner', s->>'scan_location', s->>'device',
          coalesce((s->>'logged_in')::boolean, false), coalesce(s->>'scan_status','partial'),
          s->>'robots_txt_respected', coalesce(payload->'issues_found','[]'::jsonb), payload)
  returning id into v_scan;

  -- pages fetched
  for p in select * from jsonb_array_elements(coalesce(s->'pages_fetched','[]'::jsonb)) loop
    insert into public.scan_pages (scan_id, url, http_status, robots_allowed, fetch_method, content_hash, note)
    values (v_scan, p->>'url', (p->>'status')::int, (p->>'robots_allowed')::boolean,
            p->>'fetch_method', p->>'content_hash', p->>'note');
  end loop;

  -- facts
  for f in select * from jsonb_array_elements(coalesce(payload->'facts','[]'::jsonb)) loop
    -- keys are namespaced by category, e.g. policies.returns.period_days
    v_key := f->>'key';
    if v_key not like (f->>'category') || '.%' then
      v_key := (f->>'category') || '.' || v_key;
    end if;

    insert into public.fact_definitions (key, category, value_type, unit, auto_registered)
    values (v_key, f->>'category', jsonb_typeof(f->'value'), f->>'unit', true)
    on conflict (key) do nothing;

    insert into public.observations (scan_id, domain_id, fact_key, status, value, unit, source_url,
                                     evidence, evidence_verified, method, confidence, note, observed_at)
    values (v_scan, v_domain, v_key, f->>'status',
            case when jsonb_typeof(f->'value') = 'null' then null else f->'value' end,
            f->>'unit', f->>'source_url', f->>'evidence', (f->>'evidence_verified')::boolean,
            f->>'method', f->>'confidence', f->>'note',
            coalesce((f->>'observed_at')::timestamptz, v_started));
  end loop;

  -- live promotions (seen on the site now)
  for p in select * from jsonb_array_elements(coalesce(payload->'promotions','[]'::jsonb)) loop
    insert into public.promotions (domain_id, promo_key, name, promo_type, discount,
                                   stated_start, stated_end, source, first_seen_at, last_seen_at)
    values (v_domain, md5(lower(trim(p->>'headline')) || coalesce(p->>'starts','')),
            p->>'headline', p->>'type', p->>'discount',
            (p->>'starts')::date, (p->>'ends')::date, p->>'source', v_started, v_started)
    on conflict (domain_id, promo_key) do update
      set last_seen_at = greatest(promotions.last_seen_at, excluded.last_seen_at),
          stated_end   = coalesce(excluded.stated_end, promotions.stated_end),
          times_seen   = promotions.times_seen + 1
    returning id into v_promo;

    insert into public.promotion_sightings (promotion_id, scan_id, seen_at, live, placement)
    values (v_promo, v_scan, v_started, true,
            array(select jsonb_array_elements_text(coalesce(p->'placement','[]'::jsonb))))
    on conflict (promotion_id, scan_id) do nothing;
  end loop;

  -- historic promotions listed in the site's own offer terms
  for p in select * from jsonb_array_elements(coalesce(payload->'promotion_history_from_terms_page','[]'::jsonb)) loop
    insert into public.promotions (domain_id, promo_key, name, promo_type, stated_start, stated_end,
                                   source, first_seen_at, last_seen_at)
    values (v_domain, md5(lower(trim(p->>'name')) || coalesce(p->>'starts','')),
            p->>'name', p->>'type', (p->>'starts')::date, (p->>'ends')::date,
            'offer_terms_page', v_started, v_started)
    on conflict (domain_id, promo_key) do update
      set last_seen_at = greatest(promotions.last_seen_at, excluded.last_seen_at)
    returning id into v_promo;

    insert into public.promotion_sightings (promotion_id, scan_id, seen_at, live)
    values (v_promo, v_scan, v_started, false)
    on conflict (promotion_id, scan_id) do nothing;
  end loop;

  -- watch-list products (optional array; prices parsed by code, not AI)
  for p in select * from jsonb_array_elements(coalesce(payload->'products','[]'::jsonb)) loop
    insert into public.products (domain_id, external_id, handle, title, product_type, url, gtin,
                                 first_seen_at, last_seen_at)
    values (v_domain, p->>'external_id', p->>'handle', p->>'title', p->>'product_type', p->>'url',
            p->>'gtin', v_started, v_started)
    on conflict (domain_id, external_id) do update
      set title = excluded.title, last_seen_at = excluded.last_seen_at
    returning id into v_product;

    perform public.record_price(v_product, (p->>'price')::numeric, (p->>'compare_at_price')::numeric,
                                (p->>'available')::boolean, v_started, coalesce(p->>'currency','AUD'));
  end loop;

  return v_scan;
end $$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
-- Latest value of every fact for every domain
create view public.current_facts with (security_invoker = true) as
select distinct on (o.domain_id, o.fact_key)
       d.domain, fd.category, o.fact_key, o.status, o.value, o.unit, o.confidence, o.method,
       o.evidence, o.evidence_verified, o.source_url, o.observed_at, o.domain_id
  from public.observations o
  join public.domains d on d.id = o.domain_id
  join public.fact_definitions fd on fd.key = o.fact_key
 order by o.domain_id, o.fact_key, o.observed_at desc;

-- Automated quality gate (no manual review): what may be shown or sold
create view public.publishable_facts with (security_invoker = true) as
select *
  from public.current_facts
 where status in ('observed','not_offered','inferred')
   and (confidence = 'high'
        or (confidence = 'medium' and evidence_verified is true)
        or method in ('code','structured_data'));

-- Real changes only (scanner gaps filtered out)
create view public.change_feed with (security_invoker = true) as
select d.domain, fd.category, c.fact_key, c.event_type,
       c.previous_value, c.new_value, c.previous_status, c.new_status,
       c.previous_observed_at, c.detected_at
  from public.change_events c
  join public.domains d on d.id = c.domain_id
  join public.fact_definitions fd on fd.key = c.fact_key
 where not c.likely_scanner_gap
 order by c.detected_at desc;

-- Promotion timeline per domain
create view public.promotion_timeline with (security_invoker = true) as
select d.domain, p.name, p.promo_type, p.discount,
       coalesce(p.stated_start, p.first_seen_at::date) as starts,
       coalesce(p.stated_end,   p.last_seen_at::date)  as ends,
       p.source, p.times_seen,
       exists (select 1 from public.promotion_sightings s where s.promotion_id = p.id and s.live) as seen_live
  from public.promotions p
  join public.domains d on d.id = p.domain_id
 order by d.domain, starts desc;

-- ---------------------------------------------------------------------------
-- Security: RLS on, no public policies; ingest callable by the service role only
-- ---------------------------------------------------------------------------
alter table public.domains             enable row level security;
alter table public.scans               enable row level security;
alter table public.scan_pages          enable row level security;
alter table public.fact_definitions    enable row level security;
alter table public.observations        enable row level security;
alter table public.change_events       enable row level security;
alter table public.promotions          enable row level security;
alter table public.promotion_sightings enable row level security;
alter table public.products            enable row level security;
alter table public.price_periods       enable row level security;

revoke execute on function public.ingest_scan(jsonb) from public;
revoke execute on function public.record_price(bigint, numeric, numeric, boolean, timestamptz, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.ingest_scan(jsonb) from anon, authenticated';
    execute 'revoke execute on function public.record_price(bigint, numeric, numeric, boolean, timestamptz, text) from anon, authenticated';
    execute 'grant execute on function public.ingest_scan(jsonb) to service_role';
  end if;
end $$;
