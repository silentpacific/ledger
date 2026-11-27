"""Talks to ledger-db through Supabase's REST API with the service-role key (server-side only)."""
from __future__ import annotations

import requests

from . import config


def _rpc(name: str, payload: dict):
    if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_KEY):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    r = requests.post(
        f"{config.SUPABASE_URL}/rest/v1/rpc/{name}",
        headers={"apikey": config.SUPABASE_SERVICE_KEY,
                 "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
                 "Content-Type": "application/json"},
        json=payload, timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"{name} failed: {r.status_code} {r.text[:500]}")
    return r.json() if r.text else None


def _headers(extra: dict | None = None) -> dict:
    h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
         "Content-Type": "application/json"}
    h.update(extra or {})
    return h


def record_cost(row: dict) -> None:
    """One row per scan attempt in scan_costs (the cost index reads from it). Raises on failure."""
    r = requests.post(f"{config.SUPABASE_URL}/rest/v1/scan_costs", headers=_headers({"Prefer": "return=minimal"}),
                      json=row, timeout=60)
    if not r.ok:
        raise RuntimeError(f"scan_costs insert failed: {r.status_code} {r.text[:300]}")


def clear_full_scan_request(domain: str) -> None:
    r = requests.patch(f"{config.SUPABASE_URL}/rest/v1/domains", params={"domain": f"eq.{domain}"},
                       headers=_headers({"Prefer": "return=minimal"}), json={"full_scan_requested": False}, timeout=60)
    if not r.ok:
        raise RuntimeError(f"clearing full_scan_requested failed: {r.status_code} {r.text[:300]}")


def domains_due(limit: int = 1000) -> list[dict]:
    return _rpc("domains_due", {"p_limit": limit}) or []


def ingest(payload: dict) -> str:
    return _rpc("ingest_scan", {"payload": payload})


def record_error(domain: str, error: str) -> None:
    try:
        _rpc("record_scan_error", {"p_domain": domain, "p_error": error})
    except Exception:
        pass


def record_terms(domain: str, gate: dict) -> None:
    _rpc("record_terms_check", {"p_domain": domain, "p_url": gate.get("url"),
                                "p_verdict": gate.get("verdict"), "p_evidence": gate.get("evidence") or ""})


def domains_refusing() -> list[dict]:
    return _rpc("domains_refusing", {}) or []


def current_facts(domain: str) -> dict[str, dict]:
    """Latest stored value per fact for one site: {"category.key": {"status", "value"}}."""
    r = requests.get(
        f"{config.SUPABASE_URL}/rest/v1/current_facts",
        params={"domain": f"eq.{domain}", "select": "fact_key,status,value"},
        headers={"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"},
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"current_facts failed: {r.status_code} {r.text[:300]}")
    return {row["fact_key"]: row for row in r.json()}


def previous_pages(domain: str) -> dict:
    """What the last scans stored, for skipping unchanged pages:
    {"hashes": {url: fingerprint}, "facts": {url: [observation, ...]}, "at": {url: when}}."""
    rows = _rpc("previous_page_hashes", {"p_domain": domain}) or []
    r = requests.get(
        f"{config.SUPABASE_URL}/rest/v1/current_facts",
        params={"domain": f"eq.{domain}", "method": "eq.ai_text",
                "select": "category,fact_key,status,value,unit,confidence,evidence,evidence_verified,source_url,observed_at"},
        headers=_headers(), timeout=60)
    if not r.ok:
        raise RuntimeError(f"current_facts failed: {r.status_code} {r.text[:300]}")
    facts: dict[str, list] = {}
    for f in r.json():
        facts.setdefault(f["source_url"], []).append(f)
    return {"hashes": {x["url"]: x["content_hash"] for x in rows}, "at": {x["url"]: x["scanned_at"] for x in rows},
            "facts": facts}


def domain_promotions(domain: str) -> list[dict]:
    """Stored promotions for a site (newest first), for matching this scan's sightings."""
    return _rpc("domain_promotions", {"p_domain": domain}) or []


def merge_promotions(keep: int, drop: list[int]) -> int:
    return _rpc("merge_promotions", {"p_keep": keep, "p_drop": drop}) or 0


def enabled_domains() -> list[str]:
    r = requests.get(f"{config.SUPABASE_URL}/rest/v1/domains",
                     params={"select": "domain", "scan_enabled": "eq.true", "order": "domain"},
                     headers={"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"},
                     timeout=60)
    if not r.ok:
        raise RuntimeError(f"domains list failed: {r.status_code} {r.text[:300]}")
    return [row["domain"] for row in r.json()]
