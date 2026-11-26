# Ledger: handover notes for Claude

Read this first in any new chat about Ledger ("Digital Commerce Facts").

## What it is
A URL-first tool that turns Australian ecommerce sites into dated, sourced commerce facts:
policies, prices, promotions, payments and tech. Change history is the core intelligence.
Owner: Rahul. Public site: https://ledger-au.vercel.app. Spec doc: https://claude.ai/artifact/FzXm4hXW3CkSQY7ansgNoG
Design canvas: https://claude.ai/artifact/NoBzCz8tVCS3vySd9jpf77

## Rules Rahul set
- No manual checks: quality comes from automatic rules.
- Haiku first; Sonnet only for facts Haiku can't settle (ESCALATION_MODEL, 'off' disables).
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
- Industries: jewellery (full coverage: feed, benchmarks, explore, promotions are jewellery-only),
  fashion, beauty, health, homewares, pet, baby-kids, sports-outdoors, electronics.

## Status (27 Nov 2026)
- 134 sites with full data (jewellery 33, beauty 18, fashion 15, health 14, homewares 12,
  baby-kids 12, sports 12, electronics 12, pet 6). First 9-industry scan cost ~$5.12 total
  (Haiku $1.69, Sonnet $3.45): Sonnet escalation is ~2/3 of spend; Rahul may want it capped.
- ~19 sites failed to load (timeouts / wrong domains) and need cleanup with Rahul.
- Known gaps: JS-rendered prices (Goldmark, Prouds, Temple & Grace), store finders,
  over-time charts (need more weeks of data), real domain + brand, lawyer review,
  placeholders (email, city, ABN, founder story, privacy, terms).
