"""Batch mode: AI requests go through Anthropic's Message Batches API (half price, results within 24h).

How a batch run works (run.py --batch):
  Round 1: every site is scanned as normal, but each AI request is collected instead of sent, and
           the read it belongs to is put off. Requests that don't depend on each other (both reads
           of a page, the first page of every type, homepage promotions) go out in the same round.
  Submit:  all collected requests go out as one batch; the run waits for the results.
  Round 2+: each unfinished site is scanned again. Pages come from this run's fetch cache (no new
           requests to the site), answers come from the batch results, and the scan gets further:
           the next candidate page, a Sonnet re-check, and so on. Repeats until no site has
           anything left to ask (at most MAX_ROUNDS). A site is stored as soon as it is finished.
"""
from __future__ import annotations

import hashlib
import json
import time

from . import config


class Pending(BaseException):
    """An AI answer that isn't back yet. BaseException so `except Exception` blocks don't swallow it."""


class Batch:
    def __init__(self) -> None:
        self.results: dict[str, dict] = {}       # request key -> {"ok": bool, "message": ..., "error": str}
        self.pending: dict[str, tuple[str, dict]] = {}  # request key -> (domain, request params)
        self.usage: dict[str, dict[str, dict]] = {}     # domain -> model -> {calls, input, output}
        self.site = ""                            # domain being scanned now
        self.batches: list[str] = []
        self.spent = 0.0
        self.closed = False                       # last round: unanswered requests fail instead of waiting

    @staticmethod
    def key(req: dict) -> str:
        return hashlib.sha256(json.dumps(req, sort_keys=True, default=str).encode()).hexdigest()

    def call(self, req: dict):
        """Answer from an earlier round, or note the request and put the read off."""
        k = self.key(req)
        got = self.results.get(k)
        if got is None and self.closed:
            raise RuntimeError("no batch answer within the round limit")
        if got is None:
            self.pending.setdefault(k, (self.site, req))
            raise Pending(k)
        if not got["ok"]:
            raise RuntimeError(f"batch request failed: {got['error']}")
        return got["message"]

    def estimate_pending_usd(self) -> float:
        """Rough cost of what's pending (about 4 characters per token; output at its max), at the batch price."""
        from .extract import PRICES
        total = 0.0
        for _, req in self.pending.values():
            pin, pout = PRICES.get(req["model"], (0, 0))
            chars = len(json.dumps(req.get("messages", []))) + len(str(req.get("system", ""))) + len(json.dumps(req.get("output_config", {})))
            total += (chars / 4 / 1e6 * pin + min(req.get("max_tokens", 2000), 2000) / 1e6 * pout) * config.BATCH_PRICE_FACTOR
        return total

    def waiting(self, domain: str) -> bool:
        return any(d == domain for d, _ in self.pending.values())

    # -- sending and collecting --------------------------------------------------
    def submit_and_wait(self, client, timeout_s: float, poll_s: float = 30, log=print) -> int:
        """Send everything pending as one batch and wait for it. Returns how many requests went out."""
        if not self.pending:
            return 0
        items = list(self.pending.items())
        b = client.messages.batches.create(requests=[{"custom_id": k[:64], "params": req} for k, (_, req) in items])
        self.batches.append(b.id)
        log(f"\nBATCH {b.id}: {len(items)} requests sent; waiting for results")
        t0 = time.monotonic()
        while True:
            b = client.messages.batches.retrieve(b.id)
            if getattr(b, "processing_status", "") == "ended":
                break
            if time.monotonic() - t0 > timeout_s:
                raise TimeoutError(f"batch {b.id} not finished after {int(timeout_s)}s")
            time.sleep(poll_s)
        log(f"BATCH {b.id}: finished after {int(time.monotonic() - t0)}s")
        owner = {k[:64]: (k, d, req) for k, (d, req) in items}
        for entry in client.messages.batches.results(b.id):
            k, domain, req = owner.get(entry.custom_id, (None, None, None))
            if k is None:
                continue
            r = entry.result
            if getattr(r, "type", "") == "succeeded":
                self.results[k] = {"ok": True, "message": r.message}
                self._count(domain, req["model"], getattr(r.message, "usage", None))
            else:
                err = getattr(getattr(r, "error", None), "message", None) or getattr(r, "type", "failed")
                self.results[k] = {"ok": False, "error": str(err)[:300]}
        for k, _ in items:  # anything the results didn't mention counts as failed, so the scan moves on
            self.results.setdefault(k, {"ok": False, "error": "no result returned"})
        self.pending.clear()
        return len(items)

    def _count(self, domain: str, model: str, u) -> None:
        if u is None:
            return
        m = self.usage.setdefault(domain, {}).setdefault(model, {"calls": 0, "input": 0, "output": 0, "batch": True})
        m["calls"] += 1
        m["input"] += getattr(u, "input_tokens", 0) or 0
        m["output"] += getattr(u, "output_tokens", 0) or 0
        from .extract import PRICES
        pin, pout = PRICES.get(model, (0, 0))
        cost = ((getattr(u, "input_tokens", 0) or 0) / 1e6 * pin + (getattr(u, "output_tokens", 0) or 0) / 1e6 * pout) * config.BATCH_PRICE_FACTOR
        self.spent += cost
        if model == config.ESCALATION_MODEL:
            from . import extract
            extract.ESCALATION_SPENT += cost


BATCH: Batch | None = None  # set by run.py --batch
