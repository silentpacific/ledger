-- Applied to ledger-db on 26 Nov 2026 (via Supabase connector). Kept here for the record.
alter function public.detect_change() set search_path = '';
alter function public.record_price(bigint, numeric, numeric, boolean, timestamptz, text) set search_path = '';
alter function public.ingest_scan(jsonb) set search_path = '';

alter table public.domains
  add column if not exists homepage_url text,
  add column if not exists scan_enabled boolean not null default true,
  add column if not exists last_scan_error text;

create or replace function public.domains_due(p_limit int default 100)
returns table (domain text, homepage_url text, platform text)
language sql set search_path = '' as $$
  select d.domain, d.homepage_url, d.platform
    from public.domains d
   where d.scan_enabled and not d.opted_out and d.homepage_url is not null
   order by d.last_scanned_at nulls first, d.domain
   limit p_limit;
$$;

create or replace function public.record_scan_error(p_domain text, p_error text)
returns void language sql set search_path = '' as $$
  update public.domains set last_scan_error = left(p_error, 2000) where domain = p_domain;
$$;
-- (The 37 jewellery sites were inserted into public.domains at the same time.)
