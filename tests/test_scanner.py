"""Offline tests: a fake Shopify store served through a mocked HTTP session."""
import json

import pytest
import requests

from ledger_scanner import config, detect, discover, extract, scan

BASE = "https://shop.example.com.au/"

HOME = """<html><head><title>Example Jewels | Fine jewellery</title>
<meta name="description" content="Shop rings and necklaces.">
<script src="https://cdn.shopify.com/s/files/theme.js"></script>
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
<script type="application/ld+json">{"@type":"Organization","name":"Example Jewels","sameAs":["https://instagram.com/x"]}</script>
</head><body><header><nav>
<a href="/collections/rings">Rings</a><a href="/collections/necklaces">Necklaces</a>
<a href="/collections/sale">Sale</a><a href="/pages/returns">Returns</a></nav></header>
<div>Enjoy FREE SHIPPING Australia-wide on all online orders over $70.</div>
<div>Pay in 4 with Afterpay</div><div>12 Stores Australia Wide</div>
<footer>Visa Mastercard PayPal Shop Pay</footer></body></html>"""

ROBOTS = "User-agent: *\nDisallow: /policies/\nDisallow: /collections/*sort_by*\n\nUser-agent: GPTBot\nDisallow: /\n"

SITEMAP = f"""<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>{BASE}sitemap_products_1.xml</loc></sitemap>
<sitemap><loc>{BASE}sitemap_pages_1.xml</loc></sitemap>
<sitemap><loc>{BASE}sitemap_collections_1.xml</loc></sitemap></sitemapindex>"""

PAGES = f"""<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>{BASE}pages/returns</loc><lastmod>2099-01-01T00:00:00+10:30</lastmod></url>
<url><loc>{BASE}pages/delivery-information</loc><lastmod>2020-01-01T00:00:00+10:30</lastmod></url>
<url><loc>{BASE}pages/offer-terms-and-conditions</loc></url></urlset>"""

PRODUCTS_SM = f"""<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>{BASE}products/a</loc></url><url><loc>{BASE}products/b</loc></url></urlset>"""

COLLECTIONS_SM = f"""<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>{BASE}collections/best-sellers</loc></url></urlset>"""


def products_json(n, sale=False):
    return json.dumps({"products": [{
        "id": 1000 + i, "handle": f"p{i}", "title": f"Ring {i}", "product_type": "Rings",
        "variants": [{"price": f"{100 + i}.00", "compare_at_price": f"{200 + i}.00" if sale and i % 2 else None,
                      "available": i != 3}]} for i in range(n)]})


ROUTES = {
    "robots.txt": (200, ROBOTS, "text/plain"),
    "": (200, HOME, "text/html"),
    "llms.txt": (404, "not found", "text/html"),
    "sitemap.xml": (200, SITEMAP, "application/xml"),
    "sitemap_pages_1.xml": (200, PAGES, "application/xml"),
    "sitemap_products_1.xml": (200, PRODUCTS_SM, "application/xml"),
    "sitemap_collections_1.xml": (200, COLLECTIONS_SM, "application/xml"),
    "collections/rings/products.json?limit=10": (200, products_json(10, sale=True), "application/json"),
    "collections/necklaces/products.json?limit=10": (200, products_json(4), "application/json"),
    "collections/best-sellers/products.json?limit=10": (200, products_json(10), "application/json"),
}


class FakeResp:
    def __init__(self, status, body, ctype):
        self.status_code, self.text, self.content = status, body, body.encode()
        self.headers = {"content-type": ctype}


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    calls = []

    def get(self, url, **kw):
        path = url.replace(BASE, "")
        calls.append(path)
        status, body, ctype = ROUTES.get(path, (404, "nope", "text/html"))
        return FakeResp(status, body, ctype)

    monkeypatch.setattr(requests.Session, "get", get)
    monkeypatch.setattr(config, "SECONDS_BETWEEN_REQUESTS", 0)
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "")
    return calls


def test_full_scan_without_ai(fake_http):
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    keys = {f"{f['category']}.{f['key']}": f for f in p["facts"]}
    assert keys["tech_stack.platform"]["value"] == "Shopify"
    assert {"Shopify", "Google Tag Manager", "Klaviyo"} <= set(keys["tech_stack.technologies"]["value"])
    assert keys["shipping.free_shipping_threshold"]["value"] == {"amount": 70, "currency": "AUD"}
    assert keys["site_identity.store_count"]["value"] == 12
    assert "afterpay" in keys["payments.bnpl_providers"]["value"]
    assert keys["ai_readiness.robots_ai_bot_rules"]["value"]["GPTBot"] == "blocked"
    assert keys["ai_readiness.robots_blocks_policies"]["value"] is True
    assert keys["ai_readiness.llms_txt"]["value"] is False
    assert keys["site_identity.product_url_count"]["value"] == 2
    assert keys["site_identity.trading_name"]["value"] == "Example Jewels"
    rings = keys["products.category_top10.rings"]["value"]
    assert rings["count"] == 10 and rings["pct_on_sale"] == 50.0 and rings["out_of_stock"] == 1
    assert "products.category_top10.sale" not in keys          # sale collection skipped
    assert "products.best_sellers.best-sellers" in keys
    assert len(p["products"]) == 10                             # same ids across lists are deduped
    assert len({f"{f['category']}.{f['key']}" for f in p["facts"]}) == len(p["facts"])  # one row per key


def test_robots_respected(fake_http):
    scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert not any(c.startswith("policies/") for c in fake_http)
    assert not any("sort_by" in c for c in fake_http)


def test_evidence_check():
    page = "Items must be returned within 14 days of delivery. Earrings can’t be returned."
    assert extract.evidence_on_page("returned within 14 days of delivery", page)
    assert extract.evidence_on_page("Earrings can't be returned", page)
    assert not extract.evidence_on_page("returned within 30 days", page)
    assert extract.evidence_on_page("must be returned ... 14 days of delivery", page)


def test_merge_conflict_and_priority():
    a = detect.fact("shipping", "free_shipping_threshold", {"amount": 70}, source_url="home", evidence="over $70",
                    confidence="medium")
    b = {"category": "shipping", "key": "free_shipping_threshold", "status": "observed", "value": {"amount": 100},
         "evidence": "over $100", "evidence_verified": True, "source_url": "ship", "method": "ai_text", "confidence": "high"}
    merged = scan._merge([a, b])
    assert len(merged) == 1 and merged[0]["status"] == "conflicting"
    c = dict(b, value={"amount": 70})
    merged = scan._merge([a, c])
    assert merged[0]["status"] == "observed" and merged[0]["source_url"] == "ship"


def test_read_page_two_reads(monkeypatch):
    text = "You can return items within 14 days of delivery for a refund."
    reads = iter([
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days of delivery", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days of delivery", "confidence": "high"}],
    ])
    monkeypatch.setattr(extract, "_ask", lambda *a, **k: next(reads))
    out = extract.read_page("returns", "u", text)
    assert out[0]["evidence_verified"] is True and out[0]["confidence"] == "high"

    reads = iter([
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 30, "evidence": "within 30 days", "confidence": "high"}],
    ])
    monkeypatch.setattr(extract, "_ask", lambda *a, **k: next(reads))
    out = extract.read_page("returns", "u", text)
    assert out[0]["status"] == "conflicting" and out[0]["evidence_verified"] is False


def test_classify_and_categories():
    pages = discover.classify_pages([BASE + "pages/returns", BASE + "pages/delivery-information",
                                     BASE + "pages/offer-terms-and-conditions", "https://other.com/pages/returns"], BASE)
    assert pages["returns"] == [BASE + "pages/returns"]
    assert pages["shipping"] == [BASE + "pages/delivery-information"]
    assert pages["promo_terms"] == [BASE + "pages/offer-terms-and-conditions"]
    cats = discover.top_categories(HOME, BASE, 8)
    assert cats == [BASE + "collections/rings", BASE + "collections/necklaces"]
