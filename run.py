"""Command line entry point.

  python run.py --domain zamels.com.au            # scan one site (full) and store it
  python run.py --all --mode weekly               # scan every enabled site (weekly categories)
  python run.py --domain najo.com.au --dry-run    # scan, print summary, save JSON, don't store
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import traceback

from ledger_scanner import config, extract, db
from ledger_scanner.scan import scan_site


def normalise_domain(value: str) -> str:
    """Accept 'zamels.com.au', 'https://www.zamels.com.au/', 'zamels.com.au/pages/x' etc."""
    v = value.strip().lower()
    v = v.split("://", 1)[-1]
    v = v.split("/", 1)[0].split("?", 1)[0]
    return v.removeprefix("www.")


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--domain", help="one domain, e.g. zamels.com.au")
    g.add_argument("--all", action="store_true", help="every enabled domain in ledger-db")
    ap.add_argument("--mode", choices=["full", "weekly"], default="full")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--dry-run", action="store_true", help="don't write to the database")
    ap.add_argument("--no-ai", action="store_true", help="code-based facts only (no Anthropic calls)")
    args = ap.parse_args()

    if args.domain:
        args.domain = normalise_domain(args.domain)
    if args.all:
        targets = db.domains_due(args.limit)
    else:
        known = {normalise_domain(d["domain"]): d for d in (db.domains_due(1000) if not args.dry_run else [])}
        d = known.get(args.domain, {"domain": args.domain, "homepage_url": f"https://{args.domain}/", "platform": None})
        targets = [d]

    out_dir = pathlib.Path("scan-output")
    out_dir.mkdir(exist_ok=True)
    failures = 0
    for t in targets:
        print(f"\n=== {t['domain']} ({args.mode}, model {config.CLAUDE_MODEL}) ===", flush=True)
        extract.reset_usage()
        try:
            payload = scan_site(t["domain"], t["homepage_url"], t.get("platform"), mode=args.mode, use_ai=not args.no_ai)
            (out_dir / f"{t['domain']}.json").write_text(json.dumps(payload, indent=2, default=str))
            facts = payload["facts"]
            print(f"status={payload['scan']['scan_status']} pages={len(payload['scan']['pages_fetched'])} "
                  f"facts={len(facts)} verified={sum(1 for x in facts if x.get('evidence_verified'))} "
                  f"conflicting={sum(1 for x in facts if x['status']=='conflicting')} "
                  f"promos={len(payload['promotions'])}+{len(payload['promotion_history_from_terms_page'])} "
                  f"products={len(payload['products'])}")
            for issue in payload["issues_found"]:
                print("  issue:", issue)
            gate = payload.get("terms_gate") or {}
            u = extract.USAGE
            print(f"  ai usage: calls={u['calls']} input_tokens={u['input']} output_tokens={u['output']}")
            print(f"  terms: {gate.get('verdict')} {gate.get('url') or ''}")
            if gate.get("evidence") and gate.get("verdict") == "prohibited":
                print(f"  terms quote: {gate['evidence'][:300]}")
            if args.dry_run:
                # print the facts so a test run can be compared without downloading files
                for x in facts:
                    if x.get("method") in ("ai_text",) or x["key"] in ("free_shipping_threshold", "payment_icons", "bnpl_providers"):
                        print("  FACT", json.dumps({"k": f"{x['category']}.{x['key']}", "s": x["status"], "v": x.get("value"),
                                                    "ev": x.get("evidence_verified"), "c": x.get("confidence")}, default=str)[:400])
                for p in payload["promotions"] + payload["promotion_history_from_terms_page"]:
                    print("  PROMO", json.dumps(p, default=str)[:300])
            if not args.dry_run:
                if gate:
                    db.record_terms(t["domain"], gate)
                if payload.get("skip_ingest"):
                    print("  not stored: stopped by terms gate (site switched off if prohibited)")
                else:
                    scan_id = db.ingest(payload)
                    print("  stored scan", scan_id)
        except Exception as e:
            failures += 1
            msg = f"{type(e).__name__}: {e}"
            print("  FAILED:", msg)
            traceback.print_exc()
            if not args.dry_run:
                db.record_error(t["domain"], msg)
    print(f"\nDone: {len(targets) - failures} ok, {failures} failed")
    return 1 if failures and failures == len(targets) else 0


if __name__ == "__main__":
    sys.exit(main())
