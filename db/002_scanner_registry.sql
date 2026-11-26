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

-- Terms gate (applied 26 Nov 2026)
alter table public.domains
  add column if not exists terms_checked_at timestamptz,
  add column if not exists terms_url text,
  add column if not exists terms_verdict text check (terms_verdict in ('allowed','prohibited','no_terms_found','unclear')),
  add column if not exists terms_evidence text;

create or replace function public.record_terms_check(p_domain text, p_url text, p_verdict text, p_evidence text)
returns void language sql set search_path = '' as $$
  update public.domains
     set terms_checked_at = now(), terms_url = p_url, terms_verdict = p_verdict,
         terms_evidence = left(p_evidence, 1000),
         scan_enabled = case when p_verdict = 'prohibited' then false else scan_enabled end
   where domain = p_domain;
$$;
