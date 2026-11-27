"""Policies kept in help centres and FAQ apps (Zendesk, Gorgias, Intercom, Freshdesk, help.<store>...).

Used only when a store's own pages haven't given the core returns/shipping facts. Every URL still goes
through Fetcher.fetch, so the help centre's own robots.txt is respected. Bounded: a handful of requests
per store, and only articles whose title or address names the topic are returned."""
from __future__ import annotations

import json
import re
from urllib.parse import quote, urljoin, urlparse

from bs4 import BeautifulSoup

from .fetch import Fetcher

# Hosted help-centre platforms; a link to one of these from the store's pages is its help centre
PLATFORMS = re.compile(r"(\.zendesk\.com|\.gorgias\.help|intercom\.help|\.freshdesk\.com|\.helpscoutdocs\.com|"
                       r"\.kustomer\.help|\.reamaze\.com|\.helpjuice\.com|\.document360\.io|\.gitbook\.io)$")
SUBDOMAINS = ("help", "support", "faq", "faqs", "care", "customercare", "customer-care", "helpcentre", "helpcenter")
SECTION = re.compile(r"/(categories|sections|collections|folders|topics)/", re.I)
ARTICLE = re.compile(r"/(articles?|solutions/articles|kb|questions?)/", re.I)

TOPIC_WORDS = {
    "returns": ("return", "refund", "exchange", "change of mind", "change-of-mind", "faulty", "cancel"),
    "shipping": ("delivery", "deliver", "shipping", "ship", "postage", "dispatch", "freight", "courier"),
}
MAX_SECTIONS = 3
MAX_ARTICLES = 3


def _root(host: str) -> str:
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    keep = 3 if len(parts) >= 3 and parts[-2] in ("com", "net", "org", "co") and len(parts[-1]) == 2 else 2
    return ".".join(parts[-keep:])


def find_help_centres(site_url: str, links: list[str]) -> list[str]:
    """Help-centre start pages linked from the store (subdomains of the store, or hosted platforms)."""
    root = _root(urlparse(site_url).netloc)
    out: list[str] = []
    for u in links:
        p = urlparse(u)
        host = p.netloc.lower()
        if not host or _root(host) == root and host.split(".")[0] not in SUBDOMAINS:
            continue
        is_sub = _root(host) == root and host.split(".")[0] in SUBDOMAINS
        if is_sub or PLATFORMS.search(host):
            start = f"{p.scheme}://{p.netloc}/"
            if "/hc/" in p.path:  # Zendesk keeps its centre under /hc/<locale>
                start += "/".join(p.path.strip("/").split("/")[:2]) + "/"
            if start not in out:
                out.append(start)
    return out


def all_links(html: str, base: str) -> list[str]:
    soup = BeautifulSoup(html or "", "lxml")
    return [urljoin(base, a["href"].split("#")[0]) for a in soup.find_all("a", href=True)]


def guess_help_centres(site_url: str) -> list[str]:
    root = _root(urlparse(site_url).netloc)
    return [f"https://help.{root}/", f"https://support.{root}/"]


def _matches(text: str, ptype: str) -> bool:
    t = text.lower()
    return any(w in t for w in TOPIC_WORDS[ptype])


def _zendesk_search(f: Fetcher, start: str, ptype: str) -> list[str]:
    """Zendesk's public article search: titles name the topic even when addresses are bare numbers."""
    p = urlparse(start)
    found: list[str] = []
    for word in TOPIC_WORDS[ptype][:3]:
        page = f.fetch(f"{p.scheme}://{p.netloc}/api/v2/help_center/articles/search.json?query={quote(word)}&per_page=10",
                       want_text=False)
        if page.status != 200:
            return found
        try:
            results = json.loads(page.html).get("results", [])
        except (json.JSONDecodeError, AttributeError):
            return found
        for r in results:
            if _matches(r.get("title", ""), ptype) and r.get("html_url") and r["html_url"] not in found:
                found.append(r["html_url"])
        if len(found) >= MAX_ARTICLES:
            break
    return found[:MAX_ARTICLES]


def _links(html: str, base: str) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "lxml")
    host = urlparse(base).netloc
    out: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].split("#")[0])
        if urlparse(href).netloc == host and href not in out:
            out[href] = " ".join(a.get_text(" ", strip=True).split())[:120]
    return out


def articles_for(f: Fetcher, start: str, ptype: str) -> list[str]:
    """Up to MAX_ARTICLES article URLs about returns or shipping in one help centre."""
    home = f.fetch(start)
    if home.status != 200 or not home.html:
        return []
    if "zendesk" in (home.html[:20000].lower()) or "/hc/" in start:
        got = _zendesk_search(f, start, ptype)
        if got:
            return got
    links = _links(home.html, home.url or start)
    articles = [u for u, t in links.items() if _matches(f"{t} {u}", ptype) and not SECTION.search(u)]
    if len(articles) < MAX_ARTICLES:  # look one level down, in the sections whose names match
        sections = [u for u, t in links.items() if SECTION.search(u) and _matches(f"{t} {u}", ptype)][:MAX_SECTIONS]
        for s in sections:
            page = f.fetch(s)
            if page.status == 200:
                for u, t in _links(page.html, s).items():
                    if (ARTICLE.search(u) or _matches(u, ptype)) and _matches(f"{t} {u}", ptype) and u not in articles:
                        articles.append(u)
            if len(articles) >= MAX_ARTICLES:
                break
    ranked = sorted(articles, key=lambda u: (not ARTICLE.search(u), len(u)))
    return ranked[:MAX_ARTICLES]
