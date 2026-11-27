"""Find Australian online stores to track, automatically (no AI, no manual checks).

Source: the public Tranco list of the top 1M websites (research ranking, https://tranco-list.eu).
Keeps .com.au / .au domains in rank order, skips ones already tracked, reads each homepage once
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
SKIP_SUFFIX = (".gov.au", ".edu.au", ".org.au", ".net.au", ".asn.au", ".id.au", ".csiro.au", ".nsw.gov.au")
SKIP_WORDS = re.compile(r"(news|bank|insurance|realestate|jobs|council|casino|lotto|loans?|weather|forum|airline)", re.I)
PLATFORM = re.compile(r"cdn\.shopify\.com|Shopify\.theme|woocommerce|bigcommerce|cdn11\.bigcommerce|Magento|mage/cookies|"
                      r"neto\.com\.au|netostatic|maropost|demandware|shopware|prestashop", re.I)
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


def check(domain: str) -> dict | None:
    s = requests.Session()
    s.headers.update({"User-Agent": config.USER_AGENT, "Accept-Language": "en-AU,en;q=0.9"})
    for base in (f"https://{domain}/", f"https://www.{domain}/"):
        try:
            rp = urllib.robotparser.RobotFileParser()
            rr = s.get(base + "robots.txt", timeout=10)
            rp.parse(rr.text.splitlines() if rr.status_code == 200 else [])
            if not rp.can_fetch(config.ROBOTS_AGENT, base):
                return None  # the site asks crawlers not to visit: respect it, don't add it
            r = s.get(base, timeout=12)
        except requests.RequestException:
            continue
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            continue
        html = r.text[:400_000]
        is_store = bool(PLATFORM.search(html)) or (bool(CART.search(html)) and len(PRICE.findall(html)) >= 3)
        if not is_store:
            return None
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
        desc = re.search(r"<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']*)", html, re.I)
        head = f"{title.group(1) if title else ''} {desc.group(1) if desc else ''}"
        industry = classify(f"{head} {head} {head} " + html_to_text(html)[:6000])  # title + description weigh most
        if not industry:
            return None
        return {"domain": domain, "homepage_url": base, "industry": industry}
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=750)
    ap.add_argument("--chunks", type=int, default=8)
    ap.add_argument("--per-industry", type=int, default=110)
    ap.add_argument("--max-check", type=int, default=6000)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    have = existing()
    cands = [d for d in tranco_au() if d not in have][: a.max_check]
    print(f"{len(cands)} .au candidates not yet tracked", flush=True)
    found: list[dict] = []
    per: dict[str, int] = {}
    with ThreadPoolExecutor(24) as ex:
        futs = {ex.submit(check, d): d for d in cands}
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


if __name__ == "__main__":
    sys.exit(main())
