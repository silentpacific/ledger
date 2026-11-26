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


def _carry_forward(domain: str, payload: dict) -> int:
    """If a fact means the same as last time, store last time's exact value so only real changes are logged."""
    try:
        prev = db.current_facts(domain)
    except Exception as e:
        print("  could not load previous facts:", e)
        return 0
    kept = 0
    for x in payload["facts"]:
        p = prev.get(f"{x['category']}.{x['key']}")
        if not p or p["status"] != x["status"] or x.get("value") is None or p.get("value") is None:
            continue
        if p["value"] != x["value"] and extract.same_meaning(p["value"], x["value"]):
            x["value"] = p["value"]
            kept += 1
    return kept


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=False)
    g.add_argument("--domain", help="one domain, e.g. zamels.com.au")
    g.add_argument("--all", action="store_true", help="every enabled domain in ledger-db")
    ap.add_argument("--mode", choices=["full", "weekly"], default="full")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--budget", type=float, default=0.0,
                    help="pause (stop starting new sites) once estimated AI spend in this run reaches this many USD")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the database")
    ap.add_argument("--recheck-refusals", action="store_true",
                    help="terms-only recheck of switched-off sites; results go to terms_checks")
    ap.add_argument("--no-ai", action="store_true", help="code-based facts only (no Anthropic calls)")
    args = ap.parse_args()

    if args.domain:
        args.domain = normalise_domain(args.domain)
    if args.recheck_refusals:
        sites = db.domains_refusing()
        for t in sites:
            try:
                r = recheck_terms(t["domain"], t["homepage_url"])
            except Exception as e:
                print(f"{t['domain']}: recheck failed: {type(e).__name__}: {e}")
                continue
            print(f"{t['domain']}: {r['verdict']} {r.get('url') or ''}")
            if not args.dry_run:
                db.record_terms(t["domain"], r)  # never re-enables; ready_to_readd shows in the view
        print(f"\nRechecked {len(sites)} switched-off sites, AI cost ~${extract.usage_cost():.3f}")
        return 0

    if not (args.all or args.domain):
        ap.error("one of --domain, --all or --recheck-refusals is required")
    if args.all:
        targets = db.domains_due(args.limit)
    else:
        known = {normalise_domain(d["domain"]): d for d in (db.domains_due(1000) if not args.dry_run else [])}
        d = known.get(args.domain, {"domain": args.domain, "homepage_url": f"https://{args.domain}/", "platform": None})
        targets = [d]

    out_dir = pathlib.Path("scan-output")
    out_dir.mkdir(exist_ok=True)
    failures = 0
    spent = 0.0
    paused = False
    next_site_allowance = 0.20  # a big site can cost ~$0.10-0.15; keep headroom
    extract.reset_usage()
    for n, t in enumerate(targets):
        spent += extract.usage_cost()  # cost of the previous site, even if it failed
        extract.reset_usage()
        if args.budget and spent + next_site_allowance > args.budget:
            left = [x["domain"] for x in targets[n:]]
            print(f"\nPAUSED: estimated AI spend ${spent:.2f} is near the ${args.budget:.2f} budget. "
                  f"{len(left)} sites not started: {', '.join(left)}")
            paused = True
            break
        print(f"\n=== {t['domain']} ({args.mode}, model {config.CLAUDE_MODEL}, escalation {config.ESCALATION_MODEL or 'off'}) ===", flush=True)
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
            print("  ai usage:", extract.usage_summary(), f"| run total ~${spent + extract.usage_cost():.2f}")
            print(f"  terms: {gate.get('verdict')} {gate.get('url') or ''}")
            if gate.get("evidence") and gate.get("verdict") == "prohibited":
                print(f"  terms quote: {gate['evidence'][:300]}")
            if args.dry_run:
                # print the facts so a test run can be compared without downloading files
                for x in facts:
                    if x["category"] not in ("products",) and not x["key"].startswith("detected."):
                        print("  FACT", json.dumps({"k": f"{x['category']}.{x['key']}", "s": x["status"], "v": x.get("value"),
                                                    "ev": x.get("evidence_verified"), "c": x.get("confidence")}, default=str)[:400])
                for p in payload["promotions"] + payload["promotion_history_from_terms_page"]:
                    print("  PROMO", json.dumps(p, default=str)[:300])
            if not args.dry_run:
                blocked = next((i for i in payload["issues_found"]
                                if i.startswith("homepage not readable: status 403") or i.startswith("homepage not readable: status 401")), None)
                if blocked and not gate:
                    db.record_terms(t["domain"], {"verdict": "blocked", "url": t["homepage_url"],
                                                  "evidence": blocked.replace("homepage not readable: status", "homepage returned") + " to LedgerBot"})
                    print("  site blocks our crawler: switched off and listed in sites_refusing_scraping")
                    continue
                if gate:
                    db.record_terms(t["domain"], gate)
                if payload.get("skip_ingest"):
                    print("  not stored: stopped by terms gate (site switched off if prohibited)")
                else:
                    kept = _carry_forward(t["domain"], payload)
                    if kept:
                        print(f"  {kept} facts re-worded but unchanged: previous value kept (no change logged)")
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
    if paused:
        return 3  # marks the GitHub run as failed so GitHub emails you; the log says PAUSED and what's left
    return 1 if failures and failures == len(targets) else 0


if __name__ == "__main__":
    sys.exit(main())
