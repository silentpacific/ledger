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
import time
import traceback
from datetime import datetime, timezone

from ledger_scanner import batch, config, extract, db, promos
from ledger_scanner.batch import Pending
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


def _match_promotions(domain: str, payload: dict) -> None:
    """Reuse stored promotion keys for offers already on record, so each offer keeps one timeline."""
    try:
        existing = db.domain_promotions(domain)
    except Exception as e:
        print("  could not load stored promotions (keys not matched):", str(e)[:150])
        existing = []
    for e in existing:
        e["headline"] = e.get("name")
    seen = payload["scan"]["scan_started_at"][:10]
    for p in payload["promotions"]:
        p["seen_at"] = seen
    promos.assign_keys(payload["promotions"], payload["promotion_history_from_terms_page"], existing)


def dedupe_stored_promotions(domain: str, dry: bool) -> int:
    """Fold duplicate promotions already stored for a site into one record each."""
    rows = db.domain_promotions(domain)
    for r in rows:
        r["headline"] = r.get("name")
    groups: list[list[dict]] = []
    for r in rows:
        for g in groups:
            if any(promos.same_offer(r, q) for q in g):
                g.append(r)
                break
        else:
            groups.append([r])
    merged = 0
    for g in groups:
        if len(g) < 2:
            continue
        keep = max(g, key=lambda r: (r.get("times_seen") or 0, promos.richness(r)))
        drop = [r["id"] for r in g if r["id"] != keep["id"]]
        print(f"  {domain}: keep '{keep['name']}' <- " + "; ".join(f"'{r['name']}'" for r in g if r["id"] != keep["id"]))
        if not dry:
            db.merge_promotions(keep["id"], drop)
        merged += len(drop)
    return merged


MAX_ROUNDS = 5                 # batch rounds before finishing with what's been answered
BATCH_WAIT_SECONDS = 4 * 3600  # per round
JOB_SECONDS = 330 * 60         # GitHub stops the job at 355 minutes; leave time to store results


def cost_row(t: dict, mode: str, cost: dict) -> dict:
    """What this scan attempt used, for scan_costs. Prices and labour weights are applied in the database."""
    p = cost["payload"] or {}
    pages = (p.get("scan") or {}).get("pages_fetched")
    facts = p.get("facts") or []
    esc = extract.USAGE.get(config.ESCALATION_MODEL, {}) if config.ESCALATION_MODEL else {}
    return {
        "domain": t["domain"], "industry": t.get("industry"), "scan_id": cost["scan_id"], "mode": mode,
        "outcome": cost["outcome"], "started_at": cost["started"].isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "runtime_seconds": round(time.monotonic() - cost["t0"], 1),
        "pages_fetched": len(pages) if pages is not None else None,
        "rendered_pages": sum(1 for x in pages if x.get("fetch_method") == "firecrawl") if pages is not None else None,
        "ai_usage": extract.USAGE, "ai_cost_usd": round(extract.usage_cost(), 6),
        "escalation_calls": esc.get("calls", 0),
        "conflicting_facts": sum(1 for x in facts if x.get("status") == "conflicting"),
        "issues": len(p.get("issues_found") or []),
        "scanner": config.SCANNER_VERSION,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=False)
    g.add_argument("--domain", help="one domain, e.g. zamels.com.au")
    g.add_argument("--all", action="store_true", help="every enabled domain in ledger-db")
    ap.add_argument("--mode", choices=["full", "weekly"], default="full")
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--budget", type=float, default=0.0,
                    help="pause (stop starting new sites) once estimated AI spend in this run reaches this many USD")
    ap.add_argument("--dry-run", action="store_true", help="don't write to the database")
    ap.add_argument("--recheck-refusals", action="store_true",
                    help="terms-only recheck of switched-off sites; results go to terms_checks")
    ap.add_argument("--domain-list", help="comma-separated domains, scanned in this order in one run (budget applies)")
    ap.add_argument("--dedupe-promotions", action="store_true",
                    help="merge duplicate promotions already stored (all enabled sites, or --domain)")
    ap.add_argument("--no-ai", action="store_true", help="code-based facts only (no Anthropic calls)")
    ap.add_argument("--batch", action="store_true", help="send AI requests through the half-price Message Batches API")
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

    if args.dedupe_promotions:
        doms = [args.domain] if args.domain else db.enabled_domains()
        total = sum(dedupe_stored_promotions(d, args.dry_run) for d in doms)
        print(f"\n{'Would merge' if args.dry_run else 'Merged'} {total} duplicate promotions across {len(doms)} sites")
        return 0

    if args.domain_list:
        known = {normalise_domain(d["domain"]): d for d in db.domains_due(5000)}
        targets = []
        for raw in args.domain_list.split(","):
            dn = normalise_domain(raw.strip())
            if dn:
                targets.append(known.get(dn, {"domain": dn, "homepage_url": f"https://{dn}/", "platform": None}))
        args.all = True  # behave like a batch run below
    if not (args.all or args.domain):
        ap.error("one of --domain, --all, --recheck-refusals or --dedupe-promotions is required")
    if args.domain_list:
        pass
    elif args.all:
        targets = db.domains_due(args.limit)
    else:
        known = {normalise_domain(d["domain"]): d for d in (db.domains_due(1000) if not args.dry_run else [])}
        d = known.get(args.domain, {"domain": args.domain, "homepage_url": f"https://{args.domain}/", "platform": None})
        targets = [d]

    out_dir = pathlib.Path("scan-output")
    out_dir.mkdir(exist_ok=True)
    state = {"failures": 0, "cost_failures": 0, "spent": 0.0, "paused": False}
    next_site_allowance = 0.20  # a big site can cost ~$0.10-0.15; keep headroom
    B = None
    if args.batch:  # half-price Message Batches: sites are scanned in rounds (see ledger_scanner/batch.py)
        from ledger_scanner import fetch
        B = batch.BATCH = batch.Batch()
        fetch.RUN_CACHE = {}
    started: dict[str, list] = {}   # domain -> [first start time, active seconds so far] (batch rounds)
    prev_cache: dict[str, dict | None] = {}

    def scan_one(t: dict) -> str | None:
        """Scan (or, in batch mode, continue scanning) one site. Returns "pending", "stop" or None."""
        mode = "full" if args.mode == "weekly" and t.get("full_scan_requested") else args.mode
        extract.reset_usage()
        if B is not None:
            B.site = t["domain"]
        first = started.setdefault(t["domain"], [datetime.now(timezone.utc), 0.0])
        # runtime = this site's own working time across rounds, not the time spent waiting for batches
        cost = {"started": first[0], "t0": time.monotonic() - first[1], "outcome": "failed", "payload": None, "scan_id": None}
        print(f"\n=== {t['domain']} ({mode}{', full rescan requested' if mode != args.mode else ''}, model {config.CLAUDE_MODEL}, "
              f"escalation {config.ESCALATION_MODEL or 'off'}{', batch' if B else ''}) ===", flush=True)
        try:
            previous = prev_cache.get(t["domain"])
            if mode == "full" and t["domain"] not in prev_cache:  # unchanged policy pages reuse stored facts (no AI read)
                try:
                    previous = db.previous_pages(t["domain"])
                except Exception as e:
                    print("  could not load previous pages (everything will be read):", str(e)[:150])
                prev_cache[t["domain"]] = previous
            payload = scan_site(t["domain"], t["homepage_url"], t.get("platform"), mode=mode, use_ai=not args.no_ai,
                                industry=t.get("industry"), previous=previous)
            if B is not None:
                if B.waiting(t["domain"]):
                    return "pending"  # answers come back with the next batch
                extract.USAGE.update(B.usage.get(t["domain"], {}))
            cost["payload"] = payload
            if extract.OUT_OF_CREDIT:
                print(f"\nPAUSED: the Anthropic account is out of credit. Nothing stored for {t['domain']}.")
                state["paused"] = True
                cost["outcome"] = "not_stored"
                return "stop"
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
            print("  ai usage:", extract.usage_summary(), f"| run total ~${(B.spent if B else state["spent"] + extract.usage_cost()):.2f}")
            print(f"  terms: {gate.get('verdict')} {gate.get('url') or ''}")
            if gate.get("evidence") and gate.get("verdict") == "prohibited":
                print(f"  terms quote: {gate['evidence'][:300]}")
            if args.dry_run:
                for k, v in (payload.get("pages_chosen") or {}).items():
                    print(f"  PAGE {k}: {', '.join(v)}")
                if payload["products"]:
                    pr = payload["products"]
                    print(f"  PRODUCTS {len(pr)} from {sorted({x.get('collection') for x in pr})}; e.g. {pr[0]['title']} ${pr[0]['price']}")
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
                    cost["outcome"] = "blocked"
                    return None
                if gate:
                    db.record_terms(t["domain"], gate)
                if payload.get("skip_ingest"):
                    print("  not stored: stopped by terms gate (site switched off if prohibited)")
                    cost["outcome"] = "blocked"
                else:
                    _match_promotions(t["domain"], payload)
                    kept = _carry_forward(t["domain"], payload)
                    if kept:
                        print(f"  {kept} facts re-worded but unchanged: previous value kept (no change logged)")
                    scan_id = db.ingest(payload)
                    cost["scan_id"], cost["outcome"] = scan_id, "stored"
                    print("  stored scan", scan_id)
                    if mode == "full" and t.get("full_scan_requested"):
                        db.clear_full_scan_request(t["domain"])
        except Pending:
            return "pending"  # e.g. the terms check is waiting for its batch answer
        except Exception as e:
            state["failures"] += 1
            msg = f"{type(e).__name__}: {e}"
            print("  FAILED:", msg)
            traceback.print_exc()
            if not args.dry_run:
                db.record_error(t["domain"], msg)
        finally:
            if not args.dry_run and not (B is not None and B.waiting(t["domain"])):
                try:
                    db.record_cost(cost_row(t, mode, cost))
                except Exception as e:
                    state["cost_failures"] += 1
                    print("  COST NOT RECORDED:", e)
        return None

    todo = list(targets)
    run_t0 = time.monotonic()
    for rnd in range(1, (MAX_ROUNDS + 2) if B else 2):
        if B is not None and rnd == MAX_ROUNDS + 1:
            B.closed = True  # last pass: anything still unanswered counts as a failed read, so every site finishes
            print(f"\nROUND {rnd}: finishing {len(todo)} sites with what has been answered")
        elif B is not None:
            print(f"\nROUND {rnd}: {len(todo)} sites")
        still = []
        for t in todo:
            if B is None:
                state["spent"] += extract.usage_cost()  # cost of the previous site, even if it failed
                if args.budget and state["spent"] + next_site_allowance > args.budget:
                    left = [x["domain"] for x in todo[todo.index(t):]]
                    print(f"\nPAUSED: estimated AI spend ${state['spent']:.2f} is near the ${args.budget:.2f} budget. "
                          f"{len(left)} sites not started: {', '.join(left)}")
                    state["paused"] = True
                    break
            t_round = time.monotonic()
            r = scan_one(t)
            if t["domain"] in started:
                started[t["domain"]][1] += time.monotonic() - t_round
            if r == "stop":
                break
            if r == "pending":
                still.append(t)
        if B is None or not still or state["paused"]:
            break
        estimate = B.estimate_pending_usd()
        if args.budget and B.spent + estimate > args.budget:
            print(f"\nPAUSED: AI spend ${B.spent:.2f} plus this round's estimate ${estimate:.2f} would pass the "
                  f"${args.budget:.2f} budget. {len(still)} sites not finished (nothing stored for them): "
                  f"{', '.join(x['domain'] for x in still)}")
            state["paused"] = True
            break
        try:
            left_s = JOB_SECONDS - (time.monotonic() - run_t0)  # stop waiting before GitHub ends the job
            B.submit_and_wait(extract._client(), timeout_s=max(60, min(BATCH_WAIT_SECONDS, left_s)))
        except Exception as e:
            print(f"\nBATCH FAILED: {type(e).__name__}: {e}. {len(still)} sites not finished (nothing stored for them).")
            state["failures"] += len(still)
            break
        todo = still
    if B is not None:
        print(f"\nBatch AI spend ~${B.spent:.3f} (batch price) in {len(B.batches)} batches: {', '.join(B.batches)}")
    print(f"\nDone: {len(targets) - state['failures']} ok, {state['failures']} failed")
    if state["cost_failures"]:
        print(f"\nERROR: {state['cost_failures']} scans' costs could not be written to scan_costs in Supabase")
    if state["paused"]:
        return 3  # marks the GitHub run as failed so GitHub emails you; the log says PAUSED and what's left
    if state["cost_failures"]:
        return 4  # GitHub emails on a failed run; costs must be in Supabase, not only in this log
    return 1 if state["failures"] and state["failures"] == len(targets) else 0


if __name__ == "__main__":
    sys.exit(main())
