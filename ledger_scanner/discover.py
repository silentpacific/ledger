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
    ("returns", ["returns", "refund", "exchange", "return-policy"]),
    ("shipping", ["delivery", "shipping", "postage", "dispatch", "freight"]),
    ("payments", ["payment-options", "payment-methods", "afterpay", "buy-now-pay-later", "payment-plans", "finance", "zip", "humm", "klarna", "layby", "lay-by"]),
    ("loyalty", ["rewards-club", "rewards", "loyalty", "club", "vip", "member"]),
    ("warranty", ["warranty", "guarantee", "care-plan", "price-match", "price-promise"]),
    ("contact", ["contact-us", "contact"]),
    ("faq", ["faq", "help-centre", "help-center", "help"]),
    ("stores", ["store-locator", "find-a-store", "our-stores", "stores", "locations", "showroom"]),
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
              "collections": [], "blogs": [], "stores": [], "agentic": False}
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
        if any(k in name for k in ("store", "location", "boutique", "showroom")) and "product" not in name:
            p = f.fetch(u, want_text=False)
            if p.status == 200:
                result["stores"] += parse_sitemap(p.html)
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


def _match_score(path: str, keys: list[str]) -> tuple[int, int] | None:
    """Lower is better: (which keyword matched, how many extra words the page slug has).
    /pages/stores beats /pages/stores-mt-druitt; /pages/rewards-club beats /pages/become-a-vip."""
    slug = path.rstrip("/").rsplit("/", 1)[-1]
    best = None
    for i, k in enumerate(keys):
        if k not in path:
            continue
        extra = 0 if slug == k else max(1, len([w for w in slug.replace(k, "").split("-") if w]))
        score = (extra, i)
        best = score if best is None or score < best else best
    return best


# a URL can be more than one type (/pages/shipping-returns is both); these types stay exclusive
EXCLUSIVE = {"promo_terms"}


def classify_pages(urls: list[str], base: str, lastmods: dict[str, str] | None = None,
                   texts: dict[str, str] | None = None) -> dict[str, list[str]]:
    """Group URLs by page type, by the URL and, failing that, by the link's own words
    ("Delivery" pointing at /pages/postage-info). Within a type: the general hub page first
    (store locator, not one store's page), then the most recently updated, then the shortest URL."""
    lastmods = lastmods or {}
    texts = texts or {}
    found: dict[str, dict[str, tuple]] = {}
    seen_paths: set[str] = set()
    for u in urls:
        if not same_site(u, base):
            continue
        key = urlparse(u).path.rstrip("/").lower()
        if key in seen_paths:  # same page under www. and bare host
            continue
        seen_paths.add(key)
        path = urlparse(u).path.lower()
        label = "/" + re.sub(r"[^a-z0-9]+", "-", texts.get(u, "").lower()).strip("-")
        for ptype, keys in PAGE_TYPES:
            score = _match_score(path, keys)
            if score is None and len(label) > 1:
                ts = _match_score(label, keys)
                score = (ts[0] + 1, ts[1]) if ts else None  # link words rank below a matching URL
            if score is not None:
                found.setdefault(ptype, {})[u] = score
                if ptype in EXCLUSIVE:
                    break

    def order(item):
        u, score = item
        lm = lastmods.get(u, "")[:10]
        return (score, "".join(chr(255 - ord(c)) for c in lm) or "~", len(u))
    return {k: [u for u, _ in sorted(v.items(), key=order)] for k, v in found.items()}


def link_texts(html: str, base: str) -> dict[str, str]:
    """URL -> the visible words of the first link pointing at it."""
    soup = BeautifulSoup(html, "lxml")
    out: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0])
        words = " ".join(a.get_text(" ", strip=True).split())[:80]
        if same_site(href, base) and words and href not in out:
            out[href] = words
    return out


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
    from .shopify import SKIP_COLLECTION
    for a in scope.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0])
        path = urlparse(href).path.rstrip("/")
        if not same_site(href, base) or skip.search(href) or SKIP_COLLECTION.search(path.rsplit("/", 1)[-1]):
            continue
        if re.match(r"^/collections/[^/]+$", path) or re.match(r"^/(product-category|category|shop)/[^/]+$", path):
            if path not in seen:
                seen.add(path)
                out.append(href.rstrip("/"))
        if len(out) >= limit:
            break
    return out


STORE_PAGE = re.compile(r"/(stores?|store-locator|locations|boutiques|showrooms?|our-stores|find-a-store|"
                        r"jewellery-stores?|jewellers)/[^/]+/?$", re.I)


def store_pages(sm: dict) -> list[str]:
    """One page per physical store, from a stores sitemap or store-directory URLs."""
    urls = [u for u, _ in sm.get("stores", [])] or [u for u, _ in sm.get("pages", []) if STORE_PAGE.search(urlparse(u).path)]
    urls = [u for u in urls if STORE_PAGE.search(urlparse(u).path) or sm.get("stores")]
    return list(dict.fromkeys(u.rstrip("/") for u in urls))
