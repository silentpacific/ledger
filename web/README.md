# Ledger website

Next.js site on Vercel. Reads ledger-db only through the public `web_*` functions
(`web_sites`, `web_promotions`, `web_changes`, `web_products`, `web_suggest_site`, `web_contact`)
with the Supabase publishable key, which is safe to expose. Pages refresh hourly.

Local build with sample data: `LEDGER_FIXTURE_DIR=/path/to/fixtures npx next build`.
