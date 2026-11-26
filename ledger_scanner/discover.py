"""Find the pages worth reading: sitemaps (page list + last-modified dates),
policy/info pages by keyword, and top-level categories from the homepage navigation."""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .fetch import Fetcher, same_site

# page type -> URL keywords (first match wins, in this order)
PAGE_TYPES: list[tuple[str, list[str]]] = [
    ("promo_terms", ["offer-terms", "promotion-terms", "promo-terms", "sale-terms", "competition-terms", "offer-t-cs"]),
    ("returns", ["returns", "refund", "exchange"]),
    ("shipping", ["delivery", "shipping"]),
    ("payments", ["payment-options", "payment-methods", "afterpay", "buy-now-pay-later", "payment-plans", "finance", "zip", "humm", "klarna", "layby", "lay-by"]),
    ("loyalty", ["rewards-club", "rewards", "loyalty", "club", "vip", "member"]),
    ("warranty", ["warranty", "guarantee", "care-plan", "price-match", "price-promise"]),
    ("faq", ["faq", "help-centre", "help-center", "help", "contact"]),
    ("stores", ["stores", "store-locator", "find-a-store", "locations", "showroom"]),
    ("terms", ["terms-and-conditions", "terms-of-service", "terms-of-use", "terms"]),
]


def parse_sitemap(xml: str) -> list[tuple[str, str | None]]:
    """Returns [(loc, lastmod)]; works for both sitemap indexes and URL sets."""
    soup = BeautifulSoup(xml, "xml")
    out = []
    for node in soup.find_all(["url", "sitemap"]):
        loc = node.find("loc")
        if loc and loc.text.strip():
            lm = node.find("lastmod")
            out.append((loc.text.strip(), lm.text.strip() if lm else None))
    return out


def read_sitemaps(f: Fetcher) -> dict:
    """Returns {'index': [...], 'pages': [(url, lastmod)], 'product_files': n,
    'product_urls': n or None, 'collections': [(url, lastmod)], 'blogs': [(url, lastmod)]}"""
    result = {"index": [], "pages": [], "product_files": 0, "product_urls": None,
              "collections": [], "blogs": [], "agentic": False}
    root = f.fetch("/sitemap.xml")
    if root.status != 200:
        return result
    entries = parse_sitemap(root.html)
    result["index"] = [u for u, _ in entries]
    child_maps = [u for u, _ in entries if u.endswith(".xml") or "sitemap" in u]
    product_count = 0
    counted_products = True
    for u in child_maps:
        name = urlparse(u).path.lower()
        if "agentic" in name:
            result["agentic"] = True
            continue
        if "product" in name:
            result["product_files"] += 1
            if result["product_files"] <= 10:
                p = f.fetch(u, want_text=False)
                if p.status == 200:
                    product_count += len(parse_sitemap(p.html))
                else:
                    counted_products = False
            else:
                counted_products = False
            continue
        if any(k in name for k in ("page", "collection", "blog", "article", "post", "category")):
            p = f.fetch(u, want_text=False)
            if p.status != 200:
                continue
            items = parse_sitemap(p.html)
            if "collection" in name or "category" in name:
                result["collections"] += items
            elif "blog" in name or "article" in name or "post" in name:
                result["blogs"] += items
            else:
                result["pages"] += items
    if not child_maps:  # flat sitemap
        result["pages"] = entries
    result["product_urls"] = product_count if counted_products and result["product_files"] else None
    return result


def classify_pages(urls: list[str], base: str, lastmods: dict[str, str] | None = None) -> dict[str, list[str]]:
    """Group URLs by page type; within a type, most recently updated first, then shortest."""
    lastmods = lastmods or {}
    found: dict[str, list[str]] = {}
    for u in urls:
        if not same_site(u, base):
            continue
        path = urlparse(u).path.lower()
        for ptype, keys in PAGE_TYPES:
            if any(k in path for k in keys):
                found.setdefault(ptype, []).append(u)
                break
    def order(u):
        return (lastmods.get(u, "")[:10], -len(u))
    return {k: sorted(set(v), key=order, reverse=True) for k, v in found.items()}


def footer_and_nav_links(html: str, base: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0])
        if same_site(href, base):
            links.append(href)
    return list(dict.fromkeys(links))


def top_categories(html: str, base: str, limit: int) -> list[str]:
    """Top-level collection/category links in navigation order."""
    soup = BeautifulSoup(html, "lxml")
    scope = soup.find("nav") or soup.find("header") or soup
    seen, out = set(), []
    skip = re.compile(r"/(all|sale|new|best|gift|frontpage|clearance|search)(-|$|/)|sort_by|\?", re.I)
    for a in scope.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0])
        path = urlparse(href).path.rstrip("/")
        if not same_site(href, base) or skip.search(href):
            continue
        if re.match(r"^/collections/[^/]+$", path) or re.match(r"^/(product-category|category|shop)/[^/]+$", path):
            if path not in seen:
                seen.add(path)
                out.append(href.rstrip("/"))
        if len(out) >= limit:
            break
    return out
