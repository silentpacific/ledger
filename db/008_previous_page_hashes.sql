-- Applied 27 Nov 2026 via Supabase MCP (migration "previous_page_hashes").
-- Skip unchanged pages: info pages read by the AI store a fingerprint "own:<sha256>" of the page's own
-- text (homepage boilerplate removed) + the question set + the model. If the next scan sees the same
-- fingerprint, it reuses that page's stored facts instead of paying for an AI read.
create or replace function public.previous_page_hashes(p_domain text)
returns table (url text, content_hash text, scanned_at timestamptz)
language sql stable set search_path = '' as $$
  select distinct on (sp.url) sp.url, sp.content_hash, s.started_at
    from public.scan_pages sp
    join public.scans s on s.id = sp.scan_id
    join public.domains d on d.id = s.domain_id
   where d.domain = p_domain and sp.content_hash like 'own:%' and s.status in ('complete','partial')
   order by sp.url, s.started_at desc;
$$;
revoke all on function public.previous_page_hashes(text) from public, anon, authenticated;
grant execute on function public.previous_page_hashes(text) to service_role;
