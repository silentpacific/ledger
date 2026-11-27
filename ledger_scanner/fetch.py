"""Polite fetching: robots.txt first, rate limit per domain, honest user agent.
Plain HTTP by default. Firecrawl (standard fetch, never stealth) is used for pages that need
JavaScript, and for a whole site when its homepage rejects our direct requests (connection
dropped, 429, 202 holding page, 403/503): Rahul's decision, 27 Nov 2026. Never logs in;
robots.txt and the terms gate still apply in Firecrawl mode."""
from __future__ import annotations

import hashlib
import threading
import time
import urllib.robotparser
from dataclasses import dataclass, field
from html import unescape
from urllib.parse import urljoin, urlparse

import requests

from . import config

# Batch mode scans each site in several rounds; this keeps every response of the run so later
# rounds don't contact the site again. None outside batch mode.
RUN_CACHE: dict | None = None

# Firecrawl calls take turns across the batch warm-up threads, and back off when Firecrawl itself
# says "too many requests" (its account rate limit, not the store's).
_FC_LOCK = threading.Lock()


def firecrawl_post(payload: dict) -> requests.Response:
    with _FC_LOCK:
        for attempt in range(4):
            r = requests.post("https://api.firecrawl.dev/v2/scrape",
                              headers={"Authorization": f"Bearer {config.FIRECRAWL_API_KEY}"},
                              json=payload, timeout=120)
            if r.status_code != 429 or attempt == 3:
                return r
            ra = r.headers.get("Retry-After", "")
            time.sleep(min(int(ra), 90) if ra.isdigit() else 15 * (attempt + 1))
        return r


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
    via_firecrawl: bool = False   # whole site read through Firecrawl (direct requests rejected)

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
        if RUN_CACHE is not None and ("get", url) in RUN_CACHE:
            return RUN_CACHE[("get", url)]
        r = self._get_live(url)
        if RUN_CACHE is not None:
            RUN_CACHE[("get", url)] = r
        return r

    def _get_live(self, url: str) -> requests.Response:
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
        if self.via_firecrawl:
            return self._firecrawl_page(url, want_text)
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
        if not config.FIRECRAWL_API_KEY or self.via_firecrawl:
            return self.fetch(url)
        if RUN_CACHE is not None and ("render", url) in RUN_CACHE:
            p = Page(**RUN_CACHE[("render", url)].__dict__)
            self.pages.append(p)
            return p
        try:
            r = firecrawl_post({"url": url, "formats": ["markdown"], "location": {"country": "AU"},
                                "proxy": "basic", "maxAge": 0})
            data = r.json().get("data", {}) if r.ok else {}
            md = data.get("markdown", "") or ""
            status = (data.get("metadata") or {}).get("statusCode", r.status_code)
            p = Page(url, status, text=md, method="firecrawl",
                     content_hash=hashlib.sha256(md.encode()).hexdigest() if md else None)
            if not r.ok:
                p.note = f"firecrawl error {r.status_code}"
        except requests.RequestException as e:
            p = Page(url, None, method="firecrawl", note=f"firecrawl failed: {type(e).__name__}")
        if RUN_CACHE is not None:
            RUN_CACHE[("render", url)] = Page(**p.__dict__)
        self.pages.append(p)
        return p


    # -- Firecrawl mode for sites that reject direct requests -------------
    def fetch_home(self, url: str) -> Page:
        """Fetch the homepage; if the site rejects direct requests, switch this site to Firecrawl."""
        home = self.fetch(url)
        if home.status == 200 and home.html:
            return home
        rejected = home.status in (None, 202, 403, 429, 503) and home.robots_allowed
        if not rejected or not config.FIRECRAWL_API_KEY:
            return home
        self.via_firecrawl = True
        self._load_robots_firecrawl()
        again = self.fetch(url)
        if again.status == 200 and again.html:
            again.note = f"direct request rejected ({home.status or home.note}); read through Firecrawl"
            return again
        self.via_firecrawl = False
        return home

    def _load_robots_firecrawl(self) -> None:
        robots_url = urljoin(self.base_url, "/robots.txt")
        p = self._firecrawl_page(robots_url, True, record=False)
        self.robots_text = p.text if p.status == 200 else ""
        self._robots = urllib.robotparser.RobotFileParser()
        self._robots.parse(self.robots_text.splitlines())
        p.note = "robots.txt read through Firecrawl"
        self.pages.append(p)

    def _firecrawl_page(self, url: str, want_text: bool = True, record: bool = True) -> Page:
        if RUN_CACHE is not None and ("fc", url) in RUN_CACHE:
            p = Page(**RUN_CACHE[("fc", url)].__dict__)
        else:
            wait = config.SECONDS_BETWEEN_REQUESTS - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            try:
                r = firecrawl_post({"url": url, "formats": ["rawHtml"], "location": {"country": "AU"},
                                    "proxy": "basic", "maxAge": 0, "onlyMainContent": False})
                data = r.json().get("data", {}) if r.ok else {}
                meta = data.get("metadata") or {}
                raw = data.get("rawHtml", "") or ""
                ctype = (meta.get("contentType") or "text/html").lower()
                status = meta.get("statusCode") if r.ok else None
                if "html" not in ctype:  # robots.txt, sitemaps, JSON: the browser wraps them in <pre>
                    raw = _unwrap_pre(raw)
                p = Page(url, status, html=raw, method="firecrawl",
                         content_hash=hashlib.sha256(raw.encode()).hexdigest() if raw else None)
                p.text = html_to_text(raw) if "html" in ctype else raw
                if not r.ok:
                    p.note = f"Firecrawl API error {r.status_code} (not the store's answer)"
            except (requests.RequestException, ValueError) as e:
                p = Page(url, None, method="firecrawl", note=f"firecrawl failed: {type(e).__name__}")
            if RUN_CACHE is not None:
                RUN_CACHE[("fc", url)] = Page(**p.__dict__)
        if not want_text:
            p.text = ""
        if record:
            self.pages.append(p)
        return p


def _unwrap_pre(raw: str) -> str:
    import re
    m = re.search(r"<pre[^>]*>(.*?)</pre>", raw, re.S | re.I)
    return unescape(m.group(1)) if m else raw


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
