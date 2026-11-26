"""One scan of one site -> one payload in the format ingest_scan() expects."""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from . import config, detect, discover, extract, shopify, terms
from .detect import fact
from .fetch import Fetcher

AU_TZ = timezone(timedelta(hours=10, minutes=30))


def scan_site(domain: str, homepage_url: str, platform: str | None = None,
              mode: str = "full", use_ai: bool = True) -> dict:
    """mode: 'full' (all categories, monthly) or 'weekly' (promotions, products, content only)."""
    started = datetime.now(AU_TZ)
    parsed = urlparse(homepage_url)
    base = f"{parsed.scheme}://{parsed.netloc}/"
    f = Fetcher(base)
    facts: list[dict] = []
    promos_live: list[dict] = []
    promo_history: list[dict] = []
    products: list[dict] = []
    issues: list[str] = []
    ai = use_ai and bool(config.ANTHROPIC_API_KEY)
    if use_ai and not ai:
        issues.append("ANTHROPIC_API_KEY not set: AI page reading skipped")

    robots = f.load_robots()
    home = f.fetch(homepage_url)
    status = "complete"

    if home.status != 200 or not home.html:
        status = "failed"
        issues.append(f"homepage not readable: status {home.status} {home.note or ''}".strip())
        return _payload(domain, started, status, f, facts, promos_live, promo_history, products, issues, mode)

    if len(home.text) < 400:
        issues.append("homepage text very short; likely built by JavaScript")

    # ---- terms-of-use gate: before any facts are collected ------------------
    sm = discover.read_sitemaps(f)
    candidates = [u for u, _ in sm["pages"]] + discover.footer_and_nav_links(home.html, base)
    gate = terms.check_terms(f, candidates)
    terms_info = {"verdict": gate.verdict, "url": gate.url, "evidence": gate.evidence,
                  "unclear_policy": terms.UNCLEAR_POLICY, "blocked_scan": gate.blocks_scan}
    if gate.blocks_scan:
        p = _payload(domain, started, "failed", f, [], [], [], [], [f"stopped by terms gate: {gate.verdict}"], mode)
        p["terms_gate"], p["skip_ingest"] = terms_info, True
        return p

    # ---- code-based facts (always) ----------------------------------------
    tech_facts, detected_platform = detect.detect_tech(home.html, home.url)
    platform = (detected_platform or platform or "").lower() or None
    facts += detect.detect_homepage_signals(home.html, home.text, home.url)
    sd_facts, _ = detect.detect_structured_data(home.html, home.url)
    facts += sd_facts
    facts.append(fact("policies", "terms_scraping_verdict", gate.verdict, source_url=gate.url,
                      evidence=gate.evidence if gate.verdict == "prohibited" else None,
                      method="code" if not config.ANTHROPIC_API_KEY else "ai_text"))

    # ---- sitemaps: content activity --------------------------------------
    facts += _content_facts(sm, base, started)

    # ---- promotions (weekly + full) ----------------------------------------
    if ai:
        try:
            promos_live += [dict(p, live=True, source="homepage") for p in extract.read_promotions(home.url, home.text)]
        except Exception as e:
            issues.append(f"AI read failed for homepage promotions: {type(e).__name__}: {str(e)[:200]}")
    pages_by_type = discover.classify_pages(candidates, base)
    if ai and pages_by_type.get("promo_terms"):
        pt = f.fetch(pages_by_type["promo_terms"][0])
        try:
            promo_items = extract.read_promotions(pt.url, pt.text) if pt.status == 200 and pt.text else []
        except Exception as e:
            promo_items = []
            issues.append(f"AI read failed for promo terms: {type(e).__name__}: {str(e)[:200]}")
        if promo_items:
            for p in promo_items:
                if p["live"]:
                    promos_live.append(p)
                else:
                    promo_history.append({"name": p["headline"], "type": p["type"],
                                          "starts": p["starts"], "ends": p["ends"]})

    # ---- products: category top-10s (weekly + full) ------------------------
    if platform == "shopify":
        cats = discover.top_categories(home.html, base, config.MAX_CATEGORIES)
        if not cats:
            issues.append("no category links found in navigation")
        for c in cats:
            items = shopify.collection_products(f, c, config.TOP_PER_CATEGORY)
            products += items
            if items:
                facts.append(_category_summary(c, items))
        best = [u for u, _ in sm["collections"] if "best" in urlparse(u).path.lower()]
        if best:
            items = shopify.collection_products(f, best[0], 10)
            products += [dict(i, list="best_sellers") for i in items]
            if items:
                facts.append(_category_summary(best[0], items, key_prefix="best_sellers"))
    else:
        issues.append(f"platform '{platform or 'unknown'}': category top-10 prices not yet supported")

    if mode == "full":
        facts += tech_facts
        facts += detect.detect_payments(home.html, home.text, home.url)
        llms = f.fetch("/llms.txt", want_text=True)
        facts += detect.detect_ai_readiness(robots, llms.status, llms.text, base)

        # ---- AI reading of policy / info pages -----------------------------
        if ai:
            budget = config.MAX_INFO_PAGES
            for ptype in ("returns", "shipping", "payments", "loyalty", "warranty", "faq", "stores"):
                urls = pages_by_type.get(ptype) or []
                if not urls or budget <= 0:
                    continue
                url = urls[0]
                page = f.fetch_rendered(url) if ptype == "stores" else f.fetch(url)
                if page.status == 200 and len(page.text) < 300:
                    page = f.fetch_rendered(url)
                if page.status != 200 or not page.text:
                    issues.append(f"{ptype} page not readable: {url} ({page.note or page.status})")
                    continue
                budget -= 1
                try:
                    facts += extract.read_page(ptype, page.url, page.text)
                except Exception as e:  # one bad page must not sink the scan
                    issues.append(f"AI read failed for {url}: {type(e).__name__}: {str(e)[:200]}")
        missing = [t for t in ("returns", "shipping") if t not in pages_by_type]
        if missing:
            issues.append(f"no page found for: {', '.join(missing)}")

    if issues and status == "complete":
        status = "partial"
    p = _payload(domain, started, status, f, _merge(facts), promos_live, promo_history, products, issues, mode,
                 platform=platform)
    p["terms_gate"] = terms_info
    return p


# -----------------------------------------------------------------------------
def _merge(facts: list[dict]) -> list[dict]:
    """One fact per key. Priority: verified + agreed AI read of a dedicated page, then code,
    then everything else. Two strong sources that disagree -> 'conflicting'."""
    by_key: dict[str, list[dict]] = {}
    for x in facts:
        by_key.setdefault(f"{x['category']}.{x['key']}", []).append(x)

    def strength(x):
        observed = x["status"] in ("observed", "not_offered")
        return (observed, x.get("evidence_verified") is True, x["method"] == "ai_text",
                {"high": 2, "medium": 1, "low": 0}.get(x.get("confidence"), 0))

    out = []
    for key, xs in by_key.items():
        xs.sort(key=strength, reverse=True)
        best = dict(xs[0])
        strong = [x for x in xs if x["status"] == "observed" and x.get("evidence_verified") is True]
        values = {extract._canon_json(x["value"]) for x in strong}
        if len(values) > 1:
            best["status"] = "conflicting"
            best["confidence"] = "low"
            best["note"] = "sources disagree: " + " | ".join(
                f"{x['source_url']}: {str(x['value'])[:80]}" for x in strong)
        out.append(best)
    return out


def _category_summary(collection_url: str, items: list[dict], key_prefix: str = "category_top10") -> dict:
    handle = urlparse(collection_url).path.rstrip("/").split("/")[-1]
    prices = [i["price"] for i in items if i["price"] is not None]
    on_sale = [i for i in items if i["compare_at_price"] and i["price"] and i["compare_at_price"] > i["price"]]
    discounts = [(i["compare_at_price"] - i["price"]) / i["compare_at_price"] for i in on_sale]
    return fact("products", f"{key_prefix}.{handle}", {
        "count": len(items),
        "avg_price": round(statistics.mean(prices), 2) if prices else None,
        "median_price": round(statistics.median(prices), 2) if prices else None,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "pct_on_sale": round(100 * len(on_sale) / len(items), 1) if items else None,
        "avg_discount_pct": round(100 * statistics.mean(discounts), 1) if discounts else None,
        "out_of_stock": sum(1 for i in items if not i["available"]),
    }, source_url=collection_url, note="Collection's own order via products.json")


def _content_facts(sm: dict, base: str, started: datetime) -> list[dict]:
    out = []
    src = base + "sitemap.xml"
    if sm["product_urls"] is not None:
        out.append(fact("site_identity", "product_url_count", sm["product_urls"], source_url=src))
    out.append(fact("site_identity", "info_page_count", len(sm["pages"]), source_url=src))
    out.append(fact("ai_readiness", "agentic_sitemap", sm["agentic"], source_url=src))
    cutoff = (started - timedelta(days=30)).date().isoformat()
    recent = sorted(((u, lm[:10]) for u, lm in sm["pages"] + sm["collections"] if lm and lm[:10] >= cutoff),
                    key=lambda x: x[1], reverse=True)[:25]
    out.append(fact("content_marketing", "pages_updated_last_30_days",
                    [{"url": u, "lastmod": d} for u, d in recent], source_url=src))
    blog_recent = sum(1 for _, lm in sm["blogs"] if lm and lm[:10] >= cutoff)
    out.append(fact("content_marketing", "blog_items_updated_last_30_days", blog_recent, source_url=src))
    out.append(fact("content_marketing", "collection_count", len(sm["collections"]), source_url=src))
    return out


def _payload(domain, started, status, f, facts, promos_live, promo_history, products, issues, mode, platform=None):
    return {
        "scan": {
            "domain": domain, "site_type": "ecommerce", "scan_started_at": started.isoformat(),
            "scan_finished_at": datetime.now(AU_TZ).isoformat(),
            "schema_version": config.SCHEMA_VERSION,
            "scanner": f"{config.SCANNER_VERSION} ({mode}); AI model {config.CLAUDE_MODEL}",
            "scan_location": "AU (GitHub Actions runner; may not be in Australia)",
            "device": "desktop", "logged_in": False, "scan_status": status,
            "robots_txt_respected": "Yes: every URL checked against robots.txt before fetching",
            "platform": platform,
            "pages_fetched": [p.record() for p in f.pages],
        },
        "facts": facts,
        "promotions": _dedupe_promos(promos_live),
        "promotion_history_from_terms_page": promo_history,
        "products": _dedupe_products(products),
        "issues_found": issues,
    }


def _dedupe_promos(ps):
    seen, out = set(), []
    for p in ps:
        k = (p["headline"].lower().strip(), p.get("starts"))
        if k not in seen:
            seen.add(k)
            out.append(p)
    return out


def _dedupe_products(ps):
    seen, out = set(), []
    for p in ps:
        if p["external_id"] not in seen:
            seen.add(p["external_id"])
            out.append(p)
    return out
