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
  Nav: This week, Industries (sortable stats table), Sites (Explore merged in; /explore redirects), Compare
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

## Status (27 Nov 2026)
- 27 Nov: full scan of all 152 enabled sites started in batch mode as two runs (45924871812, 45924889305).
  5-site tests: ~US$0.006/site full scan in batch; key-fact coverage up (Amber Sceats, Bevilles, Bed Bath N' Table now 4/4).
  Still weak: JS-built sites (JB Hi-Fi, Tentworld), help-centre policies (Lyka), rate-limited sites (Healthylife 429).
- Website (27 Nov, from UX feedback): homepage leads with what Ledger is, how it works, market numbers with
  "how it's calculated", findings, a compare entry, top changes, then the full feed; Explore/Analyse nav;
  store names from og:site_name / page title (lib/format displayName); offers past their end date are not live;
  schedule line from lib/schedule.ts (mirror of scan.yml). Curasept is never used in suggested comparisons.
- Waiting on Rahul: privacy policy, terms, opt-out response time, founder story, final brand name.
- ~19 sites failed to load (timeouts / wrong domains) and need cleanup with Rahul.
- Known gaps: JS-rendered prices (Goldmark, Prouds, Temple & Grace), store finders,
  over-time charts (need more weeks of data), real domain + brand, lawyer review,
  placeholders (email, city, ABN, founder story, privacy, terms).
