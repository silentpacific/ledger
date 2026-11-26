"""Shopify product data by code (never through the AI).
Uses /collections/{handle}/products.json, which keeps the collection's own order
(robots.txt on Shopify stores disallows ?sort_by=, so we don't use it)."""
from __future__ import annotations

import json
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
