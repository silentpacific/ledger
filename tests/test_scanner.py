"""Offline tests: a fake Shopify store served through a mocked HTTP session."""
import json

import pytest
import requests

from ledger_scanner import config, detect, discover, extract, scan, shopify

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
<url><loc>{BASE}pages/offer-terms-and-conditions</loc></url>
<url><loc>{BASE}pages/terms-and-conditions</loc></url></urlset>"""

TERMS_OK = "<html><body>" + "These terms govern your use of our store. Prices are in AUD. " * 20 + "</body></html>"
TERMS_NO = "<html><body>" + "These terms govern your use of our store. " * 20 + \
    "You must not use any robot, spider or other automated means to access or copy content from this website." + "</body></html>"

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
    "pages/terms-and-conditions": (200, TERMS_OK, "text/html"),
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

    # reads disagree; the stronger model also says 30 (quote not on page) -> stays conflicting
    reads = iter([
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 30, "evidence": "within 30 days", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 30, "evidence": "within 30 days", "confidence": "high"}],
    ])
    monkeypatch.setattr(extract, "_ask", lambda *a, **k: next(reads))
    out = extract.read_page("returns", "u", text)
    assert out[0]["status"] == "conflicting" and out[0]["evidence_verified"] is False

    # reads disagree; the stronger model agrees with the first read and its quote is on the page -> settled
    calls = []
    reads = iter([
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 30, "evidence": "within 30 days", "confidence": "high"}],
        [{"key": "returns.period_days", "status": "observed", "value": 14, "evidence": "within 14 days of delivery", "confidence": "high"}],
    ])
    def fake(*a, **k):
        calls.append(k.get("model"))
        return next(reads)
    monkeypatch.setattr(extract, "_ask", fake)
    out = extract.read_page("returns", "u", text)
    assert out[0]["status"] == "observed" and out[0]["evidence_verified"] is True and out[0]["value"] == 14
    assert calls[-1] == extract.config.ESCALATION_MODEL


def test_classify_and_categories():
    pages = discover.classify_pages([BASE + "pages/returns", BASE + "pages/delivery-information",
                                     BASE + "pages/offer-terms-and-conditions", "https://other.com/pages/returns"], BASE)
    assert pages["returns"] == [BASE + "pages/returns"]
    assert pages["shipping"] == [BASE + "pages/delivery-information"]
    assert pages["promo_terms"] == [BASE + "pages/offer-terms-and-conditions"]
    cats = discover.top_categories(HOME, BASE, 8)
    assert cats == [BASE + "collections/rings", BASE + "collections/necklaces"]


def test_terms_prohibited_stops_scan(fake_http, monkeypatch):
    monkeypatch.setitem(ROUTES, "pages/terms-and-conditions", (200, TERMS_NO, "text/html"))
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["skip_ingest"] is True and p["terms_gate"]["verdict"] == "prohibited"
    assert p["facts"] == [] and "robot, spider" in p["terms_gate"]["evidence"]
    assert not any("products.json" in c for c in fake_http)       # nothing collected after the gate


def test_terms_only_behind_robots_is_unclear(fake_http, monkeypatch):
    from ledger_scanner import terms
    monkeypatch.setitem(ROUTES, "pages/terms-and-conditions", (404, "nope", "text/html"))
    monkeypatch.setattr(terms, "UNCLEAR_POLICY", "skip")
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["terms_gate"]["verdict"] == "unclear" and p.get("skip_ingest") is True
    monkeypatch.setattr(terms, "UNCLEAR_POLICY", "proceed")
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["terms_gate"]["verdict"] == "unclear" and not p.get("skip_ingest") and p["facts"]


def test_terms_allowed(fake_http):
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["terms_gate"]["verdict"] == "allowed" and not p.get("skip_ingest")


def test_anthropic_request_matches_sdk():
    import inspect
    import anthropic
    instructions, schema = extract._spec_for("returns")
    params = extract._request(instructions, schema, "u", "page text", "")
    inspect.signature(anthropic.resources.messages.Messages.create).bind(None, **params)


def test_structured_output_parse(monkeypatch):
    class B:  # fake SDK text block
        type = "text"
        text = json.dumps({"facts": [{"key": "returns.period_days", "status": "observed", "value_json": "14",
                                      "evidence": "within 14 days of delivery", "confidence": "high"}]})
    class M:
        content = [B()]
    class C:
        class messages:
            @staticmethod
            def create(**kw):
                assert "output_config" in kw and "tools" not in kw
                return M()
    monkeypatch.setattr(extract, "_client", lambda: C())
    out = extract.read_page("returns", "u", "Return within 14 days of delivery.")
    assert out[0]["value"] == 14 and out[0]["evidence_verified"] is True


def test_money_and_union_merge():
    assert extract.money(70) == {"amount": 70, "currency": "AUD"}
    assert extract.money("$9.90") == {"amount": 9.9, "currency": "AUD"}
    a = detect.fact("shipping", "free_shipping_threshold", {"amount": 70, "currency": "AUD"}, source_url="home", evidence="over $70")
    b = {"category": "shipping", "key": "free_shipping_threshold", "status": "observed", "value": {"amount": 70, "currency": "AUD"},
         "evidence": "over $70", "evidence_verified": True, "source_url": "ship", "method": "ai_text", "confidence": "high"}
    assert scan._merge([a, b])[0]["status"] == "observed"
    c = detect.fact("payments", "bnpl_providers", ["afterpay", "zip", "humm"], source_url="home")
    d = dict(b, category="payments", key="bnpl_providers", value=["afterpay"], source_url="afterpay-page")
    assert scan._merge([c, d])[0]["value"] == ["afterpay", "humm", "zip"]


def test_free_text_agreement():
    assert extract._values_agree("string", "Dispatched within 2 business days", "Orders dispatched within two business days")
    assert not extract._values_agree("integer", 14, 30)
    assert extract._values_agree("money", 70, {"amount": 70})


def test_shopify_icons():
    html = '<svg aria-labelledby="pi-master"></svg><svg aria-labelledby="pi-american_express"></svg><svg aria-labelledby="pi-shopify_pay"></svg>'
    out = detect.detect_payments(html, "", "u")
    icons = next(f for f in out if f["key"] == "payment_icons")["value"]
    assert icons == ["amex", "mastercard", "shop_pay"]


def test_page_choice_prefers_recent():
    urls = [BASE + "pages/become-a-vip", BASE + "pages/zamels-rewards-club"]
    lm = {urls[0]: "2024-05-21", urls[1]: "2026-07-22"}
    assert discover.classify_pages(urls, BASE, lm)["loyalty"][0] == urls[1]


def test_hub_pages_beat_single_pages():
    urls = [BASE + "pages/stores-mt-druitt", BASE + "pages/stores", BASE + "pages/contact-us",
            BASE + "pages/contact-form-thanks", BASE + "pages/become-a-vip", BASE + "pages/zamels-rewards-club"]
    lm = {urls[0]: "2026-11-20", urls[1]: "2025-01-01", urls[4]: "2024-05-21", urls[5]: "2026-07-22"}
    got = discover.classify_pages(urls, BASE, lm)
    assert got["stores"][0] == BASE + "pages/stores"
    assert got["contact"][0] == BASE + "pages/contact-us"


def test_terms_finder_ignores_offer_terms():
    from ledger_scanner import terms
    urls = [BASE + "pages/black-friday-terms-and-conditions", BASE + "pages/click-collect-terms-and-conditions",
            BASE + "pages/terms-of-use"]
    assert terms.find_terms_urls(urls) == [BASE + "pages/terms-of-use"]


def test_terms_general_only():
    from ledger_scanner import terms
    urls = [BASE + "pages/instore-jewellery-cleaning-terms-and-conditions", BASE + "pages/terms-conditions",
            BASE + "en-hk/pages/terms", BASE + "pages/policies-terms"]
    got = terms.find_terms_urls(urls)
    assert BASE + "pages/instore-jewellery-cleaning-terms-and-conditions" not in got
    assert set(got) == {BASE + "pages/terms-conditions", BASE + "en-hk/pages/terms", BASE + "pages/policies-terms"}


def test_same_meaning():
    sm = extract.same_meaning
    assert sm("2-10 business days once shipped, depending on location", "2-10 business days once shipped depending on location and method")
    assert not sm("within 14 days", "within 30 days")
    assert not sm(14, 30)
    assert sm({"amount": 70, "currency": "AUD"}, {"amount": 70})
    assert not sm(["afterpay", "humm", "latitude", "zip"], ["afterpay", "humm", "zip"])
    assert sm(["Special orders", "resized items"], ["special orders", "Resized items"])


def test_promo_same_offer_real_cases():
    from ledger_scanner import promos
    P = lambda h, d=None, t=None, s=None: {"headline": h, "discount": d, "type": t, "starts": s}
    same = promos.same_offer
    # Zamel's wordings of one Black Friday sale
    assert same(P("Black Friday Sale", "Up to 70% off", "percent_off"), P("Black Friday Sale – Up to 70% Off", "Up to 70% off", "percent_off"))
    assert same(P("Black Friday is ON", "Up to 70% off selected stock", None, "2026-11-04"), P("Black Friday Sale", "Up to 70% off", "percent_off"))
    assert same(P("Buy One Ring, Get One Free – Selected Lab Grown Diamond Rings", "Buy one ring, get one free", "bogo"),
                P("Buy One Ring, Get One Free - Selected Lab Grown Diamond Rings", "Buy one ring, get one free", "bogo"))
    assert same(P("4-Day Deal Surge – Extra 10% Off", "Extra 10% off", "percent_off"), P("4-Day Deal Surge", "Extra 10% off"))
    # genuinely different offers stay apart
    assert not same(P("4-Day Deal Surge – Extra 10% Off", "Extra 10% off", "percent_off"), P("Black Friday Sale", "Up to 70% off", "percent_off"))
    assert not same(P("Shop 25% off gifts", "25% off gifts", "percent_off"), P("25% off everything", "25% off everything, prices as marked", "percent_off"))
    assert not same(P("Black Friday Cyber Monday Sale", None, "percent_off", "2025-10-29"), P("Black Friday is ON", "Up to 70% off selected stock", None, "2026-11-04"))
    assert not same(P("Free Shipping Australia-wide over $70", "Free shipping on online orders over $70", "free_shipping"),
                    P("Join & Get $20 Off", "$20 off first order, min. $100 spend", "dollar_off"))


def test_promo_merge_and_keys():
    from ledger_scanner import promos
    live = promos.merge_list([
        {"headline": "Black Friday Sale", "discount": "Up to 70% off", "type": "percent_off", "placement": ["hero"]},
        {"headline": "Black Friday Sale – Up to 70% Off", "discount": "Up to 70% off", "type": "percent_off", "placement": ["banner"]},
        {"headline": "Extra 10% Off", "discount": "Extra 10% off", "type": "percent_off"},
    ])
    assert len(live) == 2 and set(live[0]["placement"]) == {"hero", "banner"}
    existing = [{"promo_key": "K1", "headline": "Black Friday is ON", "discount": "Up to 70% off selected stock",
                 "promo_type": None, "stated_start": "2026-11-04"}]
    promos.assign_keys(live, [], existing)
    assert live[0]["promo_key"] == "K1" and live[1]["promo_key"] != "K1"


def test_combined_and_link_text_pages():
    urls = [BASE + "pages/shipping-returns", BASE + "pages/info-12", BASE + "pages/faqs"]
    texts = {BASE + "pages/info-12": "Postage & Delivery"}
    got = discover.classify_pages(urls, BASE, {}, texts)
    assert got["returns"][0] == BASE + "pages/shipping-returns"
    assert BASE + "pages/shipping-returns" in got["shipping"] and BASE + "pages/info-12" in got["shipping"]
    assert got["shipping"][0] == BASE + "pages/shipping-returns"  # URL match beats link-words match
    html = '<a href="/pages/info-12">Postage &amp; Delivery</a>'
    assert discover.link_texts(html, BASE)[BASE + "pages/info-12"] == "Postage & Delivery"


def test_top_collections_fallback():
    import json as _j
    class F:
        base_url = BASE
        def fetch(self, path, want_text=True):
            from types import SimpleNamespace
            cols = [{"handle": "jewellery", "products_count": 900}, {"handle": "rings", "products_count": 300},
                    {"handle": "earrings", "products_count": 250}, {"handle": "black-friday-sale", "products_count": 400},
                    {"handle": "necklaces", "products_count": 200}, {"handle": "tiny", "products_count": 1}]
            return SimpleNamespace(status=200, html=_j.dumps({"collections": cols}))
    got = shopify.top_collections(F(), 8)
    assert got == [BASE.rstrip("/") + "/collections/" + h for h in ("rings", "earrings", "necklaces")]


def test_jsonld_and_woo_prices():
    from ledger_scanner import products_generic as pg
    html = """<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
    {"@type":"Product","name":"Pearl strand","sku":"PS-1","offers":{"@type":"Offer","price":"1,250.00","priceCurrency":"AUD",
    "availability":"https://schema.org/InStock"}}]}</script>"""
    p = pg._ld_products(html)[0]
    assert pg._offer_price(p) == (1250.0, "AUD", True)
    assert pg._woo_price({"price": "12900", "currency_minor_unit": 2}, "price") == 129.0
    links = pg.homepage_product_links('<a href="/product/pearl-strand/">x</a><a href="/about">y</a><a href="/rings/ring-123456.html">z</a>', BASE, 10)
    assert links == [BASE + "product/pearl-strand", BASE + "rings/ring-123456.html"]


def test_store_pages_from_sitemap():
    sm = {"pages": [(BASE + "stores/chadstone", None), (BASE + "stores/bondi/", None), (BASE + "stores/rundle-mall", None),
                    (BASE + "stores", None), (BASE + "pages/about", None)], "stores": []}
    assert len(discover.store_pages(sm)) == 3
    sm2 = {"pages": [], "stores": [(BASE + "s/a", None), (BASE + "s/b", None)]}
    assert len(discover.store_pages(sm2)) == 2


def test_brand_terms_and_www_dedupe():
    from ledger_scanner import terms, shopify
    assert terms.is_general_terms("https://calleija.com/calleija-terms-and-conditions/")
    assert not terms.is_general_terms("https://calleija.com/bridal-terms-and-conditions/")
    got = discover.classify_pages(["https://shop.example.com.au/pages/faq", "https://www.shop.example.com.au/pages/faq"], BASE)
    assert len(got["faq"]) == 1
    for h in ("gifts-under-20", "diamond-clearance", "past-creations-rings", "configurator"):
        assert shopify.SKIP_COLLECTION.search(h), h
    assert not shopify.SKIP_COLLECTION.search("diamond-rings")


def test_promo_years_and_dates_kept_apart():
    from ledger_scanner import promos
    same = promos.same_offer
    assert not same({"name": "Afterpay Day 2025"}, {"name": "Afterpay Day (August)", "stated_start": "2026-08-10"})
    xmas = {"name": "Christmas 2025 Up to 60% off", "discount": "Up to 60% off", "stated_start": "2025-12-02", "stated_end": "2025-12-31",
            "first_seen_at": "2026-11-26", "last_seen_at": "2026-11-26"}
    rings = {"name": "Up to 60% off rings", "discount": "Up to 60% off rings", "promo_type": "percent_off",
             "first_seen_at": "2026-11-26T06:00:00", "last_seen_at": "2026-11-26T09:00:00"}
    assert not same(xmas, rings)
    bf = {"name": "Black Friday is ON", "discount": "Up to 70% off selected stock", "stated_start": "2026-11-04", "stated_end": "2026-12-01"}
    live = {"headline": "Black Friday Sale", "discount": "Up to 70% off", "type": "percent_off", "seen_at": "2026-11-26"}
    assert same(bf, live)


SHOPIFY_TOS = ("<html><body><h1>Terms of Service</h1>" + "<p>General conditions apply to all purchases. " * 20 +
               "</p><p>In addition to other prohibitions, you are prohibited from using the site: (h) to collect or track "
               "the personal information of others; (i) to spam, phish, pharm, pretext, spider, crawl, or scrape; "
               "(j) for any obscene or immoral purpose.</p></body></html>")


def test_shopify_template_clause_scans(fake_http, monkeypatch):
    monkeypatch.setitem(ROUTES, "pages/terms-and-conditions", (200, SHOPIFY_TOS, "text/html"))
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["terms_gate"]["verdict"] == "template_clause" and not p.get("skip_ingest") and p["facts"]
    assert "spider, crawl, or scrape" in p["terms_gate"]["evidence"]


def test_template_plus_custom_clause_still_blocks(fake_http, monkeypatch):
    custom = SHOPIFY_TOS.replace("</body>", "<p>You must not use any robot, spider or other automated means to access, copy or extract any content from this website.</p></body>")
    monkeypatch.setitem(ROUTES, "pages/terms-and-conditions", (200, custom, "text/html"))
    p = scan.scan_site("shop.example.com.au", BASE, mode="full", use_ai=False)
    assert p["terms_gate"]["verdict"] == "prohibited" and p.get("skip_ingest") is True


def test_dated_history_twins_merge():
    from ledger_scanner import promos
    a = {"name": "Black Friday Cyber Monday Sale", "stated_start": "2025-10-29", "stated_end": "2025-12-01", "first_seen_at": "2026-11-26"}
    b = {"name": "Black Friday Cyber Monday Sale 2025", "stated_start": "2025-10-29", "stated_end": "2025-12-01", "first_seen_at": "2026-11-26"}
    assert promos.same_offer(a, b)


# -- industry question sets (27 Nov 2026) -------------------------------------
def test_jewellery_questions_only_for_jewellery():
    from ledger_scanner import extract
    assert "engraving" in extract.fields_for("faq", "jewellery")
    assert "engraving" in extract.fields_for("faq", None)  # no industry recorded = jewellery
    for ind in ("fashion", "beauty", "pet", "electronics"):
        assert "engraving" not in extract.fields_for("faq", ind)
        assert "free_resizing" not in extract.fields_for("contact", ind)
    assert "returns.free_exchanges" in extract.fields_for("returns", "fashion")
    assert "bulky_delivery_fee" in extract.fields_for("shipping", "homewares")
    assert "subscription_discount" in extract.fields_for("contact", "pet")  # contact pages get FAQ extras
    assert "returns.period_days" in extract.fields_for("returns", "beauty")  # common set kept


def test_industry_fields_use_valid_categories():
    from ledger_scanner import extract
    valid = {"site_identity", "policies", "shipping", "products", "promotions", "payments", "tech_stack",
             "journey_performance", "trust_support", "external_reviews", "loyalty", "content_marketing", "ai_readiness"}
    for ind, pages in extract.INDUSTRY_FIELDS.items():
        for ptype, fields in pages.items():
            assert ptype in extract.FIELDS
            for meta in fields.values():
                assert meta["cat"] in valid


def test_cost_row_counts_rendered_pages_and_conflicts():
    import time
    from datetime import datetime, timezone
    import run
    payload = {"scan": {"pages_fetched": [{"fetch_method": "http"}, {"fetch_method": "firecrawl"}]},
               "facts": [{"status": "observed"}, {"status": "conflicting"}], "issues_found": ["x", "y", "z"]}
    row = run.cost_row({"domain": "a.com.au", "industry": "pet"}, "full",
                       {"started": datetime.now(timezone.utc), "t0": time.monotonic(), "outcome": "stored",
                        "payload": payload, "scan_id": None})
    assert (row["pages_fetched"], row["rendered_pages"], row["conflicting_facts"], row["issues"]) == (2, 1, 1, 3)
    failed = run.cost_row({"domain": "a.com.au"}, "weekly", {"started": datetime.now(timezone.utc),
                          "t0": time.monotonic(), "outcome": "failed", "payload": None, "scan_id": None})
    assert failed["pages_fetched"] is None and failed["outcome"] == "failed"


# -- finding policy pages (27 Nov 2026: Amber Sceats and Bevilles were missed) ----
def test_return_singular_and_shopify_policy_pages_are_candidates():
    from ledger_scanner import discover
    b = "https://www.bevilles.com.au/"
    got = discover.classify_pages([b + "pages/delivery-returns", b + "pages/return-landing"], b)
    assert b + "pages/return-landing" in got["returns"]
    a = "https://ambersceats.com/"
    got = discover.classify_pages([a + "pages/returns-exchanges"] + discover.shopify_policy_urls(a), a)
    assert a + "policies/refund-policy" in got["returns"] and a + "policies/shipping-policy" in got["shipping"]


def test_own_text_strips_shared_boilerplate_and_spots_empty_pages():
    from ledger_scanner import pagetext
    home = "FREE SHIPPING OVER $300\nCART 0\nShop\nEarrings\nAll items purchased during our sale are final and not eligible for return"
    empty_returns = home + "\nReturns & Exchanges\nCART 0"
    own = pagetext.own_text(empty_returns, pagetext.shared_lines(home))
    assert own == "Returns & Exchanges" and pagetext.looks_empty(own, "returns")
    real = home + "\nRefund policy\n" + "We accept returns for unworn items within 7 days of delivery. " * 6
    own = pagetext.own_text(real, pagetext.shared_lines(home))
    assert not pagetext.looks_empty(own, "returns") and "CART" not in own


def test_homepage_free_shipping_threshold():
    from ledger_scanner import detect
    t = "FREE STANDARD DOMESTIC AUSTRALIAN SHIPPING ON ORDERS OVER $300 AUD    SHOP WITH US IN PERSON"
    assert detect.detect_free_shipping(t, "u")[0]["value"]["amount"] == 300
    assert detect.detect_free_shipping("You are $202.94 USD away from free shipping.", "u") == []
    assert detect.detect_free_shipping("Free express shipping over $150", "u") == []
    assert detect.detect_free_shipping("Free shipping over $50\nFree shipping over $100", "u") == []


class _Page:
    def __init__(self, url, text, html=""):
        self.url, self.text, self.html, self.status, self.method, self.note = url, text, html, 200, "http", None


class _Fetcher:
    def __init__(self, pages):
        self.pages_map, self.got = pages, []

    def fetch(self, url, want_text=True):
        self.got.append(url)
        return self.pages_map.get(url) or _Page(url, "")

    fetch_rendered = fetch


def _fake_read(found_on):
    def read_page(ptype, url, text, industry=None):
        if ptype == "returns" and url in found_on:
            return [{"category": "policies", "key": "returns.period_days", "status": "observed", "value": 14}]
        return [{"category": "policies", "key": "returns.period_days", "status": "not_observed", "value": None}]
    return read_page


def test_summary_page_is_followed_to_the_full_policy(monkeypatch):
    from ledger_scanner import extract, scan
    b = "https://www.bevilles.com.au/"
    home = _Page(b, "Home\nFREE SHIPPING OVER $80")
    summary = _Page(b + "pages/delivery-returns", "Delivery & Returns\n" + "You can return an item hassle free to any store. " * 8,
                    html=f'<a href="{b}pages/return-landing">More information on Returns</a>')
    full = _Page(b + "pages/return-landing", "Returns\n" + "We offer FREE returns for 14 days of receipt. " * 8)
    f = _Fetcher({summary.url: summary, full.url: full})
    monkeypatch.setattr(extract, "read_page", _fake_read({full.url}))
    issues = []
    facts = scan._read_info_pages(f, {"returns": [summary.url]}, home, b, "jewellery", issues)
    assert any(x["status"] == "observed" for x in facts) and full.url in f.got


def test_empty_first_candidate_falls_through_to_next(monkeypatch):
    from ledger_scanner import extract, scan
    a = "https://ambersceats.com/"
    home = _Page(a, "CART 0\nShop\nEarrings")
    empty = _Page(a + "pages/returns-exchanges", "CART 0\nShop\nEarrings\nReturns & Exchanges")
    policy = _Page(a + "policies/refund-policy", "Refund policy\n" + "Eligible orders must be shipped back within 7 days of delivery for a refund. " * 5)
    f = _Fetcher({empty.url: empty, policy.url: policy})
    calls = []
    def read(ptype, url, text, industry=None):
        calls.append(url)
        return _fake_read({policy.url})(ptype, url, text, industry)
    monkeypatch.setattr(extract, "read_page", read)
    issues = []
    facts = scan._read_info_pages(f, {"returns": [empty.url, policy.url]}, home, a, "jewellery", issues)
    assert calls == [policy.url]  # the empty page cost no AI call
    assert any(x["status"] == "observed" for x in facts)
    assert any("no returns content of its own" in i for i in issues)
