"""Polite fetching: robots.txt first, rate limit per domain, honest user agent.
Plain HTTP by default; Firecrawl only as a fallback for pages that need JavaScript.
Never logs in, never gets around bot protection: a block is recorded, not fought."""
from __future__ import annotations

import hashlib
import time
import urllib.robotparser
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import requests

from . import config


@dataclass
class Page:
    url: str
    status: int | None
    html: str = ""
    text: str = ""
    method: str = "http"
    robots_allowed: bool = True
    note: str | None = None
    content_hash: str | None = None

    def record(self) -> dict:
        return {
            "url": self.url, "status": self.status, "robots_allowed": self.robots_allowed,
            "fetch_method": self.method, "content_hash": self.content_hash, "note": self.note,
        }


@dataclass
class Fetcher:
    base_url: str
    robots_text: str = ""
    pages: list[Page] = field(default_factory=list)
    _robots: urllib.robotparser.RobotFileParser | None = None
    _last: float = 0.0

    def __post_init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": config.USER_AGENT,
            "Accept-Language": "en-AU,en;q=0.9",
        })

    # -- robots -------------------------------------------------------------
    def load_robots(self) -> str:
        robots_url = urljoin(self.base_url, "/robots.txt")
        self._robots = urllib.robotparser.RobotFileParser()
        try:
            r = self._get(robots_url)
            self.robots_text = r.text if r.status_code == 200 else ""
            self._robots.parse(self.robots_text.splitlines())
            self.pages.append(Page(robots_url, r.status_code, method="http"))
        except requests.RequestException as e:
            self._robots.parse([])
            self.pages.append(Page(robots_url, None, note=f"robots fetch failed: {e}"))
        return self.robots_text

    def allowed(self, url: str) -> bool:
        if self._robots is None:
            self.load_robots()
        return self._robots.can_fetch(config.ROBOTS_AGENT, url)

    # -- fetching -----------------------------------------------------------
    def _get(self, url: str) -> requests.Response:
        wait = config.SECONDS_BETWEEN_REQUESTS - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.time()
        r = self.session.get(url, timeout=config.REQUEST_TIMEOUT, allow_redirects=True)
        if r.status_code == 429:  # back off once, as llms.txt / politeness asks
            time.sleep(int(r.headers.get("Retry-After", "30")) if r.headers.get("Retry-After", "").isdigit() else 30)
            r = self.session.get(url, timeout=config.REQUEST_TIMEOUT, allow_redirects=True)
        return r

    def fetch(self, url: str, want_text: bool = True) -> Page:
        url = urljoin(self.base_url, url)
        if not self.allowed(url):
            p = Page(url, None, robots_allowed=False, note="skipped: disallowed by robots.txt")
            self.pages.append(p)
            return p
        try:
            r = self._get(url)
        except requests.RequestException as e:
            p = Page(url, None, note=f"fetch failed: {type(e).__name__}")
            self.pages.append(p)
            return p
        p = Page(url, r.status_code, html=r.text, method="http")
        if r.status_code in (401, 403, 503) and _looks_blocked(r.text):
            p.note = "blocked by bot protection; not circumvented"
        p.content_hash = hashlib.sha256(r.content).hexdigest() if r.content else None
        if want_text and "html" in r.headers.get("content-type", ""):
            p.text = html_to_text(r.text)
        else:
            p.text = r.text if want_text else ""
        self.pages.append(p)
        return p

    def fetch_rendered(self, url: str) -> Page:
        """Firecrawl fallback for JavaScript-built pages (store lists, product tiles).
        Only for pages robots.txt allows; uses Firecrawl's standard (non-stealth) fetch."""
        url = urljoin(self.base_url, url)
        if not self.allowed(url):
            p = Page(url, None, robots_allowed=False, note="skipped: disallowed by robots.txt")
            self.pages.append(p)
            return p
        if not config.FIRECRAWL_API_KEY:
            return self.fetch(url)
        try:
            r = requests.post(
                "https://api.firecrawl.dev/v2/scrape",
                headers={"Authorization": f"Bearer {config.FIRECRAWL_API_KEY}"},
                json={"url": url, "formats": ["markdown"], "location": {"country": "AU"},
                      "proxy": "basic", "maxAge": 0},
                timeout=120,
            )
            data = r.json().get("data", {}) if r.ok else {}
            md = data.get("markdown", "") or ""
            status = (data.get("metadata") or {}).get("statusCode", r.status_code)
            p = Page(url, status, text=md, method="firecrawl",
                     content_hash=hashlib.sha256(md.encode()).hexdigest() if md else None)
            if not r.ok:
                p.note = f"firecrawl error {r.status_code}"
        except requests.RequestException as e:
            p = Page(url, None, method="firecrawl", note=f"firecrawl failed: {type(e).__name__}")
        self.pages.append(p)
        return p


def _looks_blocked(body: str) -> bool:
    b = body[:5000].lower()
    return any(s in b for s in ("captcha", "cf-chl", "access denied", "attention required", "bot detection"))


def html_to_text(html: str) -> str:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()
    text = soup.get_text("\n")
    lines = [" ".join(l.split()) for l in text.splitlines()]
    return "\n".join(l for l in lines if l)


def same_site(url: str, base: str) -> bool:
    a, b = urlparse(url).netloc.lower(), urlparse(base).netloc.lower()
    return a == b or a.removeprefix("www.") == b.removeprefix("www.")
