-- Sites that don't want to be scraped: every terms check is logged, and a view lists
-- refusing sites with the quote, when we last checked, and whether they look ready to re-add.

alter table public.domains drop constraint if exists domains_terms_verdict_check;
alter table public.domains add constraint domains_terms_verdict_check
  check (terms_verdict is null or terms_verdict in ('allowed','prohibited','unclear','no_terms_found','blocked'));

create table if not exists public.terms_checks (
  id          bigserial primary key,
  domain_id   bigint not null references public.domains(id) on delete cascade,
  checked_at  timestamptz not null default now(),
  verdict     text not null check (verdict in ('allowed','prohibited','unclear','no_terms_found','blocked')),
  terms_url   text,
  quote       text
);
create index if not exists terms_checks_domain_idx on public.terms_checks (domain_id, checked_at desc);
alter table public.terms_checks enable row level security;
revoke all on public.terms_checks from anon, authenticated;

-- backfill from what the scanner has recorded so far
insert into public.terms_checks (domain_id, checked_at, verdict, terms_url, quote)
select id, terms_checked_at, terms_verdict, terms_url, nullif(terms_evidence, '')
from public.domains
where terms_verdict is not null
  and not exists (select 1 from public.terms_checks t where t.domain_id = domains.id);

-- 'blocked' = the site refused our crawler outright (e.g. 403 on the homepage)
create or replace function public.record_terms_check(p_domain text, p_url text, p_verdict text, p_evidence text)
returns void language plpgsql set search_path = '' as $$
begin
  update public.domains
     set terms_checked_at = now(), terms_url = p_url, terms_verdict = p_verdict,
         terms_evidence = left(p_evidence, 1000),
         scan_enabled = case when p_verdict in ('prohibited','blocked') then false else scan_enabled end
   where domain = p_domain;
  insert into public.terms_checks (domain_id, verdict, terms_url, quote)
  select id, p_verdict, p_url, nullif(left(p_evidence, 1000), '') from public.domains where domain = p_domain;
end $$;
revoke all on function public.record_terms_check(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_terms_check(text, text, text, text) to service_role;

-- Switched-off sites, for the monthly terms-only recheck
create or replace function public.domains_refusing()
returns table (domain text, homepage_url text)
language sql stable set search_path = '' as $$
  select d.domain, coalesce(d.homepage_url, 'https://' || d.domain || '/')
  from public.domains d
  where not d.scan_enabled and not coalesce(d.opted_out, false)
    and d.terms_verdict in ('prohibited','blocked');
$$;
revoke all on function public.domains_refusing() from public, anon, authenticated;
grant execute on function public.domains_refusing() to service_role;

create or replace view public.sites_refusing_scraping with (security_invoker = true) as
with refused as (
  select domain_id, min(checked_at) first_refused_at
  from public.terms_checks where verdict in ('prohibited','blocked') group by domain_id
), latest as (
  select distinct on (domain_id) domain_id, checked_at, verdict, terms_url, quote
  from public.terms_checks order by domain_id, checked_at desc
)
select d.domain,
       case when coalesce(d.opted_out, false) then 'asked us to stop'
            when l.verdict = 'prohibited' then 'terms ban scraping'
            when l.verdict = 'blocked' then 'site blocks our crawler'
            else 'was refusing; latest check: ' || l.verdict end            as reason,
       l.terms_url, l.quote,
       r.first_refused_at, l.checked_at as last_checked_at, l.verdict as latest_verdict,
       d.scan_enabled,
       (not d.scan_enabled and l.verdict not in ('prohibited','blocked')
        and not coalesce(d.opted_out, false))                                as ready_to_readd
from public.domains d
join refused r on r.domain_id = d.id
join latest  l on l.domain_id = d.id
union all
select d.domain, 'asked us to stop', null, null, null, null, null, d.scan_enabled, false
from public.domains d
where coalesce(d.opted_out, false) and not exists (select 1 from refused r where r.domain_id = d.id);
revoke all on public.sites_refusing_scraping from anon, authenticated;
