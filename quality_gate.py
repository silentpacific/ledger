"""Quality rule for new stores (Rahul, 27 Nov 2026): a store added by discovery is kept on the site only if its
scan found at least 2 of the 4 key facts (returns window, change of mind, free-shipping minimum, standard delivery
fee). Stores below that are switched off (scan_enabled = false, reason in last_scan_error; their data is kept),
like any other switched-off store. Applies to stores created on or after QUALITY_SINCE that have a finished scan.
Run after scans by .github/workflows/views.yml. Usage: python quality_gate.py [--dry-run]
"""
from __future__ import annotations

import sys

import requests

from ledger_scanner import config

QUALITY_SINCE = "2026-11-27T13:00:00Z"
KEY_FACTS = ["policies.returns.period_days", "policies.returns.change_of_mind",
             "shipping.free_shipping_threshold", "shipping.standard_shipping_cost"]
MIN_KEY_FACTS = 2
REASON = f"quality: fewer than {MIN_KEY_FACTS} of the 4 key facts found (returns window, change of mind, free-shipping minimum, delivery fee)"


def main() -> int:
    dry = "--dry-run" in sys.argv
    h = {"apikey": config.SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}", "Content-Type": "application/json"}
    base = config.SUPABASE_URL + "/rest/v1"
    new = requests.get(f"{base}/domains", headers=h, timeout=60, params={
        "select": "id,domain", "scan_enabled": "eq.true", "created_at": f"gte.{QUALITY_SINCE}", "limit": "100000"}).json()
    if not new:
        print("no new stores to check"); return 0
    ids = [d["id"] for d in new]
    scanned: set[int] = set()
    have: dict[int, int] = {}
    for i in range(0, len(ids), 200):
        part = ",".join(map(str, ids[i:i + 200]))
        for s in requests.get(f"{base}/scans", headers=h, timeout=60, params={
                "select": "domain_id", "domain_id": f"in.({part})", "status": "in.(complete,partial)", "limit": "100000"}).json():
            scanned.add(s["domain_id"])
        for f in requests.get(f"{base}/publishable_facts", headers=h, timeout=60, params={
                "select": "domain_id,fact_key", "domain_id": f"in.({part})", "status": "in.(observed,not_offered)",
                "fact_key": f"in.({','.join(KEY_FACTS)})", "limit": "100000"}).json():
            have[f["domain_id"]] = have.get(f["domain_id"], 0) + 1
    off = [d for d in new if d["id"] in scanned and have.get(d["id"], 0) < MIN_KEY_FACTS]
    kept = sum(1 for d in new if d["id"] in scanned) - len(off)
    print(f"{len(new)} new stores, {len(scanned)} scanned: {kept} meet the rule, {len(off)} switched off", flush=True)
    if not dry:
        for i in range(0, len(off), 200):
            part = ",".join(str(d["id"]) for d in off[i:i + 200])
            r = requests.patch(f"{base}/domains?id=in.({part})", headers=h, timeout=60,
                               json={"scan_enabled": False, "last_scan_error": REASON})
            r.raise_for_status()
    return 0


if __name__ == "__main__":
    sys.exit(main())
