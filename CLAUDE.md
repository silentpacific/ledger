# Ledger: handover notes for Claude

Read this first in any new chat about Ledger ("Digital Commerce Facts").

## Read the whole spec before working
The spec doc (link below) is long, and the Claude Docs tool returns it in pages. Keep reading:
when a reply says complete='false' or ends in a `<gap cap='true' .../>` with a `next` value, send
that `next` back as the next read ({"kind": "view", ...next}) until a reply has no `next`. Only
then start work, and never say the doc was "cut off". Check you saw every section below.

Spec sections (Digital Commerce Facts – Scan Specification v1):
- Overview: site types; categories and cadence; reliability tiers (A auto, B auto + check, C browser, D other source)
- Common metadata on every observation: scan record, observation record
- 1. Site identity & footprint (monthly)
- 2. Policies (monthly): per policy page; returns and refunds; warranty; subscription and cancellation; T&Cs / privacy
- 3. Shipping & fulfilment (monthly)
- 4. Products watch list (weekly): how products are chosen; category setup; top-10 per category; list snapshots; price summary; SaaS plans
- 5. Promotions (weekly): per promotion; site-level summary; not covered in v1
- 6. Payment options (monthly): BNPL provider ceilings; BNPL facts per site
- 7. Tech stack & apps (monthly)
- 8. Journey, conversion & performance (monthly): homepage, listings, product page, lead forms, PageSpeed/CrUX, Tier C later
- 9. Trust & support, on-site (monthly)
- 10. External reviews (monthly)
- 11. Loyalty & retention (monthly)
- 12. Content & marketing activity (weekly): catalogue activity, publishing, homepage messaging, SEO footprint
- 13. AI-readiness (monthly): robots.txt crawler access, AI files, structured data, derived score
- Choosing the first vertical: criteria, scoring, one-week check
- Change events and scope: change event record, out-of-scope sources, open questions
- Front-end website v1: pages, suggest a site, display rules
- Legal & compliance rules
- Backlog
If the doc's headings no longer match this list, update the list.

## What it is
A URL-first tool that turns Australian ecommerce sites into dated, sourced commerce facts:
policies, prices, promotions, payments and tech. Change history is the core intelligence.
Owner: Rahul. Public site: https://ledger-au.vercel.app. Spec doc: https://claude.ai/artifact/FzXm4hXW3CkSQY7ansgNoG
Design canvas: https://claude.ai/artifact/NoBzCz8tVCS3vySd9jpf77

## Rules Rahul set
- No manual checks: quality comes from automatic rules.
- Haiku reads each page twice (Rahul, 27 Nov 2026: keep two reads); a fact counts only if both reads agree,
  its quote is on the page and numbers/money appear in the quote. Keep overall costs extremely low. Sonnet is a capped last resort (agreed 27 Nov 2026): re-reads a core fact (returns window,
  change of mind, free-shipping threshold, delivery fee) the two reads can't settle, and picks likely policy pages
  from the site's link list when returns/shipping can't be found. Caps: ESCALATION_MAX_PER_SITE (2) and
  ESCALATION_RUN_BUDGET_USD ($0.50) per run; ESCALATION_MODEL 'off' disables. The terms gate still needs
  two Haiku reads to clear a keyword hit.
- Finding policy pages: up to 3 candidates per core type, follows links from summary pages, Shopify's
  /policies/* pages, empty pages rendered once then skipped, homepage boilerplate stripped before the AI read,
  free-shipping threshold also read from the homepage by code.
- Unchanged pages are skipped (agreed 27 Nov 2026): each AI-read page stores a fingerprint "own:<sha256>"
  of its own text + the site's question set + model in scan_pages.content_hash; a full scan that sees the
  same fingerprint reuses that page's stored facts (previous_page_hashes RPC) with no AI call.
- Batch mode (half price, built 27 Nov 2026): `run.py --batch` / workflow input batch=true; scheduled runs use
  it by default (set the repo variable USE_BATCH=false to turn it off). Sites are scanned in rounds (ledger_scanner/batch.py): AI requests
  are collected, sent as one Message Batch, and each site is re-run from a per-run fetch cache until nothing is
  left to ask (max 5 rounds, then finished with what's answered). Cost rows count each site's active time only.
- Schedule changes 27 Nov 2026: full scan of all sites run early (27 Nov); weekly 30 Nov (Cyber Monday) kept;
  1 Dec monthly skipped via SKIP_SCHEDULED_DATES in scan.yml; weekly 7/14/21/28 Dec; monthly from 1 Jan.
- Scan cadence is the same for every industry: weekly = promotions, products watch list, content;
  monthly (1st) = everything else. The 30 Nov non-jewellery full rescan is a one-off for new questions.
- Runs pause at a budget (RUN_BUDGET_USD var, default $4) and exit 3 so GitHub emails him.
  If the Anthropic account runs out of credit, the run stops and stores nothing for that site.
- Firecrawl mode (Rahul, 27 Nov 2026): when a site's homepage rejects our direct requests (connection dropped,
  429, 202 holding page, 403/503), Fetcher.fetch_home switches that site to Firecrawl's standard fetch (never
  stealth) for the whole scan; robots.txt is re-read through Firecrawl and the terms gate still runs. Costs
  ~US$0.10/site/month. Used for Petstock, Pet Circle, PetPost. Bare domains that don't answer are retried
  on www. first (Bonds, Sheridan now read that way, no Firecrawl needed).
- JavaScript-built sites (27 Nov 2026): a homepage with <400 characters of text switches the site to render
  mode (Fetcher.render_html): HTML pages through Firecrawl, sitemaps/robots/JSON fetched directly.
- Help centres (27 Nov 2026, ledger_scanner/helpcentre.py): when returns/shipping core facts are still missing
  after the store's own pages, the scanner looks for a help centre linked from the homepage (help./support.
  subdomains, Zendesk, Gorgias, Intercom, Freshdesk...) or tries help.<store> and support.<store>, then reads up to
  3 matching articles (Zendesk search API, else article links by title). Runs before Sonnet's link-picking.
  Each help-centre host's own robots.txt is respected (Fetcher._other_host_robots). A help centre that rejects
  direct requests (Zendesk 403, e.g. Lyka) is read through Firecrawl's standard fetch (helpcentre._get).
- Site cleanup 27 Nov 2026: domains fixed (wilsonandfrenchy.com.au, pe-nation.com, au.citta.com, peto.com.au
  = ex My Pet Warehouse, savour-life.com.au, muktiorganics.com, mr-smith.com.au); switched off (scan_enabled=false, reason in last_scan_error, data kept):
  wireless1.com.au, kohepets.com.au, milandirect.com.au.
- Store discovery (27 Nov 2026, discover_stores.py + .github/workflows/discover.yml): .com.au/.au domains from
  the public Tranco top-1M list in rank order, not yet tracked; homepage read once (robots.txt respected, our UA);
  a store only if the page loads a commerce platform's files (Shopify/WooCommerce/BigCommerce/Magento/Neto/SFCC)
  AND has product markup or add-to-cart, and isn't news/media; industry by keywords and it must appear in the
  store's own title/description; books, liquor, records, markets, hardware etc. skipped. Inserts with
  full_scan_requested and starts N parallel scan.yml runs (manual scan runs no longer share one concurrency
  group). Test runs 27 Nov: first version let in news sites (fixed), second misfiled books/liquor (fixed); the
  bad test additions are switched off with a reason in last_scan_error.
- Terms: scan sites with no terms page. The Shopify template anti-scraping clause is ignored
  (verdict template_clause, site scanned). Custom anti-scraping clauses block (Michael Hill,
  Paspaley, By Charlotte...). Blocked/prohibited sites are switched off and listed in the
  `sites_refusing_scraping` view; never re-enable them automatically.
- Secrets live only in GitHub secrets. Never paste the Supabase secret key anywhere.
  Don't use Rahul's personal email. Delete data only with his approval.
- Curasept (curasept.com.au) is Rahul's client; it's in the health list. Ask before featuring it.

## Pieces
- Repo: github.com/silentpacific/ledger (main). Scanner = Python in ledger_scanner/, run.py.
  Tests: `python -m pytest -q tests`.
- Scans run on GitHub Actions (.github/workflows/scan.yml): weekly Mon 02:13 UTC, monthly on the
  1st 03:17 UTC (+ terms recheck). Manual: `gh api -X POST repos/silentpacific/ledger/actions/workflows/scan.yml/dispatches -f ref=main -f 'inputs[domain]=a.com,b.com' -f 'inputs[mode]=full' -f 'inputs[budget]=4'`
  Other inputs: model, recheck_refusals, dedupe_promotions, no_ai, dry_run. Logs: `gh run view ID --log` after it finishes.
- Database: Supabase project `ledger-db`, id iqxscslcntachstcdeve. Key tables: domains
  (industry, scan_enabled, terms_verdict), scans, terms_checks, promotions. Schema changes go through
  apply_migration (needs Rahul's approval) and are recorded in db/*.sql.
- Website: Next.js 15.5 in web/, Vercel project prj_V1XtQGPACcTPdBQ6DCC7r9qqNOZX
  (team team_JBupfPXHwDsuPQWn9DezvHWE, region syd1). Auto-deploys on push. Pages refresh hourly (ISR).
  Data only via web_* RPCs with the publishable key; raw tables are RLS-locked.
- Industries: jewellery, fashion, beauty, health, homewares, pet, baby-kids, sports-outdoors, electronics.
  Every page covers all industries with an industry filter (industry tabs, then secondary dropdowns).
  Segments are switched off (27 Nov 2026, web/lib/data.ts SEGMENTS_ENABLED=false): overlapping, single-store and
  not industry-standard. Data kept in domains.segment. Revisit later with an industry-standard scheme.
  Nav: This week, Industries (sortable stats table), Sites, Payments (/payments overview, /payments/[provider];
  also /platforms + /platforms/[value], /policies + /policies/[value]; all old /explore/[kind]/[value] addresses
  redirect permanently (lib/format facetHref is the one place that maps a list to its address), /explore is gone), Compare
  (starts empty, search picker), Benchmarks, Promotions, Tech (/tech, /tech/[tool]; commerce tools only).
  Industry stats show a median only when >=60% of that industry's sites state the value (lib/stats.ts).
- Questions per industry: extract.FIELDS (common) + extract.INDUSTRY_FIELDS (extras per industry).
  domains.full_scan_requested = true makes a weekly run do a full scan of that site, then it clears.

## Missing facts (agreed 27 Nov 2026)
- Views fact_gaps, fact_gaps_summary, fact_coverage (db/009). After each scan: `select * from fact_gaps_summary;`
  and `select * from fact_coverage;` show which stores miss which key facts and why. Report these with scan results.

## Cost index (agreed 27 Nov 2026)
- Every scan attempt writes a row to scan_costs (AI tokens by model, pages, Firecrawl pages, runtime,
  conflicting facts, issues, outcome). A failed write fails the run (exit 4). Never rely on GitHub logs for costs.
- Prices, A$100/h labour rate, labour minutes per warning sign and the 1-100 scale live in
  cost_index_settings (one row). Scale: log, monthly A$0.05 = 1, A$50 = 100.
- When Rahul asks for the cost index: `select * from cost_index_industries order by median_index desc;`
  and `select * from cost_index_sites order by cost_index desc;` (typical month = avg full scan + 4.33 x avg weekly).

## Status (27 Nov 2026, evening)
- Stores: ~150 at the start of 27 Nov; +20 pet stores (ids 609-628; 17 read, The Vet Shed and Mad Paws refuse by
  terms, Waggly blocks); +183 stores across the other 8 industries (ids >628, drafted from knowledge without web
  searches to save Rahul's Claude usage; jewellery got 15 as it already had 38). The 183 are scanning in two batch
  runs (45960639175, 45960659695, US$4 cap each): expect some refusals (big chains) and some wrong domains to fix.
- Full scan 27 Nov of the original stores: 151 stored, 0 failed, ~US$1.32 AI for the day. Key facts found:
  returns window 99, change of mind 98, free-shipping minimum 82, delivery fee 80, BNPL 84 (of 151).
- Unreadable-store cleanup 27 Nov (17 stores): 9 now read (Firecrawl mode or www fix or corrected domain),
  wireless1/kohepets/milandirect switched off, snowys + healthylife + savour-life switched off by their own terms,
  still unreadable: myprotein.com.au (503 even via Firecrawl), anaconda.com.au (no answer).
- JavaScript sites + help centres (27 Nov): the 9 JS stores went from 36 missing key facts to 15 (Platypus, The
  Athlete's Foot, Chemist Discount Centre now 4/4). Zanui still empty even rendered. Freedom and Lyka now read
  from their Zendesk help centres. Pet coverage 48% -> 59% average key facts (10 -> 27 stores).
- Website changes 27 Nov:
  - Homepage hero "Type a store, see its profile" (StoreLookup) and the record look on every page (see below).
  - Compare: equal-width value columns with wrapping (table.cmp); picker list is a solid .picker-list (never
    see-through); Enter adds the highlighted / exact / first match even if typed before hydration; the box clears
    after each add (Rahul's latest call; earlier he wanted the term to persist) and the list stays open.
  - Payments (/payments overview: BNPL share, providers per store, sortable options table, BNPL by industry,
    providers offered together, recent changes), Platforms (/platforms), Policies (/policies); detail pages via
    lib/facetRoutes.ts; FacetIndex component for the platform/policy overviews.
  - Promotions: pill counts = stores with that offer type in the month/year being viewed (not live-now).
  - Sites filters labelled with KIND_SINGULAR (Technology, Policy). Methodology no longer mentions template wording.
  - About page: founder story removed (Rahul doesn't want one).
- Website look (27 Nov): the hero's "record" style across all pages (globals.css "the record look"): .card is a
  ruled section (ink top rule, no box), .kv rows use dotted leaders, .stat is a big-number strip, .band is the dark
  prompt (compare). No all-caps labels. Product name lives only in web/lib/brand.ts (BRAND) for the rename;
  the crawler name LedgerBot is separate (ledger_scanner/config.py USER_AGENT).
- SEO: app/sitemap.ts is generated automatically and refreshed hourly; lastmod = each store's last scan for
  store pages, the latest scan for list pages, STATIC_UPDATED (in sitemap.ts; bump it when editing them) for
  About/Contact/Methodology. Structured data (lib/schema.ts): Organization + WebSite with SearchAction on every
  page (layout); every page has its page type + BreadcrumbList; list pages an ItemList; store pages a ProfilePage
  with the store as OnlineStore (+ MerchantReturnPolicy from observed returns facts only); benchmarks a Dataset.
- Build data (27 Nov): web_sites is >3 MB (over Next's 2 MB data cache), so lib/data.ts memoises each RPC per
  build worker/server instance and retries 5xx; without it every page refetched and Supabase timed out (57014),
  which failed the deploys of the /payments and /platforms changes. On the live site the memo lasts 5 minutes.
  Vercel's shared data cache kept serving an old 144-store web_sites copy (fresh >2 MB copies can't be stored):
  fixed by versioning the cache key (X-Ledger-Data header in lib/data.ts); bump it if a stale copy ever sticks.
  The site also drops empty list entries on load (lib/data.ts clean()), after null entries broke a deploy.
- Opt-out proposal (27 Nov, awaiting Rahul): robots.txt Disallow for our crawler = stop tracking (already works);
  removal of past data only after proof of control (code in /.well-known/ file or DNS TXT), checked automatically,
  confirmation sent to a role address (legal@/privacy@); email alone is never enough. Needs a schema change
  (approval) and the final crawler name. Rationale given: robots.txt is the industry norm; a narrow opt-out
  reduces disputes and blocking; lawyer review (item 15) should decide whether removal covers past data.
- 27 Nov night: goal 1,000 stores. Discovery 45982623141 found only 319 qualifying stores in the 5,385 untracked
  Tranco .au domains (strict filter); all scanned. Spot check showed ~25% wrong (incl. adult stores filed under
  baby-kids), so Haiku now makes the final call in discovery (discover_stores.judge) and a review run re-judged
  everything added since 10:00 UTC: 13 moved industry, 15 switched off (Pet City and Petso wrongly, restored).
  Adult/tobacco names (clubx, sexyland, naughtyboy, bintel) switched off. Tranco is exhausted for .au: more
  stores need another source (e.g. platform store lists or directories). Firecrawl credits ran out 27 Nov ~22:00
  (Rahul asked about buying more).
- Firecrawl out of credits (27 Nov, resets 23 Dec; Rahul declined the US$19 Smart Upgrade for now): on HTTP 402
  the scanner stops calling Firecrawl for the rest of the run (fetch.FIRECRAWL_OUT) and stores that needed it get
  the issue fetch.NEEDS_FIRECRAWL; rescan those when credits are back:
  `select distinct d.domain from scans s join domains d on d.id=s.domain_id where s.issues::text like '%needs Firecrawl%'`.
- Scaling to 5,000 stores (Rahul's goal, 27 Nov) hits limits: GitHub Actions minutes (private repo, ~1,365 of the
  free 2,000/month used in Nov; batch mode idles while waiting so a store costs ~1-2 runner minutes), Supabase
  free 500 MB (67 MB at ~565 stores, raw_payload is most of it), Vercel (web_sites would be ~25 MB; pages need
  per-store RPCs instead of loading every store), and a new store source (Tranco .au is used up; Common Crawl
  index next). Decisions put to Rahul 27 Nov.
- Rahul's Claude usage was ~82% of his weekly limit on 27 Nov evening: prefer SQL and code over web searches,
  and keep checks compact. He'll upgrade Anthropic API / Firecrawl if needed: warn before limits are hit.
- Waiting on Rahul: privacy policy, terms, opt-out response time, final brand name (then rename the crawler and
  set a real crawler contact email, not his personal one), lawyer review. (No founder story.)
- Scheduled: Mon 30 Nov Cyber Monday weekly scan (batch); 1 Dec monthly skipped; weekly 7/14/21/28 Dec;
  monthly from 1 Jan.
- Later: country rules before going global (EU database right, privacy laws, currencies), refine the cost index
  labour estimates after a few weeks, update the spec doc with 27 Nov decisions (batch mode, unchanged pages,
  cost index, missing-facts check, schedule, Firecrawl mode, JS rendering, help centres), segments via an
  ANZSIC-based scheme (Rahul said no for now).
- Known gaps: JS-rendered prices (Goldmark, Prouds, Temple & Grace), Zanui, store finders, over-time charts
  (need more weeks of data), real domain + brand, placeholders (email, city, ABN, privacy, terms).
