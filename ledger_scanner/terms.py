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
from urllib.parse import urlparse
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


GENERAL_SLUGS = {"terms", "terms-of-use", "terms-of-service", "terms-and-conditions", "terms-conditions",
                 "terms-condition", "website-terms", "website-terms-of-use", "website-terms-and-conditions",
                 "terms-of-sale", "policies-terms", "legal", "general-terms", "conditions-of-use", "tcs", "t-cs"}


def is_general_terms(url: str) -> bool:
    """The site's own terms, not the terms of one offer or service (Black Friday, cleaning, click & collect...)."""
    path = urlparse(url).path.lower().rstrip("/")
    slug = path.rsplit("/", 1)[-1]
    if slug in GENERAL_SLUGS:
        return True
    # brand-prefixed site terms: calleija.com/calleija-terms-and-conditions
    m = re.fullmatch(r"([a-z0-9]+)-(terms|terms-and-conditions|terms-conditions|terms-of-use|terms-of-service)", slug)
    return bool(m and m.group(1) in urlparse(url).netloc.lower())


def find_terms_urls(candidates: list[str]) -> list[str]:
    """General site-terms pages only, best first."""
    pref = ["terms-of-use", "terms-of-service", "terms-and-conditions", "website-terms", "terms"]
    terms = [u for u in candidates if is_general_terms(u)]
    return sorted(set(terms), key=lambda u: (next((i for i, p in enumerate(pref) if p in u.lower()), 9), len(u)))


def _prohibition(page) -> str | None:
    """Quote of a confirmed anti-scraping clause on this page, or None."""
    m = STRONG.search(page.text)
    if not m:
        return None
    quote = " ".join(m.group(0).split())[:400]
    if config.ANTHROPIC_API_KEY:
        # AI confirms the keyword hit is really a prohibition (not e.g. "we may crawl...")
        try:
            facts = extract.read_page_custom(PROMPT_FIELDS, page.url, page.text)
        except Exception:
            facts = []  # AI unavailable: keep the conservative keyword verdict
        f0 = next((x for x in facts if x["key"] == "anti_scraping_clause"), None)
        if f0 and f0["status"] == "observed" and f0["value"] is False and f0.get("evidence_verified"):
            return None
    return quote


def check_terms(f: Fetcher, candidates: list[str]) -> TermsResult:
    """Every readable general terms page is checked (up to 4); any confirmed prohibition wins.
    'allowed' needs at least one general terms page read with no prohibition."""
    urls = find_terms_urls(candidates)
    shopify_policy = f.base_url.rstrip("/") + "/policies/terms-of-service"
    if shopify_policy not in urls:
        urls.append(shopify_policy)

    read_ok, blocked_by_robots = None, []
    for url in urls[:4]:
        if not f.allowed(url):
            blocked_by_robots.append(url)
            continue
        page = f.fetch(url)
        if page.status != 200 or len(page.text) < 500:
            continue
        quote = _prohibition(page)
        if quote:
            return TermsResult("prohibited", page.url, quote)
        read_ok = read_ok or page.url

    if read_ok:
        return TermsResult("allowed", read_ok, None)
    if blocked_by_robots:
        return TermsResult("unclear", blocked_by_robots[0], "terms only at a URL that robots.txt disallows")
    return TermsResult("no_terms_found", None, None)
