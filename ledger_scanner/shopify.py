"""Shopify product data by code (never through the AI).
Uses /collections/{handle}/products.json, which keeps the collection's own order
(robots.txt on Shopify stores disallows ?sort_by=, so we don't use it)."""
from __future__ import annotations

import json
import re
from urllib.parse import urlparse

from .fetch import Fetcher


def collection_products(f: Fetcher, collection_url: str, limit: int) -> list[dict]:
    path = urlparse(collection_url).path.rstrip("/")
    page = f.fetch(f"{path}/products.json?limit={limit}", want_text=False)
    if page.status != 200:
        return []
    try:
        products = json.loads(page.html).get("products", [])
    except json.JSONDecodeError:
        return []
    out = []
    for rank, p in enumerate(products[:limit], start=1):
        variants = p.get("variants") or []
        prices = [float(v["price"]) for v in variants if v.get("price")]
        compares = [float(v["compare_at_price"]) for v in variants if v.get("compare_at_price")]
        available = any(v.get("available") for v in variants)
        base = f.base_url.rstrip("/")
        out.append({
            "external_id": str(p["id"]),
            "handle": p.get("handle"),
            "title": p.get("title"),
            "product_type": p.get("product_type"),
            "url": f"{base}/products/{p.get('handle')}",
            "price": min(prices) if prices else None,
            "compare_at_price": max(compares) if compares else None,
            "available": available,
            "variant_count": len(variants),
            "rank": rank,
            "collection": path.split("/")[-1],
            "published_at": p.get("published_at"),
            "created_at": p.get("created_at"),
        })
    return out


SKIP_COLLECTION = re.compile(
    r"(^|-)(all|sale|new|best|gift|gifts|frontpage|clearance|search|under|over|price|black-friday|bfcm|cyber|"
    r"christmas|xmas|mothers|fathers|valentines?|hidden|test|home|featured|trending|outlet|archive|last-chance|"
    r"shop-all|everything|collections?|past|configurator|gifts?-under)(-|$)|^gifts?-under|^under-\d", re.I)


def top_collections(f: Fetcher, limit: int, sitemap_collections: list[str] | None = None) -> list[str]:
    """Product categories when the menu can't be read: Shopify's public collections list,
    biggest first (a catch-all far bigger than the rest is left out), else the sitemap's."""
    base = f.base_url.rstrip("/")
    page = f.fetch("/collections.json?limit=250", want_text=False)
    rows = []
    if page.status == 200:
        try:
            rows = json.loads(page.html).get("collections", [])
        except json.JSONDecodeError:
            rows = []
    rows = [r for r in rows if r.get("handle") and not SKIP_COLLECTION.search(r["handle"])
            and (r.get("products_count") or 0) >= 3]
    if rows:
        rows.sort(key=lambda r: r.get("products_count") or 0, reverse=True)
        if len(rows) > 2 and (rows[0].get("products_count") or 0) > 2 * (rows[1].get("products_count") or 1):
            rows = rows[1:]  # e.g. "jewellery" holding every product
        return [f"{base}/collections/{r['handle']}" for r in rows[:limit]]
    out = []
    for u in sitemap_collections or []:
        handle = urlparse(u).path.rstrip("/").rsplit("/", 1)[-1]
        if "/collections/" in u and not SKIP_COLLECTION.search(handle):
            out.append(u.rstrip("/"))
        if len(out) >= limit:
            break
    return out
