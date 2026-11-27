"""Page text helpers: strip the menus, banners, cart and footer a page shares with the
homepage (less to send to the AI, and the real content left behind), and spot pages
that hold no real content of the type we expected (empty, or built by JavaScript)."""
from __future__ import annotations

import re

# words a page of each type should contain somewhere in its own content
TYPE_WORDS = {
    "returns": re.compile(r"\b(return|refund|exchange)", re.I),
    "shipping": re.compile(r"\b(shipping|delivery|deliver|postage|dispatch|freight)", re.I),
}
MIN_OWN_CHARS = 250


def shared_lines(home_text: str) -> set[str]:
    return {l.strip().lower() for l in home_text.splitlines() if l.strip()}


def own_text(page_text: str, home: set[str]) -> str:
    """The page's text without lines that also appear on the homepage (navigation, banners,
    cart drawer, footer). Repeated lines within the page are kept once."""
    out, seen = [], set()
    for l in page_text.splitlines():
        k = l.strip().lower()
        if not k or k in home or k in seen:
            continue
        seen.add(k)
        out.append(l.strip())
    return "\n".join(out)


def looks_empty(own: str, ptype: str) -> bool:
    """True when what's left of a page can't be a real page of this type."""
    words = TYPE_WORDS.get(ptype)
    if words is None:
        return False
    return len(own) < MIN_OWN_CHARS or not words.search(own)


def fingerprint(own: str, questions: str) -> str:
    """Stored as the page's content_hash. Same page text + same questions + same model = same answer,
    so a matching fingerprint on the next scan means the page's stored facts can be reused."""
    import hashlib
    norm = "\n".join(" ".join(l.split()).lower() for l in own.splitlines() if l.strip())
    return "own:" + hashlib.sha256((questions + "\n" + norm).encode()).hexdigest()
