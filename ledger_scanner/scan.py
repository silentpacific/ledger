"""One scan of one site -> one payload in the format ingest_scan() expects."""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from . import config, detect, discover, extract, pagetext, products_generic, promos, shopify, terms
from .detect import fact
from .batch import Pending
from .fetch import Fetcher

AU_TZ = timezone(timedelta(hours=10, minutes=30))


def scan_site(domain: str, homepage_url: str, platform: str | None = None,
              mode: str = "full", use_ai: bool = True, industry: str | None = None,
              previous: dict | None = None) -> dict:
    """mode: 'full' (all categories, monthly) or 'weekly' (promotions, products, content only).
    previous: what earlier scans stored for this site (db.previous_pages), so unchanged pages
    reuse their facts instead of being read by the AI again. None = read everything."""
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
    stores = discover.store_pages(sm)
    if len(stores) >= 3:
        facts.append(fact("site_identity", "store_count", len(stores), source_url=base + "sitemap.xml",
                          evidence=f"{len(stores)} store pages listed in the sitemap, e.g. {stores[0]}",
                          confidence="medium", note="Counted store pages in the sitemap; a store-locator read takes priority"))

    # ---- promotions (weekly + full) ----------------------------------------
    if ai:
        try:
            promos_live += [dict(p, live=True, source="homepage") for p in extract.read_promotions(home.url, home.text)]
        except Pending:
            pass  # batch mode: answered in a later round
        except Exception as e:
            issues.append(f"AI read failed for homepage promotions: {type(e).__name__}: {str(e)[:200]}")
    lastmods = {u: lm for u, lm in sm["pages"] if lm}
    if platform == "shopify":  # built-in policy pages exist on every Shopify store, linked or not
        candidates = candidates + discover.shopify_policy_urls(base)
    pages_by_type = discover.classify_pages(candidates, base, lastmods, discover.link_texts(home.html, base))
    # no dedicated page: shipping and returns are often answered in the FAQ, else the site terms
    for need in ("shipping", "returns"):
        if not pages_by_type.get(need):
            fallback = (pages_by_type.get("faq") or [])[:1] or [u for u in (pages_by_type.get("terms") or [])
                                                                 if terms.is_general_terms(u)][:1]
            if fallback:
                pages_by_type[need] = fallback
    if ai and pages_by_type.get("promo_terms"):
        pt = f.fetch(pages_by_type["promo_terms"][0])
        try:
            promo_items = extract.read_promotions(pt.url, pt.text) if pt.status == 200 and pt.text else []
        except Pending:
            promo_items = []
        except Exception as e:
            promo_items = []
            issues.append(f"AI read failed for promo terms: {type(e).__name__}: {str(e)[:200]}")
        if promo_items:
            for p in promo_items:
                if p["live"]:
                    promos_live.append(p)
                else:
                    promo_history.append({"name": p["headline"], "type": p["type"], "discount": p.get("discount"),
                                          "starts": p["starts"], "ends": p["ends"]})

    # ---- products: category top-10s (weekly + full) ------------------------
    if platform == "shopify":
        cats = discover.top_categories(home.html, base, config.MAX_CATEGORIES)
        if not cats:
            cats = shopify.top_collections(f, config.MAX_CATEGORIES, [u for u, _ in sm["collections"]])
        if not cats:
            issues.append("no product categories found (menu, collections list or sitemap)")
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
        got = []
        if platform in ("woocommerce", "wordpress"):
            got, used = products_generic.woocommerce_products(f, config.MAX_CATEGORIES, config.TOP_PER_CATEGORY)
            for c in used:
                items = [i for i in got if i["collection"] == c["slug"]]
                facts.append(_category_summary(base + "product-category/" + c["slug"], items,
                                               note="Most popular first, from the store's public WooCommerce Store API"))
        if not got:
            got = products_generic.jsonld_products(f, home.html, base, 12)
            if got:
                facts.append(_category_summary(base + "homepage", got, key_prefix="homepage_featured",
                                               note="Products linked from the homepage, priced from their schema.org data"))
        products += got
        if not got:
            issues.append(f"platform '{platform or 'unknown'}': no product prices found (Store API or product data)")

    if mode == "full":
        facts += tech_facts
        facts += detect.detect_payments(home.html, home.text, home.url)
        llms = f.fetch("/llms.txt", want_text=True)
        facts += detect.detect_ai_readiness(robots, llms.status, llms.text, base)

        facts += detect.detect_free_shipping(home.text, home.url)

        # ---- AI reading of policy / info pages -----------------------------
        if ai:
            site_links = {u: "" for u, _ in sm["pages"]}
            site_links.update(discover.link_texts(home.html, base))
            facts += _read_info_pages(f, pages_by_type, home, base, industry, issues, site_links, previous)
        missing = [t for t in ("returns", "shipping") if t not in pages_by_type]
        if missing:
            issues.append(f"no page found for: {', '.join(missing)}")

    if issues and status == "complete":
        status = "partial"
    p = _payload(domain, started, status, f, _merge(facts), promos_live, promo_history, products, issues, mode,
                 platform=platform)
    p["pages_chosen"] = {k: v[:2] for k, v in pages_by_type.items()}
    p["terms_gate"] = terms_info
    return p


# -----------------------------------------------------------------------------
# A page type is "answered" once one of these facts is found; until then we keep reading candidates.
CORE_FACTS = {
    "returns": ("policies.returns.period_days", "policies.returns.change_of_mind"),
    "shipping": ("shipping.free_shipping_threshold", "shipping.standard_shipping_cost"),
}
MAX_TRIES = 3  # pages read per core type before giving up


def _read_info_pages(f: Fetcher, pages_by_type: dict, home, base: str, industry: str | None,
                     issues: list[str], site_links: dict[str, str] | None = None,
                     previous: dict | None = None) -> list[dict]:
    """Read policy/info pages with the AI. For returns and shipping: if a page doesn't give the core
    facts, follow its links to a fuller page of the same type, then try the next candidate
    (up to MAX_TRIES pages). Pages with no content of their own (empty, or built by JavaScript)
    are rendered once, and skipped without an AI call if still empty. Last resort, within its caps:
    the stronger model picks likely pages from the site's link list, and those are read too."""
    facts: list[dict] = []
    budget = config.MAX_INFO_PAGES
    home_lines = pagetext.shared_lines(home.text)
    fetched: dict[str, object] = {}
    for ptype in ("returns", "shipping", "payments", "loyalty", "warranty", "contact", "faq", "stores"):
        core = CORE_FACTS.get(ptype)
        queue = list(pages_by_type.get(ptype) or [])
        builtin = [u for u in queue if "/policies/" in u]  # Shopify's own policy pages: after the store's own pages
        queue = [u for u in queue if u not in builtin] + builtin
        if core:  # last resorts: the FAQ, then the general terms
            queue += (pages_by_type.get("faq") or [])[:1]
            queue += [u for u in (pages_by_type.get("terms") or []) if terms.is_general_terms(u)][:1]
        limit = MAX_TRIES if core else (2 if ptype == "payments" else 1)
        tried: list[str] = []
        answered = False
        asked_for_links = False
        found: set[str] = set()
        while budget > 0 and not answered:
            if not queue or len(tried) >= limit:
                if not core or asked_for_links:
                    break
                asked_for_links = True  # last resort: let the stronger model pick from the link list
                try:
                    picks = extract.pick_policy_links(ptype, {u: t for u, t in (site_links or {}).items() if u not in tried})
                except Pending:
                    break
                if not picks:
                    break
                issues.append(f"{ptype}: {config.ESCALATION_MODEL} suggested {', '.join(picks)}")
                queue, limit = picks, len(tried) + len(picks)
                continue
            url = queue.pop(0)
            if url in tried:
                continue
            tried.append(url)
            page = fetched.get(url)
            if page is None:
                page = f.fetch_rendered(url) if ptype == "stores" else f.fetch(url)
                if page.status == 200 and len(page.text) < 300:
                    page = f.fetch_rendered(url)
                fetched[url] = page
            if page.status != 200 or not page.text:
                issues.append(f"{ptype} page not readable: {url} ({page.note or page.status})")
                continue
            text = pagetext.own_text(page.text, home_lines) if url.rstrip("/") != home.url.rstrip("/") else page.text
            if core and pagetext.looks_empty(text, ptype) and page.method != "firecrawl":
                rendered = f.fetch_rendered(url)
                if rendered.status == 200 and rendered.text:
                    page, text = rendered, pagetext.own_text(rendered.text, home_lines)
                    fetched[url] = page
            if core and pagetext.looks_empty(text, ptype):
                issues.append(f"{ptype} page has no {ptype} content of its own: {url}")
                queue = [u for u in discover.links_of_type(page.html, base, ptype) if u not in tried] + queue
                continue
            fp = pagetext.fingerprint(text, extract.question_signature(industry))
            page.content_hash = fp
            got = _unchanged_facts(previous, page.url, fp)
            if got is None:
                budget -= 1
                try:
                    got = extract.read_page(ptype, page.url, text, industry, core or ())
                except Pending:
                    break  # batch mode: this type continues in the next round
                except Exception as e:  # one bad page must not sink the scan
                    issues.append(f"AI read failed for {url}: {type(e).__name__}: {str(e)[:200]}")
                    continue
            facts += got
            if not core:
                if ptype != "payments":
                    answered = True
                continue
            found |= {f"{x['category']}.{x['key']}" for x in got if x["status"] in ("observed", "not_offered")}
            answered = all(k in found for k in core)  # keep going (within MAX_TRIES) until every core fact is found
            if not answered:  # a summary page: try the fuller page it links to first
                queue = [u for u in discover.links_of_type(page.html, base, ptype) if u not in tried] + queue
        if core and tried and not answered:
            issues.append(f"{ptype}: core facts not found after reading {len(tried)} page(s): {', '.join(tried)}")
    return facts


def _unchanged_facts(previous: dict | None, url: str, fp: str) -> list[dict] | None:
    """The stored facts of a page whose fingerprint hasn't changed since the last scan, or None."""
    if not previous or previous.get("hashes", {}).get(url) != fp:
        return None
    stored = previous.get("facts", {}).get(url)
    if not stored:
        return None
    since = (previous.get("at", {}).get(url) or "")[:10]
    out = []
    for x in stored:
        cat = x["category"]
        out.append({"category": cat, "key": x["fact_key"][len(cat) + 1:], "status": x["status"], "value": x.get("value"),
                    "unit": x.get("unit"), "evidence": x.get("evidence"), "evidence_verified": x.get("evidence_verified"),
                    "source_url": url, "method": "ai_text", "confidence": x.get("confidence") or "medium",
                    "note": f"page unchanged since {since}; facts carried over without a new AI read"})
    return out


UNION_KEYS = {"payments.bnpl_providers", "payments.payment_icons", "trust_support.support_channels",
              "shipping.carriers", "site_identity.states_with_stores"}


def _merge(facts: list[dict]) -> list[dict]:
    """One fact per key. Priority: verified + agreed AI read of a dedicated page, then code,
    then everything else. Two strong sources that disagree -> 'conflicting'."""
    by_key: dict[str, list[dict]] = {}
    for x in facts:
        by_key.setdefault(f"{x['category']}.{x['key']}", []).append(x)

    def strength(x):
        observed = x["status"] in ("observed", "not_offered")
        # a disagreement shows the page does say something: it ranks above "not on this page"
        return (observed, x["status"] == "conflicting", x.get("evidence_verified") is True, x["method"] == "ai_text",
                {"high": 2, "medium": 1, "low": 0}.get(x.get("confidence"), 0))

    out = []
    for key, xs in by_key.items():
        for x in xs:
            if isinstance(x.get("value"), dict) and "amount" in x["value"]:
                x["value"] = extract.money(x["value"])
        xs.sort(key=strength, reverse=True)
        best = dict(xs[0])
        if key in UNION_KEYS:
            observed = [x for x in xs if x["status"] == "observed" and isinstance(x.get("value"), list)]
            if observed:
                best["value"] = sorted({str(v).lower() for x in observed for v in x["value"]})
                best["note"] = "union of: " + ", ".join(sorted({x["source_url"] or "" for x in observed}))
            out.append(best)
            continue
        strong = [x for x in xs if x["status"] == "observed" and x.get("evidence_verified") is True]
        values = {extract._canon_json(x["value"]) for x in strong}
        if len(values) > 1:
            best["status"] = "conflicting"
            best["confidence"] = "low"
            best["note"] = "sources disagree: " + " | ".join(
                f"{x['source_url']}: {str(x['value'])[:80]}" for x in strong)
        out.append(best)
    return out


def _category_summary(collection_url: str, items: list[dict], key_prefix: str = "category_top10",
                      note: str = "Collection's own order via products.json") -> dict:
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
    }, source_url=collection_url, note=note)


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
        "promotions": promos.merge_list(promos_live),
        "promotion_history_from_terms_page": promos.merge_list(promo_history),
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


def recheck_terms(domain: str, homepage_url: str) -> dict:
    """Terms-only check for a switched-off site: robots, homepage, sitemap and the terms page. No facts."""
    parsed = urlparse(homepage_url)
    base = f"{parsed.scheme}://{parsed.netloc}/"
    f = Fetcher(base)
    f.load_robots()
    home = f.fetch(homepage_url)
    if home.status in (401, 403) or (home.status != 200 and not home.html):
        return {"verdict": "blocked" if home.status in (401, 403) else "unclear", "url": homepage_url,
                "evidence": f"homepage returned {home.status} to LedgerBot"}
    sm = discover.read_sitemaps(f)
    candidates = [u for u, _ in sm["pages"]] + discover.footer_and_nav_links(home.html, base)
    gate = terms.check_terms(f, candidates)
    return {"verdict": gate.verdict, "url": gate.url, "evidence": gate.evidence}
