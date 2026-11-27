-- Applied 27 Nov 2026 via Supabase MCP (migration "web_views"). Approved by Rahul 27 Nov 2026.
-- The website no longer downloads every store. Pages read only what they show:
--   web_views          page numbers worked out after each scan by web/scripts/build-views.ts (one row per page + filter)
--   web_site_index     one short row per store: name, industry, list tags, table row, homepage record card
-- Read functions (publishable key):
--   web_view(key)                          one page's worked-out numbers
--   web_site(domain) / web_sites_in(list)  full facts for one store / a few stores (store page, compare)
--   web_site_list(industry, tags, words, limit, offset)   one page of the stores table, filtered, with the total
--   web_site_card(domain)                  the homepage record for one store
--   web_sitemap()                          every store's address and last scan
--   web_promotions(domains) / web_changes(days, domains)  now optionally for some stores only
--   web_promo_calendar(...)                the promotions calendar for one month or year, worked out here
--   web_promo_search(words)                promotions matching search words
-- Write function (service key only, called by the builder): publish_web_data(index, views) replaces both tables.

create table if not exists public.web_views (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.web_site_index (
  domain text primary key,
  name text not null,
  industry text not null,
  pos integer not null,              -- position in name order (the site's own sort)
  search text not null,              -- lower-case name + domain, for word matching
  tags text[] not null default '{}', -- 'payments:afterpay', 'tech:klaviyo', 'platform:shopify', 'policy:free-returns'
  row jsonb not null,                -- what the stores tables show
  card jsonb not null,               -- the homepage record
  last_scanned_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists web_site_index_tags on public.web_site_index using gin (tags);
create index if not exists web_site_index_ind on public.web_site_index (industry, pos);
alter table public.web_views enable row level security;
alter table public.web_site_index enable row level security;

create or replace function public.web_view(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select data from public.web_views where key = p_key;
$$;

-- same shape as one web_sites() entry
create or replace function public.web_sites_in(p_domains text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'domain'), '[]'::jsonb) from (
    select jsonb_build_object(
      'domain', d.domain, 'industry', d.industry, 'segment', d.segment, 'platform', d.platform, 'homepage_url', d.homepage_url,
      'first_scanned_at', d.first_scanned_at, 'last_scanned_at', d.last_scanned_at,
      'facts', coalesce((select jsonb_object_agg(f.fact_key, jsonb_build_object(
                  's', f.status, 'v', f.value, 'at', f.observed_at, 'q', left(f.evidence, 300), 'u', f.source_url, 'c', f.confidence))
                from public.publishable_facts f
               where f.domain_id = d.id
                 and f.fact_key not like 'tech_stack.detected.%'
                 and f.fact_key not like 'content_marketing.pages_updated%'), '{}'::jsonb)) x
    from public.domains d
   where d.domain = any (p_domains[1:10])
     and d.scan_enabled and not coalesce(d.opted_out, false)
     and exists (select 1 from public.scans s where s.domain_id = d.id and s.status <> 'failed')
  ) t;
$$;

create or replace function public.web_site(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.web_sites_in(array[p_domain]) -> 0;
$$;

create or replace function public.web_site_list(p_industry text default null, p_tags text[] default '{}', p_words text[] default '{}',
                                                p_limit int default 50, p_offset int default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (
    select * from public.web_site_index i
     where (p_industry is null or i.industry = p_industry)
       and i.tags @> coalesce(p_tags, '{}')
       and not exists (select 1 from unnest(coalesce(p_words, '{}')) w where position(w in i.search) = 0))
  select jsonb_build_object(
    'total', (select count(*) from m),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('domain', domain, 'name', name, 'industry', industry) || row order by pos)
                        from (select * from m order by pos limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) p), '[]'::jsonb));
$$;

create or replace function public.web_site_card(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select card from public.web_site_index where domain = p_domain;
$$;

create or replace function public.web_sitemap() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('domain', domain, 'last_scanned_at', last_scanned_at) order by pos), '[]'::jsonb)
    from public.web_site_index;
$$;

-- promotions and changes, optionally for some stores only (null = every store, as before)
drop function if exists public.web_promotions();
create or replace function public.web_promotions(p_domains text[] default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (s.domain_id) s.domain_id, s.id scan_id from public.scans s
     where s.status <> 'failed' order by s.domain_id, s.started_at desc)
  select coalesce(jsonb_agg(jsonb_build_object(
    'domain', d.domain, 'name', p.name, 'type', p.promo_type, 'discount', p.discount,
    'starts', p.stated_start, 'ends', p.stated_end, 'first_seen', p.first_seen_at, 'last_seen', p.last_seen_at,
    'times_seen', p.times_seen, 'source', p.source,
    'live', exists (select 1 from public.promotion_sightings ps join latest l on l.scan_id = ps.scan_id
                     where ps.promotion_id = p.id and ps.live))
    order by d.domain, p.first_seen_at desc), '[]'::jsonb)
  from public.promotions p join public.domains d on d.id = p.domain_id
  where d.scan_enabled and not coalesce(d.opted_out, false)
    and (p_domains is null or d.domain = any (p_domains));
$$;

drop function if exists public.web_changes(integer);
create or replace function public.web_changes(p_days integer default 90, p_domains text[] default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'domain', c.domain, 'category', c.category, 'key', c.fact_key, 'type', c.event_type,
    'from', c.previous_value, 'to', c.new_value, 'from_status', c.previous_status, 'to_status', c.new_status,
    'at', c.detected_at,
    'confirmed', exists (select 1 from public.current_facts f where f.domain = c.domain and f.fact_key = c.fact_key
                          and f.observed_at > c.detected_at + interval '1 hour'
                          and f.value is not distinct from c.new_value))
    order by c.detected_at desc), '[]'::jsonb)
  from public.change_feed c join public.domains d on d.domain = c.domain
  where c.detected_at > now() - make_interval(days => greatest(1, least(p_days, 730)))
    and d.scan_enabled and not coalesce(d.opted_out, false)
    and (p_domains is null or c.domain = any (p_domains));
$$;

-- Promotions with the calendar's rules (same as the page had in code):
--   span: stated start (else first seen) to stated end (else today if live, else last seen), at least one day
--   live: seen in the store's latest scan and not past its stated end
--   discount: a "N%" in the name or text, or a discount-like type
create or replace function public.web_promo_rows(p_industry text default null) returns table (
  domain text, store text, industry text, pos int, name text, type text, discount text, starts timestamptz, ends timestamptz,
  first_seen timestamptz, last_seen timestamptz, live boolean, pct int, is_discount boolean, a timestamptz, b timestamptz)
language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (s.domain_id) s.domain_id, s.id scan_id from public.scans s
     where s.status <> 'failed' order by s.domain_id, s.started_at desc),
  p as (
    select d.domain, i.name store, i.industry, i.pos, p.name, p.promo_type type, p.discount,
           p.stated_start::timestamptz starts, p.stated_end::timestamptz ends, p.first_seen_at first_seen, p.last_seen_at last_seen,
           exists (select 1 from public.promotion_sightings ps join latest l on l.scan_id = ps.scan_id
                    where ps.promotion_id = p.id and ps.live)
             and (p.stated_end is null or p.stated_end::date >= (now() at time zone 'utc')::date) live,
           coalesce((select max(m[1]::int) from regexp_matches(p.name || ' ' || coalesce(p.discount, ''), '(\d{1,2})\s*%', 'g') m), 0) pct
      from public.promotions p
      join public.domains d on d.id = p.domain_id
      join public.web_site_index i on i.domain = d.domain
     where d.scan_enabled and not coalesce(d.opted_out, false)
       and (p_industry is null or i.industry = p_industry))
  select p.*, p.pct > 0 or coalesce(p.type, '') in ('percent_off', 'dollar_off', 'bogo', 'gift_with_purchase'),
         coalesce(p.starts, p.first_seen),
         greatest(case when p.ends is not null then p.ends + interval '1 day' when p.live then now() else p.last_seen + interval '1 day' end,
                  coalesce(p.starts, p.first_seen) + interval '1 day')
    from p;
$$;
revoke execute on function public.web_promo_rows(text) from public, anon, authenticated;

create or replace function public.web_promo_calendar(p_from timestamptz, p_to timestamptz, p_industry text default null,
                                                     p_type text default null, p_year boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  with r as (select * from public.web_promo_rows(p_industry)),
  w as (select * from r where r.b > p_from and r.a < p_to),
  pick as (select * from w where case when p_type is not null then w.type = p_type else w.is_discount end),
  shown as (
    select * from pick where p_year
    union all
    select distinct on (domain) * from pick where not p_year order by domain, pct desc),
  top as (select * from shown order by industry, pos, pct desc limit 200),
  dl as (select * from r where live and is_discount)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('domain', domain, 'store', store, 'industry', industry, 'name', name,
                        'discount', discount, 'starts', starts, 'ends', ends, 'live', live, 'pct', pct, 'a', a, 'b', b)
                        order by industry, pos, pct desc) from top), '[]'::jsonb),
    'shown', (select count(*) from shown),
    'discount_stores', (select count(distinct domain) from w where is_discount),
    'types', coalesce((select jsonb_object_agg(type, n) from (select type, count(distinct domain) n from w where type is not null group by type) t), '{}'::jsonb),
    'sites', (select count(*) from public.web_site_index i where p_industry is null or i.industry = p_industry),
    'live_sites', (select count(distinct domain) from r where live),
    'discount_sites', (select count(distinct domain) from dl),
    'deepest', (select jsonb_build_object('pct', pct, 'domain', domain, 'store', store) from dl order by pct desc limit 1),
    'bf_sites', (select count(distinct domain) from r where live and (name || ' ' || coalesce(discount, '')) ~* 'black friday'));
$$;

create or replace function public.web_promo_search(p_words text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('domain', domain, 'store', store, 'name', name, 'discount', discount,
                    'starts', starts, 'ends', ends, 'live', live, 'last_seen', last_seen) order by live desc, first_seen desc), '[]'::jsonb)
    from (select * from public.web_promo_rows(null) r
           where cardinality(p_words) > 0
             and not exists (select 1 from unnest(p_words) w
                              where position(w in lower(r.name || ' ' || coalesce(r.discount, '') || ' ' || r.store)) = 0)
           order by live desc, first_seen desc limit 40) t;
$$;

-- builder only: replace the index and the page numbers in one go
create or replace function public.publish_web_data(p_index jsonb, p_views jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_idx int; n_views int;
begin
  delete from public.web_site_index where true;
  insert into public.web_site_index (domain, name, industry, pos, search, tags, row, card, last_scanned_at)
  select x->>'domain', x->>'name', x->>'industry', (x->>'pos')::int, x->>'search',
         array(select jsonb_array_elements_text(x->'tags')), x->'row', x->'card', (x->>'last_scanned_at')::timestamptz
    from jsonb_array_elements(p_index) x;
  get diagnostics n_idx = row_count;
  delete from public.web_views where not (key in (select jsonb_object_keys(p_views)));
  insert into public.web_views (key, data, updated_at)
  select k, v, now() from jsonb_each(p_views) e(k, v)
  on conflict (key) do update set data = excluded.data, updated_at = now();
  get diagnostics n_views = row_count;
  return jsonb_build_object('stores', n_idx, 'views', n_views);
end;
$$;
revoke execute on function public.publish_web_data(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_web_data(jsonb, jsonb) to service_role;

grant execute on function public.web_view(text), public.web_sites_in(text[]), public.web_site(text),
  public.web_site_list(text, text[], text[], int, int), public.web_site_card(text), public.web_sitemap(),
  public.web_promotions(text[]), public.web_changes(integer, text[]),
  public.web_promo_calendar(timestamptz, timestamptz, text, text, boolean), public.web_promo_search(text[]) to anon, authenticated;

-- Applied 27 Nov 2026 (migration "not_featured"): stores never put forward as examples, kept out of the public code.
create table if not exists public.not_featured (domain text primary key, reason text, added_at timestamptz not null default now());
alter table public.not_featured enable row level security;
-- (one row inserted; see the table)
