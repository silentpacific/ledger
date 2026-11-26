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


def domains_due(limit: int = 100) -> list[dict]:
    return _rpc("domains_due", {"p_limit": limit}) or []


def ingest(payload: dict) -> str:
    return _rpc("ingest_scan", {"payload": payload})


def record_error(domain: str, error: str) -> None:
    try:
        _rpc("record_scan_error", {"p_domain": domain, "p_error": error})
    except Exception:
        pass
