-- Scan cost index (agreed 27 Nov 2026). Applied via Supabase MCP (migration "cost_index").
-- One row per scan attempt in scan_costs (stored, failed or blocked: every attempt costs money).
-- Costs are worked out in the views from cost_index_settings, so changing a rate or a labour
-- weight re-prices every scan without touching the stored measurements.
--
--   cost_index_sites       one row per site: typical monthly cost (A$) and the 1-100 index
--   cost_index_industries  one row per industry: median and 90th-percentile index, totals
--
-- Index: fixed log scale between scale_low_aud (index 1) and scale_high_aud (index 100) of
-- monthly cost, so a site's number doesn't move when other sites are added.

create table if not exists public.cost_index_settings (
  id                      int primary key default 1 check (id = 1),
  usd_to_aud              numeric not null default 1.55,
  labour_aud_per_hour     numeric not null default 100,
  runner_usd_per_minute   numeric not null default 0.008,   -- GitHub Actions Linux runner list price
  firecrawl_usd_per_page  numeric not null default 0.0053,  -- Firecrawl credit price (plan-dependent)
  scale_low_aud           numeric not null default 0.01,    -- monthly cost that scores 1
  scale_high_aud          numeric not null default 10,      -- monthly cost that scores 100
  weekly_scans_per_month  numeric not null default 4.33,
  -- estimated minutes of upkeep per warning sign seen in a scan
  labour_minutes          jsonb not null default
    '{"failed_scan": 15, "blocked": 5, "rendered_page": 2, "conflicting_fact": 1, "issue": 1}'::jsonb,
  notes                   text,
  updated_at              timestamptz not null default now()
);
insert into public.cost_index_settings (id, notes) values (1,
  'Labour base rate A$100/h (Rahul, 27 Nov 2026). Runner and Firecrawl prices are list-price assumptions: edit if the plan differs. Scale: A$0.01/month = 1, A$10/month = 100, log scale.')
on conflict (id) do nothing;

create table if not exists public.scan_costs (
  id               bigint generated always as identity primary key,
  domain           text not null,
  domain_id        bigint references public.domains(id) on delete set null,
  industry         text,
  scan_id          uuid references public.scans(id) on delete set null,
  mode             text not null check (mode in ('full','weekly')),
  outcome          text not null check (outcome in ('stored','failed','blocked','not_stored')),
  started_at       timestamptz not null,
  finished_at      timestamptz not null,
  runtime_seconds  numeric not null,
  pages_fetched    int,
  rendered_pages   int,                 -- pages fetched through Firecrawl (JavaScript sites)
  ai_usage         jsonb not null default '{}'::jsonb,  -- {model: {calls, input, output}}
  ai_cost_usd      numeric not null default 0,
  escalation_calls int not null default 0,
  conflicting_facts int not null default 0,
  issues           int not null default 0,
  scanner          text,
  created_at       timestamptz not null default now()
);
create index if not exists scan_costs_domain_started on public.scan_costs (domain, started_at desc);
alter table public.scan_costs enable row level security;
alter table public.cost_index_settings enable row level security;

-- Each scan priced in A$
create or replace view public.scan_cost_detail with (security_invoker = true) as
select c.*,
       round(c.ai_cost_usd * s.usd_to_aud, 4) as ai_aud,
       round(((c.runtime_seconds / 60.0) * s.runner_usd_per_minute
              + coalesce(c.rendered_pages, 0) * s.firecrawl_usd_per_page) * s.usd_to_aud, 4) as materials_aud,
       ( case when c.outcome = 'failed' then (s.labour_minutes->>'failed_scan')::numeric else 0 end
       + case when c.outcome = 'blocked' then (s.labour_minutes->>'blocked')::numeric else 0 end
       + coalesce(c.rendered_pages, 0) * (s.labour_minutes->>'rendered_page')::numeric
       + c.conflicting_facts * (s.labour_minutes->>'conflicting_fact')::numeric
       + c.issues * (s.labour_minutes->>'issue')::numeric ) as labour_minutes
  from public.scan_costs c cross join public.cost_index_settings s;

create or replace view public.scan_cost_priced with (security_invoker = true) as
select d.*,
       round(d.labour_minutes / 60.0 * s.labour_aud_per_hour, 4) as labour_aud,
       round(d.ai_aud + d.materials_aud + d.labour_minutes / 60.0 * s.labour_aud_per_hour, 4) as total_aud
  from public.scan_cost_detail d cross join public.cost_index_settings s;

-- One row per site: a typical month = average full scan + weekly_scans_per_month x average weekly scan,
-- from the last 90 days. needs_weekly / needs_full say when one kind hasn't been measured yet.
create or replace view public.cost_index_sites with (security_invoker = true) as
with recent as (
  select * from public.scan_cost_priced where started_at > now() - interval '90 days'
), per_site as (
  select domain,
         (array_agg(industry order by started_at desc))[1] as industry,
         count(*) as scans_measured,
         avg(total_aud) filter (where mode = 'full')   as full_aud,
         avg(total_aud) filter (where mode = 'weekly') as weekly_aud,
         avg(ai_aud + materials_aud) filter (where mode = 'full') as full_ai_materials_aud,
         avg(labour_aud) filter (where mode = 'full') as full_labour_aud,
         max(started_at) as last_measured
    from recent group by domain
)
select p.domain, p.industry, p.scans_measured,
       round(coalesce(p.full_aud, 0) + s.weekly_scans_per_month * coalesce(p.weekly_aud, 0), 4) as monthly_aud,
       round(p.full_aud, 4) as full_scan_aud, round(p.weekly_aud, 4) as weekly_scan_aud,
       round(p.full_ai_materials_aud, 4) as full_scan_ai_materials_aud, round(p.full_labour_aud, 4) as full_scan_labour_aud,
       greatest(1, least(100, round(1 + 99 * ln(greatest(coalesce(p.full_aud, 0) + s.weekly_scans_per_month * coalesce(p.weekly_aud, 0), s.scale_low_aud) / s.scale_low_aud)
                                    / ln(s.scale_high_aud / s.scale_low_aud))))::int as cost_index,
       p.full_aud is null as needs_full, p.weekly_aud is null as needs_weekly,
       p.last_measured
  from per_site p cross join public.cost_index_settings s;

create or replace view public.cost_index_industries with (security_invoker = true) as
select coalesce(industry, 'unknown') as industry,
       count(*) as sites_measured,
       percentile_disc(0.5) within group (order by cost_index) as median_index,
       percentile_disc(0.9) within group (order by cost_index) as p90_index,
       round(percentile_cont(0.5) within group (order by monthly_aud)::numeric, 4) as median_monthly_aud,
       round(sum(monthly_aud), 2) as total_monthly_aud,
       count(*) filter (where needs_full or needs_weekly) as sites_missing_a_scan_type
  from public.cost_index_sites group by 1;

revoke all on public.scan_costs, public.cost_index_settings, public.scan_cost_detail, public.scan_cost_priced,
              public.cost_index_sites, public.cost_index_industries from anon, authenticated;

-- One-off full rescans requested from a weekly run (e.g. after the question set changes)
alter table public.domains add column if not exists full_scan_requested boolean not null default false;

drop function if exists public.domains_due(int);
create function public.domains_due(p_limit int default 1000)
returns table (domain text, homepage_url text, platform text, industry text, full_scan_requested boolean)
language sql set search_path = '' as $$
  select d.domain, d.homepage_url, d.platform, d.industry, d.full_scan_requested
    from public.domains d
   where d.scan_enabled and not d.opted_out and d.homepage_url is not null
   order by d.full_scan_requested, d.last_scanned_at nulls first, d.domain   -- cheap weekly sites first
   limit p_limit;
$$;
revoke all on function public.domains_due(int) from public, anon, authenticated;
grant execute on function public.domains_due(int) to service_role;

-- 27 Nov 2026: non-jewellery sites get industry-specific questions; refresh them all on the next weekly run
update public.domains set full_scan_requested = true
 where coalesce(industry, 'jewellery') <> 'jewellery' and scan_enabled;

-- Fill domain_id and industry from domains (applied as migration "scan_costs_fill_domain")
create or replace function public.scan_costs_fill_domain() returns trigger
language plpgsql set search_path = '' as $$
begin
  select d.id, coalesce(new.industry, d.industry) into new.domain_id, new.industry
    from public.domains d where d.domain = new.domain;
  return new;
end $$;
create trigger scan_costs_fill_domain before insert on public.scan_costs
  for each row execute function public.scan_costs_fill_domain();

-- Calibrated the same day after a test (rolled back): at A$100/h, labour swamped everything with the first
-- weights, so per-scan labour minutes were lowered and the scale widened. Current settings:
update public.cost_index_settings set
  scale_low_aud = 0.05, scale_high_aud = 50,
  labour_minutes = '{"failed_scan": 5, "blocked": 2, "rendered_page": 0.5, "conflicting_fact": 0.25, "issue": 0.25}'::jsonb,
  updated_at = now()
where id = 1;
