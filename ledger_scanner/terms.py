"""Terms-of-use gate: runs before any facts are collected.

Verdicts
  prohibited      the terms forbid scraping / crawling / bots / data mining -> stop, store nothing,
                  switch the site off in the database
  allowed         terms found and read, no such clause
  unclear         terms exist but could not be read (e.g. only at a URL robots.txt disallows)
  no_terms_found  no terms page found

What happens on 'unclear' and 'no_terms_found' is set by TERMS_UNCLEAR_POLICY
('skip' = don't scan, 'proceed' = scan, since robots.txt allows the pages we read)."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass

from . import config, extract
from .fetch import Fetcher

UNCLEAR_POLICY = os.environ.get("TERMS_UNCLEAR_POLICY", "skip").lower()
# No terms page found at all: nothing prohibits scanning, so scan (robots.txt still obeyed).
NO_TERMS_POLICY = (os.environ.get("TERMS_NO_TERMS_POLICY") or "scan").lower()

STRONG = re.compile(
    r"[^.\n]{0,200}\b(scrap(e|es|ed|ing|er|ers)|crawl(s|ed|ing|er|ers)?|spider(s|ing)?|data[- ]?mining|"
    r"web[- ]?harvest\w*|harvest(ing)? (any )?(data|information|content)|"
    r"(robot|bot|spider|crawler|automated (means|tools?|software|devices?|process(es)?|systems?))s?\b[^.\n]{0,120}\b(access|monitor|copy|collect|extract|download|index))"
    r"[^.\n]{0,200}", re.I)

PROMPT_FIELDS = {
    "anti_scraping_clause": {"cat": "policies", "type": "boolean",
                             "desc": "True only if these terms prohibit scraping, crawling, spiders, robots/bots, "
                                     "automated access or data mining of the website"},
}


@dataclass
class TermsResult:
    verdict: str
    url: str | None
    evidence: str | None

    @property
    def blocks_scan(self) -> bool:
        if self.verdict == "prohibited":
            return True
        if self.verdict == "no_terms_found":
            return NO_TERMS_POLICY == "skip"
        return self.verdict == "unclear" and UNCLEAR_POLICY == "skip"


def find_terms_urls(candidates: list[str]) -> list[str]:
    pref = ["terms-of-use", "terms-of-service", "terms-and-conditions", "website-terms", "terms"]
    terms = [u for u in candidates if re.search(r"terms|conditions|legal", u, re.I)
             and not re.search(r"offer|promo|competition|sale|bidit|rewards|email|gift|layby|zip|afterpay|humm|latitude", u, re.I)]
    return sorted(set(terms), key=lambda u: next((i for i, p in enumerate(pref) if p in u.lower()), 9))


def check_terms(f: Fetcher, candidates: list[str]) -> TermsResult:
    urls = find_terms_urls(candidates)
    shopify_policy = f.base_url.rstrip("/") + "/policies/terms-of-service"
    if shopify_policy not in urls:
        urls.append(shopify_policy)

    read_any, blocked_by_robots = False, []
    for url in urls[:4]:
        if not f.allowed(url):
            blocked_by_robots.append(url)
            continue
        page = f.fetch(url)
        if page.status != 200 or len(page.text) < 500:
            continue
        read_any = True
        m = STRONG.search(page.text)
        if not m:
            return TermsResult("allowed", page.url, None)
        quote = " ".join(m.group(0).split())[:400]
        if config.ANTHROPIC_API_KEY:
            # AI confirms the keyword hit is really a prohibition (not e.g. "we may crawl...")
            try:
                facts = extract.read_page_custom(PROMPT_FIELDS, page.url, page.text)
            except Exception:
                facts = []  # AI unavailable: keep the conservative keyword verdict
            f0 = next((x for x in facts if x["key"] == "anti_scraping_clause"), None)
            if f0 and f0["status"] == "observed" and f0["value"] is False and f0.get("evidence_verified"):
                return TermsResult("allowed", page.url, f"keyword hit judged not a prohibition: {quote}")
        return TermsResult("prohibited", page.url, quote)

    if blocked_by_robots and not read_any:
        return TermsResult("unclear", blocked_by_robots[0], "terms only at a URL that robots.txt disallows")
    return TermsResult("no_terms_found", None, None)
