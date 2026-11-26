"""Watch-list products on sites that aren't Shopify, read by code (never through the AI).

1. WooCommerce: the store's public Store API (/wp-json/wc/store/v1/...), top categories by
   product count, most popular products in each.
2. Anything else: product pages linked from the homepage, priced from their schema.org
   Product data (JSON-LD), in homepage order.
Every request goes through the Fetcher, so robots.txt and the request delay still apply.
"""
from __future__ import annotations

import hashlib
import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .fetch import Fetcher, same_site
from .shopify import SKIP_COLLECTION

STORE_API = "/wp-json/wc/store/v1"


def _get_json(f: Fetcher, path: str):
    page = f.fetch(path, want_text=False)
    if page.status != 200:
        return None
    try:
        return json.loads(page.html)
    except (json.JSONDecodeError, TypeError):
        return None


def _woo_price(prices: dict, key: str):
    v = (prices or {}).get(key)
    if v in (None, ""):
        return None
    try:
        return int(v) / (10 ** int(prices.get("currency_minor_unit", 2)))
    except (TypeError, ValueError):
        return None


def woocommerce_products(f: Fetcher, max_categories: int, per_category: int) -> tuple[list[dict], list[dict]]:
    """Returns (products, categories used). Empty if the Store API isn't public or is disallowed."""
    cats = _get_json(f, f"{STORE_API}/products/categories?per_page=100")
    if not isinstance(cats, list):
        return [], []
    cats = [c for c in cats if c.get("count", 0) >= 3 and c.get("slug") and not SKIP_COLLECTION.search(c["slug"])
            and c.get("slug") != "uncategorized"]
    cats.sort(key=lambda c: c.get("count", 0), reverse=True)
    out, used = [], []
    for c in cats[:max_categories]:
        items = _get_json(f, f"{STORE_API}/products?category={c['id']}&per_page={per_category}&orderby=popularity&order=desc")
        if not isinstance(items, list) or not items:
            continue
        used.append({"slug": c["slug"], "name": c.get("name"), "count": c.get("count")})
        for rank, p in enumerate(items[:per_category], start=1):
            prices = p.get("prices") or {}
            price = _woo_price(prices, "price")
            regular = _woo_price(prices, "regular_price")
            out.append({
                "external_id": f"wc-{p.get('id')}", "handle": p.get("slug"), "title": _clean(p.get("name")),
                "product_type": c.get("name"), "url": p.get("permalink"),
                "price": price, "compare_at_price": regular if regular and price and regular > price else None,
                "currency": prices.get("currency_code") or "AUD",
                "available": bool(p.get("is_in_stock", True)), "rank": rank, "collection": c["slug"],
            })
    return out, used


PRODUCT_LINK = re.compile(r"/(product|products|p)/[^/]+|-\d{5,}(\.html)?$|/\d{5,}\.html$", re.I)


def homepage_product_links(html: str, base: str, limit: int) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    out = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0].split("?")[0]).rstrip("/")
        path = urlparse(href).path
        if same_site(href, base) and PRODUCT_LINK.search(path) and href not in out:
            out.append(href)
        if len(out) >= limit:
            break
    return out


def _ld_products(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    found = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            d = stack.pop()
            if isinstance(d, list):
                stack += d
            elif isinstance(d, dict):
                t = d.get("@type")
                if t == "Product" or (isinstance(t, list) and "Product" in t):
                    found.append(d)
                stack += [v for k, v in d.items() if k == "@graph"]
    return found


def _offer_price(product: dict):
    offers = product.get("offers")
    offers = offers if isinstance(offers, list) else [offers] if offers else []
    prices, currency, available = [], None, None
    for o in offers:
        if not isinstance(o, dict):
            continue
        for k in ("price", "lowPrice"):
            try:
                if o.get(k) not in (None, ""):
                    prices.append(float(str(o[k]).replace(",", "")))
                    break
            except ValueError:
                pass
        currency = currency or o.get("priceCurrency")
        av = str(o.get("availability") or "")
        if av:
            available = (available or False) or ("InStock" in av)
    return (min(prices) if prices else None), currency, available


def jsonld_products(f: Fetcher, home_html: str, base: str, limit: int) -> list[dict]:
    out = []
    for rank, url in enumerate(homepage_product_links(home_html, base, limit), start=1):
        page = f.fetch(url)
        if page.status != 200 or not page.html:
            continue
        prods = _ld_products(page.html)
        if not prods:
            continue
        p = prods[0]
        price, currency, available = _offer_price(p)
        if price is None:
            continue
        ext = p.get("sku") or p.get("productID") or p.get("mpn") or hashlib.md5(url.encode()).hexdigest()[:16]
        out.append({
            "external_id": f"ld-{ext}", "handle": urlparse(url).path.rstrip("/").rsplit("/", 1)[-1],
            "title": _clean(p.get("name")), "product_type": p.get("category") if isinstance(p.get("category"), str) else None,
            "url": url, "price": price, "compare_at_price": None, "currency": currency or "AUD",
            "available": True if available is None else available, "rank": rank, "collection": "homepage",
            "gtin": p.get("gtin13") or p.get("gtin") or None,
        })
    return out


def _clean(s):
    return BeautifulSoup(s, "lxml").get_text(" ", strip=True) if isinstance(s, str) and "<" in s else s
