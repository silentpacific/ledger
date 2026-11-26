-- Promotion de-duplication: the scanner sends promo_key (reusing the key of a stored
-- promotion for the same offer); a merge function folds existing duplicates together.

create or replace function public.ingest_scan(payload jsonb)
returns uuid language plpgsql set search_path = '' as $function$
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

  for p in select * from jsonb_array_elements(coalesce(s->'pages_fetched','[]'::jsonb)) loop
    insert into public.scan_pages (scan_id, url, http_status, robots_allowed, fetch_method, content_hash, note)
    values (v_scan, p->>'url', (p->>'status')::int, (p->>'robots_allowed')::boolean,
            p->>'fetch_method', p->>'content_hash', p->>'note');
  end loop;

  for f in select * from jsonb_array_elements(coalesce(payload->'facts','[]'::jsonb)) loop
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
    values (v_domain, coalesce(p->>'promo_key', md5(lower(trim(p->>'headline')) || coalesce(p->>'starts',''))),
            p->>'headline', p->>'type', p->>'discount',
            (p->>'starts')::date, (p->>'ends')::date, p->>'source', v_started, v_started)
    on conflict (domain_id, promo_key) do update
      set last_seen_at = greatest(promotions.last_seen_at, excluded.last_seen_at),
          stated_start = coalesce(promotions.stated_start, excluded.stated_start),
          stated_end   = coalesce(excluded.stated_end, promotions.stated_end),
          promo_type   = coalesce(promotions.promo_type, excluded.promo_type),
          discount     = coalesce(promotions.discount, excluded.discount),
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
    values (v_domain, coalesce(p->>'promo_key', md5(lower(trim(p->>'name')) || coalesce(p->>'starts',''))),
            p->>'name', p->>'type', (p->>'starts')::date, (p->>'ends')::date,
            'offer_terms_page', v_started, v_started)
    on conflict (domain_id, promo_key) do update
      set last_seen_at = greatest(promotions.last_seen_at, excluded.last_seen_at),
          stated_start = coalesce(promotions.stated_start, excluded.stated_start),
          stated_end   = coalesce(promotions.stated_end, excluded.stated_end),
          promo_type   = coalesce(promotions.promo_type, excluded.promo_type)
    returning id into v_promo;
    insert into public.promotion_sightings (promotion_id, scan_id, seen_at, live)
    values (v_promo, v_scan, v_started, false)
    on conflict (promotion_id, scan_id) do nothing;
  end loop;

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
end $function$;

-- Stored promotions for one site, for the scanner to match new sightings against
create or replace function public.domain_promotions(p_domain text)
returns table (id bigint, promo_key text, name text, discount text, promo_type text,
               stated_start date, stated_end date, first_seen_at timestamptz, last_seen_at timestamptz, times_seen int)
language sql stable set search_path = '' as $$
  select p.id, p.promo_key, p.name, p.discount, p.promo_type, p.stated_start, p.stated_end,
         p.first_seen_at, p.last_seen_at, p.times_seen
  from public.promotions p join public.domains d on d.id = p.domain_id
  where d.domain = p_domain
  order by p.last_seen_at desc;
$$;

-- Fold duplicate promotions into one: sightings move, dates widen, gaps fill
create or replace function public.merge_promotions(p_keep bigint, p_drop bigint[])
returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if p_keep = any(p_drop) then raise exception 'keep id is in drop list'; end if;
  if exists (select 1 from public.promotions where id = any(p_drop)
             and domain_id <> (select domain_id from public.promotions where id = p_keep)) then
    raise exception 'promotions belong to different sites';
  end if;
  insert into public.promotion_sightings (promotion_id, scan_id, seen_at, live, placement)
  select p_keep, s.scan_id, s.seen_at, s.live, s.placement
  from public.promotion_sightings s where s.promotion_id = any(p_drop)
  on conflict (promotion_id, scan_id) do update
    set live = promotion_sightings.live or excluded.live;
  update public.promotions k set
    first_seen_at = least(k.first_seen_at, d.first_seen),
    last_seen_at  = greatest(k.last_seen_at, d.last_seen),
    stated_start  = coalesce(k.stated_start, d.start_d),
    stated_end    = coalesce(k.stated_end, d.end_d),
    promo_type    = coalesce(k.promo_type, d.ptype),
    discount      = coalesce(k.discount, d.disc),
    times_seen    = (select count(*) from public.promotion_sightings s where s.promotion_id = p_keep)
  from (select min(first_seen_at) first_seen, max(last_seen_at) last_seen, min(stated_start) start_d,
               max(stated_end) end_d, max(promo_type) ptype, max(discount) disc
        from public.promotions where id = any(p_drop)) d
  where k.id = p_keep;
  delete from public.promotions where id = any(p_drop);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.domain_promotions(text) from public, anon, authenticated;
revoke all on function public.merge_promotions(bigint, bigint[]) from public, anon, authenticated;
revoke all on function public.ingest_scan(jsonb) from public, anon, authenticated;
grant execute on function public.domain_promotions(text) to service_role;
grant execute on function public.merge_promotions(bigint, bigint[]) to service_role;
grant execute on function public.ingest_scan(jsonb) to service_role;
