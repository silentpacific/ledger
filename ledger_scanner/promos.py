"""Promotion de-duplication.

The AI names the same offer slightly differently on different pages and scans
("Black Friday Sale" / "Black Friday Sale – Up to 70% Off"). Without merging, each
wording becomes its own promotion and the calendar fills with copies.

Two promotions are the same offer when:
  - their stated start dates don't contradict each other,
  - their types don't contradict each other,
  - the numbers in them agree (one set contains the other; years ignored), and
  - their words overlap enough.
"""
from __future__ import annotations

import hashlib
import re

STOP = {"the", "a", "an", "of", "and", "to", "on", "for", "in", "at", "with", "your", "our", "sale", "now",
        "shop", "is", "all", "-", "–", "selected", "select"}
TYPE_GROUPS = {"percent_off": "pct", "percent_off_selected": "pct", "dollar_off": "dollar", "bogo": "bogo",
               "free_shipping": "ship", "gift_with_purchase": "gift", "loyalty_bonus": "loyal",
               "finance_offer": "finance", "bundle": "bundle", "prize_draw": "prize"}


def _text(p: dict) -> str:
    return f"{p.get('headline') or p.get('name') or ''} {p.get('discount') or ''}"


def _words(p: dict) -> set[str]:
    t = re.sub(r"[^a-z0-9%$ ]+", " ", _text(p).lower())
    return {w for w in t.split() if w not in STOP and not re.fullmatch(r"(19|20)\d\d", w)}


def _numbers(p: dict) -> set[str]:
    nums = re.findall(r"\d+(?:\.\d+)?", _text(p).replace(",", ""))
    return {n for n in nums if not re.fullmatch(r"(19|20)\d\d", n)}


def _start(p: dict):
    return p.get("starts") or p.get("stated_start")


def _type(p: dict):
    t = p.get("type") or p.get("promo_type")
    return TYPE_GROUPS.get(t) if t and t != "other" else None


def _years(p: dict) -> set[str]:
    ys = set(re.findall(r"\b(20\d\d)\b", _text(p)))
    for k in ("starts", "stated_start", "ends", "stated_end"):
        if p.get(k):
            ys.add(str(p[k])[:4])
    return ys


def _d(v):
    return str(v)[:10] if v else None


def _seen(p: dict) -> tuple:
    return (_d(p.get("first_seen_at") or p.get("seen_at")), _d(p.get("last_seen_at") or p.get("seen_at")))


def _outside(dated: dict, other: dict) -> bool:
    """True when `other` was seen live clearly outside `dated`'s stated run (7 days' grace)."""
    from datetime import date, timedelta
    st, en = _d(dated.get("starts") or dated.get("stated_start")), _d(dated.get("ends") or dated.get("stated_end"))
    if other.get("starts") or other.get("stated_start") or other.get("ends") or other.get("stated_end"):
        return False  # both dated: the stated dates are compared instead (a terms-page entry's scan date isn't a sighting)
    first, last = _seen(other)
    if not (first or last) or not (st or en):
        return False
    grace = timedelta(days=7)
    if en and first and date.fromisoformat(first) > date.fromisoformat(en) + grace:
        return True
    if st and last and date.fromisoformat(last) < date.fromisoformat(st) - grace:
        return True
    return False


def same_offer(a: dict, b: dict) -> bool:
    sa, sb = _start(a), _start(b)
    if sa and sb and str(sa)[:10] != str(sb)[:10]:
        return False
    ya, yb = _years(a), _years(b)
    if ya and yb and not (ya & yb):
        return False  # Afterpay Day 2025 is not Afterpay Day 2026
    if _outside(a, b) or _outside(b, a):
        return False  # seen live long after that sale ended (or before it began)
    ta, tb = _type(a), _type(b)
    if ta and tb and ta != tb:
        return False
    na, nb = _numbers(a), _numbers(b)
    if na and nb and not (na <= nb or nb <= na):
        return False
    if bool(na) != bool(nb) and (na or nb):
        # one mentions a number and the other doesn't: only merge on very close wording
        need = 0.7
    else:
        need = 0.45
    wa, wb = _words(a), _words(b)
    if not wa or not wb:
        return False
    return len(wa & wb) / len(wa | wb) >= need


def richness(p: dict) -> tuple:
    return (bool(_start(p)), bool(p.get("ends") or p.get("stated_end")), len(p.get("discount") or ""),
            -len(p.get("headline") or p.get("name") or ""))


def merge_list(items: list[dict]) -> list[dict]:
    """Collapse same-offer items within one scan; keep the richest wording, union placements."""
    clusters: list[list[dict]] = []
    for p in items:
        for c in clusters:
            if any(same_offer(p, q) for q in c):
                c.append(p)
                break
        else:
            clusters.append([p])
    out = []
    for c in clusters:
        best = dict(max(c, key=richness))
        places = []
        for q in c:
            places += [x for x in (q.get("placement") or []) if x not in places]
        if places:
            best["placement"] = places
        for k in ("starts", "ends", "type", "discount"):
            if not best.get(k):
                best[k] = next((q.get(k) for q in c if q.get(k)), None)
        out.append(best)
    return out


def default_key(name: str, starts) -> str:
    return hashlib.md5(((name or "").lower().strip(" ") + (str(starts) if starts else "")).encode()).hexdigest()


def assign_keys(live: list[dict], history: list[dict], existing: list[dict]) -> None:
    """Give every promotion a promo_key, reusing the key of a stored promotion (or of a
    terms-page entry in this scan) for the same offer, so its sightings join one timeline."""
    for h in history:
        match = next((e for e in existing if same_offer(h, e)), None)
        h["promo_key"] = match["promo_key"] if match else default_key(h.get("name"), h.get("starts"))
    for p in live:
        match = next((e for e in existing if same_offer(p, e)), None)
        if not match:
            match = next((h for h in history if same_offer(p, h)), None)
        p["promo_key"] = match["promo_key"] if match else default_key(p.get("headline"), p.get("starts"))
