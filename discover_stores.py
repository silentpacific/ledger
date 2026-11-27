"""Find Australian online stores to track, automatically (no AI, no manual checks).

Sources: --source tranco = the public Tranco list of the top 1M websites (https://tranco-list.eu), .au domains
in rank order (used up for .au on 27 Nov 2026); --source commoncrawl = the Common Crawl URL index
(https://index.commoncrawl.org), .com.au sites that have shop-style addresses (/products/, /collections/, /product/).
Skips ones already tracked (also by the address they redirect to, and by store name), reads each homepage once
(robots.txt respected, our crawler's user agent), keeps only real online stores (a commerce platform
or add-to-cart + prices) and sorts them into our 9 industries by keywords. Adds them to `domains` with
full_scan_requested = true, and writes the new domains in chunks for parallel scan runs.

Usage: python discover_stores.py --target 750 --chunks 8 --per-industry 110
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.robotparser
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from ledger_scanner import config
from ledger_scanner.fetch import html_to_text

TRANCO = "https://tranco-list.eu/top-1m.csv.zip"
CC_INDEX = "https://index.commoncrawl.org"
# shop-style page addresses: Shopify products and collections, WooCommerce and others' product pages
CC_SHOP_PATH = r".*\.com\.au/(products|collections|product|shop/products)/.*"
SKIP_SUFFIX = (".gov.au", ".edu.au", ".org.au", ".net.au", ".asn.au", ".id.au", ".csiro.au", ".nsw.gov.au")
SKIP_WORDS = re.compile(r"(news|bank|insurance|realestate|jobs|council|casino|lotto|loans?|weather|forum|airline|"
                        r"telstra|optus|aldi|woolworths|coles|kotaku|zdnet|choice|nowtolove|bandt|gizmodo|cashconverters)", re.I)
# The store's own page code loads the platform's files (a news article that merely mentions Shopify doesn't count)
PLATFORM = re.compile(r"(src|href)=[\"'][^\"']*(cdn\.shopify\.com/(s|extensions)/|/wp-content/plugins/woocommerce/|"
                      r"cdn11\.bigcommerce\.com/s-|/static/version\d+/frontend/|mage/cookies|assets\.netostatic\.com|"
                      r"demandware\.static|/bundles/storefront/)", re.I)
PRODUCT = re.compile(r"\"@type\"\s*:\s*\"Product\"|og:type[\"'][^>]+product|add[ -_]to[ -_](cart|bag)|data-product-id|product-card", re.I)
MEDIA = re.compile(r"og:type[\"'][^>]+content=[\"']article|\"@type\"\s*:\s*\"(NewsArticle|NewsMediaOrganization)\"", re.I)
CART = re.compile(r"add[ -_]to[ -_](cart|bag)|/cart\b|shopping[ -]bag", re.I)
PRICE = re.compile(r"\$\s?\d{1,4}(\.\d{2})?")

INDUSTRY_WORDS = {
    "jewellery": "jewellery jewelry rings necklace earrings bracelet diamond engagement pendant gold silver",
    "fashion": "clothing fashion dresses womenswear menswear apparel shoes footwear denim tops swimwear accessories boutique",
    "beauty": "skincare beauty makeup cosmetics serum moisturiser fragrance perfume haircare tan nails",
    "health": "vitamins supplements pharmacy chemist protein wellness health medicine probiotic",
    "homewares": "furniture homewares bedding linen sofa mattress decor lighting rugs kitchenware cookware manchester",
    "pet": "pet pets dog dogs cat cats puppy kitten treats aquarium",
    "baby-kids": "baby kids toddler toys nursery pram newborn children maternity",
    "sports-outdoors": "sports outdoor camping hiking fitness gym cycling bike running fishing surf golf",
    "electronics": "electronics computers laptops gaming phones cameras audio tv appliances headphones tech",
}
KW = {k: v.split() for k, v in INDUSTRY_WORDS.items()}
# shops outside our 9 industries (their title or description gives them away)
OUT_OF_SCOPE = set("book books bookshop bookstore wine wines liquor beer spirits cellars vinyl records music market markets "
                   "hardware tools florist flowers grocery groceries printing stationery office party supermarket".split())


def tranco_au() -> list[str]:
    raw = requests.get(TRANCO, timeout=120).content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        rows = csv.reader(io.TextIOWrapper(z.open(z.namelist()[0])))
        out = []
        for _, d in rows:
            d = d.strip().lower()
            if (d.endswith(".com.au") or (d.endswith(".au") and d.count(".") == 1)) and not d.endswith(SKIP_SUFFIX):
                if not SKIP_WORDS.search(d.split(".")[0]):
                    out.append(d)
        return out


def cc_au(want: int, start_page: int = 0) -> list[str]:
    """.com.au hosts with shop-style page addresses in the latest Common Crawl, until `want` new ones are found.
    The index is in address order, so pages are visited spread out over the whole list (every `step` pages)."""
    import random
    coll = requests.get(f"{CC_INDEX}/collinfo.json", timeout=60).json()[0]
    api = coll["cdx-api"]
    q = {"url": "*.com.au", "output": "json", "fl": "url", "filter": f"~url:{CC_SHOP_PATH}"}
    pages = int(requests.get(api, params={**q, "showNumPages": "true"}, timeout=120).json()["pages"])
    order = list(range(start_page, pages))
    random.Random(27).shuffle(order)  # the same spread every run, so later runs continue where earlier ones stopped
    print(f"Common Crawl {coll['id']}: {pages} index pages for *.com.au", flush=True)
    hosts: dict[str, None] = {}

    def page(n: int) -> set[str]:
        for attempt in range(4):
            try:
                r = requests.get(api, params={**q, "page": n}, timeout=180)
                if r.status_code in (429, 503):
                    import time; time.sleep(5 * (attempt + 1)); continue
                if r.status_code == 404:
                    return set()  # no matches on this page
                r.raise_for_status()
                out = set()
                for line in r.text.splitlines():
                    try:
                        u = json.loads(line)["url"]
                    except Exception:
                        continue
                    h = re.sub(r"^https?://", "", u).split("/")[0].split(":")[0].lower().removeprefix("www.")
                    if h.endswith(".com.au") and h.count(".") == 2 and not SKIP_WORDS.search(h.split(".")[0]):
                        out.add(h)
                return out
            except requests.RequestException:
                import time; time.sleep(5)
        return set()

    with ThreadPoolExecutor(4) as ex:  # be gentle with the public index
        for i in range(0, len(order), 8):
            for got in ex.map(page, order[i:i + 8]):
                for h in got:
                    hosts.setdefault(h)
            print(f"  {i + 8} pages read, {len(hosts)} shop hosts", flush=True)
            if len(hosts) >= want:
                break
    return list(hosts)


def existing_names() -> set[str]:
    """Store names already on the site (normalised), to skip the same store on another address."""
    h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"}
    r = requests.get(f"{config.SUPABASE_URL}/rest/v1/web_site_index?select=name&limit=100000", headers=h, timeout=60)
    return {norm_name(x["name"]) for x in r.json()} if r.ok else set()


def norm_name(s: str) -> str:
    s = re.sub(r"(australia|official|online|store|shop|au)\b", " ", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)


def existing() -> set[str]:
    h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"}
    r = requests.get(f"{config.SUPABASE_URL}/rest/v1/domains?select=domain&limit=100000", headers=h, timeout=60)
    r.raise_for_status()
    return {x["domain"].removeprefix("www.") for x in r.json()}


def classify(text: str) -> str | None:
    words = re.sub(r"[^a-z ]", " ", text.lower()).split()
    counts: dict[str, int] = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    scores = {k: sum(counts.get(w, 0) for w in ws) for k, ws in KW.items()}
    best = sorted(scores.items(), key=lambda x: -x[1])
    if best[0][1] < 3 or best[0][1] < 1.5 * best[1][1]:
        return None  # not clearly one of our industries
    return best[0][0]


INDUSTRIES = list(INDUSTRY_WORDS)
JUDGE = ("You classify Australian online stores for a retail research site. Reply with JSON only: "
         '{"industry": one of ' + ", ".join(INDUSTRIES) + ' or "none", "adult": true|false}. '
         "industry is the store's main consumer category; use none for stores outside these (books, alcohol, "
         "automotive, tobacco/vape, hardware/trade, education, party/costume, general marketplaces, services). "
         "adult is true for sex shops, adult toys or explicit content. jewellery = jewellery and watches; "
         "homewares = furniture, homewares, bedding, plants/garden decor; health = pharmacy, vitamins, supplements, "
         "sports nutrition; baby-kids = baby gear, kids clothing and toys.")


def judge(domain: str, head: str, text: str) -> dict | None:
    """Haiku's verdict on one store: {'industry': ... | 'none', 'adult': bool}. None if the AI can't be reached."""
    if not config.ANTHROPIC_API_KEY:
        return None
    import anthropic
    try:
        msg = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY).messages.create(
            model=config.CLAUDE_MODEL, max_tokens=60, system=JUDGE,
            messages=[{"role": "user", "content": f"Site: {domain}\nTitle and description: {head[:400]}\nHomepage text: {text[:1800]}"}])
        out = json.loads(re.search(r"\{.*\}", msg.content[0].text, re.S).group(0))
        return out if out.get("industry") in INDUSTRIES + ["none"] else None
    except Exception:
        return None


HAVE: set[str] = set()      # domains already tracked or found this run (filled by main)
NAMES: set[str] = set()     # store names already tracked
_LOCK = __import__("threading").Lock()


def claim(domain: str) -> bool:
    """True the first time a domain is seen this run and it isn't tracked yet (thread-safe)."""
    with _LOCK:
        if domain in HAVE:
            return False
        HAVE.add(domain)
        return True


def check(domain: str) -> dict | None:
    s = requests.Session()
    s.headers.update({"User-Agent": config.USER_AGENT, "Accept-Language": "en-AU,en;q=0.9"})
    for base in (f"https://{domain}/", f"https://www.{domain}/"):
        try:
            rp = urllib.robotparser.RobotFileParser()
            rr = s.get(base + "robots.txt", timeout=10)
            rp.parse(rr.text.splitlines() if rr.status_code == 200 else [])
            if not config.robots_ok(rp, base):
                return None  # the site asks crawlers not to visit: respect it, don't add it
            r = s.get(base, timeout=12)
        except requests.RequestException:
            continue
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            continue
        final = re.sub(r"^https?://", "", r.url).split("/")[0].lower().removeprefix("www.")
        if final != domain:
            # it redirects to another address: that address is the store; skip it if we have it already
            if not (final.endswith(".au") or final.endswith(".com")) or not claim(final):
                return None
            domain, base = final, f"https://{re.sub(r'^https?://', '', r.url).split('/')[0]}/"
        html = r.text[:400_000]
        is_store = bool(PLATFORM.search(html)) and bool(PRODUCT.search(html)) and not MEDIA.search(html)
        if not is_store:
            return None
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
        desc = re.search(r"<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']*)", html, re.I)
        head = f"{title.group(1) if title else ''} {desc.group(1) if desc else ''}"
        head_words = set(re.sub(r"[^a-z ]", " ", head.lower()).split())
        if head_words & OUT_OF_SCOPE:
            return None
        text = html_to_text(html)
        if len(text) < 400:
            return None  # built by JavaScript: needs Firecrawl to read, which is out of credits; leave it for later
        site_name = re.search(r"<meta[^>]+property=[\"']og:site_name[\"'][^>]+content=[\"']([^\"']+)", html, re.I)
        brand = norm_name(site_name.group(1) if site_name else re.split(r"\s[|\u2013\u2014:-]\s", title.group(1) if title else "")[0])
        if len(brand) >= 4 and brand in NAMES:
            return None  # the same store under another address
        industry = classify(f"{head} {head} {head} " + text[:6000])  # title + description weigh most
        if not industry or not head_words & set(KW[industry]):
            return None  # the store's own title/description must name its industry
        v = judge(domain, head, text)  # final say: right industry, not adult, not out of scope
        if v is not None:
            if v.get("adult") or v["industry"] == "none":
                return None
            industry = v["industry"]
        if len(brand) >= 4:
            with _LOCK:
                if brand in NAMES:
                    return None
                NAMES.add(brand)
        return {"domain": domain, "homepage_url": base, "industry": industry}
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=750)
    ap.add_argument("--chunks", type=int, default=8)
    ap.add_argument("--per-industry", type=int, default=110)
    ap.add_argument("--max-check", type=int, default=6000)
    ap.add_argument("--source", choices=["tranco", "commoncrawl"], default="commoncrawl")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--review-since", help="re-judge stores added since this UTC time (e.g. 2026-11-27T10:35) instead of discovering")
    a = ap.parse_args()
    if a.review_since:
        return review(a.review_since, a.dry_run)

    have = existing()
    HAVE.update(have)
    NAMES.update(existing_names())
    src = tranco_au() if a.source == "tranco" else cc_au(a.max_check + len(have))
    cands = [d for d in src if d not in have][: a.max_check]
    print(f"{len(cands)} .au candidates not yet tracked", flush=True)
    found: list[dict] = []
    per: dict[str, int] = {}
    with ThreadPoolExecutor(24) as ex:
        futs = {ex.submit(lambda d: check(d) if claim(d) else None, d): d for d in cands}
        for f in as_completed(futs):
            try:
                x = f.result()
            except Exception:  # one odd site must not stop discovery
                x = None
            if not x or per.get(x["industry"], 0) >= a.per_industry or len(found) >= a.target:
                continue
            per[x["industry"]] = per.get(x["industry"], 0) + 1
            found.append(x)
            if len(found) % 50 == 0:
                print(f"found {len(found)}: {per}", flush=True)
            if len(found) >= a.target:
                for g in futs:
                    g.cancel()
                break
    print(f"found {len(found)} stores: {json.dumps(per)}", flush=True)
    if not found:
        return 1
    if not a.dry_run:
        h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
             "Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates,return=minimal"}
        rows = [{**x, "site_type": "ecommerce", "country": "AU", "scan_enabled": True, "full_scan_requested": True} for x in found]
        for i in range(0, len(rows), 200):
            r = requests.post(f"{config.SUPABASE_URL}/rest/v1/domains?on_conflict=domain", headers=h, json=rows[i:i + 200], timeout=60)
            r.raise_for_status()
    doms = [x["domain"] for x in found]
    size = -(-len(doms) // a.chunks)
    for n in range(a.chunks):
        part = doms[n * size:(n + 1) * size]
        if part:
            open(f"chunk_{n}.txt", "w").write(",".join(part))
    return 0


def review(since: str, dry: bool) -> int:
    """Re-judge stores added since a time: correct the industry, switch off adult/out-of-scope ones (never delete)."""
    h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"}
    rows = requests.get(f"{config.SUPABASE_URL}/rest/v1/domains?select=domain,homepage_url,industry"
                        f"&created_at=gt.{since}&scan_enabled=is.true&limit=5000", headers=h, timeout=60).json()
    print(f"reviewing {len(rows)} stores", flush=True)

    def one(r: dict):
        try:
            res = requests.get(r["homepage_url"] or f"https://{r['domain']}/", timeout=12, headers={"User-Agent": config.USER_AGENT})
            html = res.text[:400_000]
        except requests.RequestException:
            return r, None
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
        desc = re.search(r"<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']*)", html, re.I)
        return r, judge(r["domain"], f"{title.group(1) if title else ''} {desc.group(1) if desc else ''}", html_to_text(html))

    moved = off = 0
    with ThreadPoolExecutor(12) as ex:
        for r, v in ex.map(one, rows):
            if not v:
                continue
            patch = None
            if v.get("adult") or v["industry"] == "none":
                patch = {"scan_enabled": False, "full_scan_requested": False,
                         "last_scan_error": "switched off by discovery review: " + ("adult store" if v.get("adult") else "outside our 9 industries")}
                off += 1
            elif v["industry"] != r["industry"]:
                patch = {"industry": v["industry"]}
                moved += 1
            if patch:
                print(f"{r['domain']}: {r['industry']} -> {patch}", flush=True)
                if not dry:
                    requests.patch(f"{config.SUPABASE_URL}/rest/v1/domains?domain=eq.{r['domain']}",
                                   headers={**h, "Content-Type": "application/json", "Prefer": "return=minimal"}, json=patch, timeout=30)
    print(f"review done: {moved} moved to another industry, {off} switched off", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
