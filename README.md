# Project Ledger: scanner

Scans Australian retail websites and stores structured commerce facts
(policies, shipping, payments, promotions, products, loyalty, tech stack, AI-readiness)
in the `ledger-db` Supabase project. Working name; the brand comes later.

## How it works
1. **robots.txt first.** Every URL is checked before it is fetched. Disallowed pages are skipped.
2. **Code first.** Platform, tech stack, BNPL, payment icons, structured data, sitemaps,
   AI-readiness and Shopify product prices are read by code.
3. **AI second.** Policy, shipping, payment, loyalty, FAQ and promo pages are read by Claude.
   Each page is read twice; a fact needs both reads to agree and a verbatim quote that code
   finds on the page. Otherwise it is stored as low confidence or `conflicting`.
4. **No manual review.** `publishable_facts` in the database applies the quality rules automatically.

Polite by design: honest user agent with a contact address, 2 seconds between requests,
no logging in, no getting around bot protection (a blocked site is recorded as blocked).

## Run it
GitHub → **Actions** → **Scan** → **Run workflow**.
- `domain`: one site (e.g. `zamels.com.au`), or empty for every enabled site.
- `mode`: `full` (everything) or `weekly` (promotions, products, content).

Scheduled: weekly scan every Monday, full scan on the 1st of each month.
Each run's raw JSON is kept as a downloadable artifact for 14 days.

## Secrets (Settings → Secrets and variables → Actions)
| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Secret | `https://iqxscslcntachstcdeve.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Secret | Supabase secret key (or legacy service_role key) |
| `ANTHROPIC_API_KEY` | Secret | Anthropic Console API key |
| `FIRECRAWL_API_KEY` | Secret | Firecrawl API key (fallback for JavaScript pages) |
| `CRAWLER_CONTACT` | Variable | Email shown in the crawler's user agent |
| `CLAUDE_MODEL` | Variable (optional) | Defaults to `claude-sonnet-5-5` |

## Local / Codespaces
```
pip install -r requirements.txt
python -m pytest -q                      # offline tests
python run.py --domain zamels.com.au --dry-run --no-ai   # code-only, no database write
```

## Files
- `ledger_scanner/fetch.py`: robots.txt, polite HTTP, Firecrawl fallback
- `ledger_scanner/detect.py`: code-based facts (tech, payments, structured data, AI-readiness)
- `ledger_scanner/discover.py`: sitemaps, page discovery, categories
- `ledger_scanner/shopify.py`: category top-10 products and prices
- `ledger_scanner/extract.py`: AI reading with evidence and agreement checks
- `ledger_scanner/scan.py`: one scan → one payload for `ingest_scan()`
- `db/001_digital_commerce_facts.sql`: database schema (already applied to ledger-db)
