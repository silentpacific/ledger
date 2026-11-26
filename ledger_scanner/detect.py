"""Code-based facts: no AI. Platform, tech stack, BNPL, payment icons, structured data,
AI-readiness and simple homepage signals. These are the most reliable facts we collect."""
from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup

# Fingerprints: (category, name, regex matched against raw HTML)
TECH_RULES: list[tuple[str, str, str]] = [
    ("ecommerce_platform", "Shopify", r"cdn\.shopify\.com|shopify-digital-wallet|Shopify\.theme"),
    ("ecommerce_platform", "WooCommerce", r"woocommerce|wc-ajax"),
    ("ecommerce_platform", "Magento", r"mage/cookies|Magento_|/static/version\d+/frontend/"),
    ("ecommerce_platform", "BigCommerce", r"cdn\d*\.bigcommerce\.com|stencil-utils"),
    ("ecommerce_platform", "Salesforce Commerce Cloud", r"demandware|/on/demandware\.store/|mobify"),
    ("cms", "WordPress", r"wp-content/|wp-includes/"),
    ("tag_manager", "Google Tag Manager", r"googletagmanager\.com/gtm\.js|GTM-[A-Z0-9]{4,}"),
    ("analytics", "Google Analytics 4", r"gtag/js\?id=G-|['\"]G-[A-Z0-9]{6,}['\"]"),
    ("ad_pixel", "Meta Pixel", r"connect\.facebook\.net/.+/fbevents\.js|fbq\("),
    ("ad_pixel", "TikTok Pixel", r"analytics\.tiktok\.com"),
    ("ad_pixel", "Pinterest Tag", r"s\.pinimg\.com/ct/core\.js|pintrk\("),
    ("ad_pixel", "Google Ads", r"googleadservices\.com|AW-\d{6,}"),
    ("ad_pixel", "Microsoft Ads", r"bat\.bing\.com"),
    ("experimentation", "Optimizely", r"cdn\.optimizely\.com|optimizely\.com/js"),
    ("experimentation", "VWO", r"dev\.visualwebsiteoptimizer\.com|_vwo_code"),
    ("experimentation", "AB Tasty", r"try\.abtasty\.com"),
    ("experimentation", "Convert", r"cdn-\d+\.convertexperiments\.com"),
    ("session_recording", "Hotjar", r"static\.hotjar\.com|hotjar"),
    ("session_recording", "Microsoft Clarity", r"clarity\.ms/tag"),
    ("email_sms", "Klaviyo", r"static\.klaviyo\.com|klaviyo\.com/onsite"),
    ("email_sms", "Mailchimp", r"chimpstatic\.com|list-manage\.com"),
    ("email_sms", "Omnisend", r"omnisnippet|omnisend\.com"),
    ("reviews", "Yotpo", r"staticw2\.yotpo\.com|yotpo\.com"),
    ("reviews", "Okendo", r"okendo\.io"),
    ("reviews", "Judge.me", r"judge\.me"),
    ("reviews", "Trustpilot widget", r"widget\.trustpilot\.com"),
    ("reviews", "Reviews.io", r"widget\.reviews\.io|reviews\.io"),
    ("reviews", "Feefo", r"api\.feefo\.com|feefo\.com"),
    ("reviews", "Bazaarvoice", r"bazaarvoice\.com"),
    ("search", "Boost Product Filter & Search", r"boost-pfs|boostcommerce|bc-sf-filter"),
    ("search", "Algolia", r"algolia(net)?\.(com|net)|algoliasearch"),
    ("search", "Klevu", r"klevu\.com"),
    ("search", "Searchspring", r"searchspring\.(net|io)"),
    ("recommendations", "Nosto", r"connect\.nosto\.com"),
    ("recommendations", "Rebuy", r"rebuyengine\.com"),
    ("chat", "Gorgias", r"gorgias\.(chat|io)"),
    ("chat", "Zendesk", r"zdassets\.com|zopim"),
    ("chat", "Intercom", r"widget\.intercom\.io"),
    ("chat", "Tidio", r"code\.tidio\.co"),
    ("chat", "LiveChat", r"cdn\.livechatinc\.com"),
    ("loyalty", "Smile.io", r"cdn\.sweettooth\.io|smile\.io"),
    ("loyalty", "LoyaltyLion", r"loyaltylion"),
    ("subscriptions", "Recharge", r"rechargecdn|rechargepayments"),
    ("returns", "Loop Returns", r"loopreturns"),
    ("shipping", "AfterShip", r"aftership"),
    ("consent", "OneTrust", r"cdn\.cookielaw\.org|onetrust"),
    ("consent", "Cookiebot", r"consent\.cookiebot\.com"),
    ("affiliate", "Commission Factory", r"commissionfactory"),
    ("cdn", "Cloudflare", r"cdnjs\.cloudflare\.com|/cdn-cgi/"),
]

BNPL_RULES = {
    "afterpay": r"afterpay|clearpay",
    "zip": r"zip\.co|zipmoney|zippay|quadpay|\bzip pay\b",
    "humm": r"\bhumm\b|shophumm",
    "klarna": r"klarna",
    "latitude": r"latitude ?(gem|interest|pay)|latitudepay|latitudefinancial",
    "paypal_pay_in_4": r"pay in 4|paylater|pay-later-messaging",
    "openpay": r"openpay",
}

PAYMENT_ICON_NAMES = {
    "American Express": "amex", "Apple Pay": "apple_pay", "Google Pay": "google_pay",
    "Mastercard": "mastercard", "PayPal": "paypal", "Shop Pay": "shop_pay",
    "Union Pay": "unionpay", "Visa": "visa", "Diners Club": "diners", "WeChat Pay": "wechat_pay",
    "Afterpay": "afterpay", "Klarna": "klarna", "Zip": "zip",
}

SHOPIFY_ICON_IDS = {
    "american_express": "amex", "apple_pay": "apple_pay", "google_pay": "google_pay", "master": "mastercard",
    "paypal": "paypal", "shopify_pay": "shop_pay", "union_pay": "unionpay", "visa": "visa", "diners_club": "diners",
    "afterpay": "afterpay", "klarna": "klarna", "zip": "zip", "wechat_pay": "wechat_pay",
}

AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User",
           "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider",
           "Amazonbot", "Meta-ExternalAgent"]


def fact(category, key, value, *, status="observed", source_url=None, evidence=None,
         method="code", confidence="high", unit=None, note=None) -> dict:
    d = {"category": category, "key": key, "status": status, "value": value,
         "source_url": source_url, "method": method, "confidence": confidence}
    if evidence is not None:
        d["evidence"] = evidence[:300]
        d["evidence_verified"] = True   # code-found evidence is taken from the page itself
    if unit:
        d["unit"] = unit
    if note:
        d["note"] = note
    return d


def detect_tech(html: str, url: str) -> tuple[list[dict], str | None]:
    found, platform = [], None
    for cat, name, rx in TECH_RULES:
        m = re.search(rx, html, re.I)
        if m:
            found.append({"category": cat, "name": name, "evidence": m.group(0)[:120]})
            if cat == "ecommerce_platform" and platform is None:
                platform = name
    facts = [fact("tech_stack", "technologies", sorted({t["name"] for t in found}), source_url=url,
                  note="Regex fingerprints on raw homepage HTML (before consent)")]
    for t in found:
        facts.append(fact("tech_stack", f"detected.{_slug(t['name'])}", {"category": t["category"], "name": t["name"]},
                          source_url=url, evidence=t["evidence"]))
    if platform:
        facts.append(fact("tech_stack", "platform", platform, source_url=url))
    return facts, platform


def detect_payments(html: str, text: str, url: str) -> list[dict]:
    facts = []
    bnpl = sorted(k for k, rx in BNPL_RULES.items() if re.search(rx, html, re.I))
    if bnpl:
        facts.append(fact("payments", "bnpl_providers", bnpl, source_url=url,
                          note="Detected in homepage HTML (scripts, widgets, image names, text)"))
    icons = {v for k, v in PAYMENT_ICON_NAMES.items()
             if re.search(rf"\b{re.escape(k)}\b", text) or re.search(rf"<title[^>]*>\s*{re.escape(k)}\s*</title>", html, re.I)}
    icons |= {SHOPIFY_ICON_IDS[m] for m in re.findall(r"pi-([a-z_]+)", html) if m in SHOPIFY_ICON_IDS}
    icons = sorted(icons)
    if icons:
        facts.append(fact("payments", "payment_icons", icons, source_url=url, method="structured_data"))
    return facts


def detect_structured_data(html: str, url: str) -> tuple[list[dict], list[dict]]:
    """Returns (facts, raw JSON-LD objects)."""
    soup = BeautifulSoup(html, "lxml")
    objs = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for o in data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []:
            if isinstance(o, dict):
                objs.append(o)
    types = sorted({t for o in objs for t in ([o.get("@type")] if isinstance(o.get("@type"), str) else o.get("@type") or [])})
    facts = [fact("ai_readiness", "schema_types_homepage", types, source_url=url)]
    for o in objs:
        if o.get("@type") in ("Organization", "OnlineStore", "JewelryStore", "Store"):
            if o.get("name"):
                facts.append(fact("site_identity", "trading_name", o["name"], source_url=url, method="structured_data"))
            same = o.get("sameAs")
            if same:
                facts.append(fact("site_identity", "social_profiles", sorted(set(same if isinstance(same, list) else [same])),
                                  source_url=url, method="structured_data"))
        agg = o.get("aggregateRating")
        if isinstance(agg, dict) and agg.get("ratingValue"):
            facts.append(fact("trust_support", "site_rating_shown",
                              {"rating": _num(agg.get("ratingValue")), "count": _num(agg.get("reviewCount") or agg.get("ratingCount"))},
                              source_url=url, method="structured_data"))
    return facts, objs


def detect_homepage_signals(html: str, text: str, url: str) -> list[dict]:
    facts = []
    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.string or "").strip() if soup.title else ""
    if title:
        facts.append(fact("content_marketing", "homepage_title", " ".join(title.split()), source_url=url))
    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        facts.append(fact("content_marketing", "homepage_meta_description", desc["content"].strip()[:500], source_url=url))
    m = re.search(r"free (?:standard )?(?:shipping|delivery)[^.\n$]{0,60}?(?:over|on orders over|when you spend|orders? \$?)\s*\$\s?(\d{2,4})", text, re.I)
    if m:
        facts.append(fact("shipping", "free_shipping_threshold", {"amount": int(m.group(1)), "currency": "AUD"},
                          source_url=url, evidence=m.group(0), method="code", confidence="medium",
                          note="Regex on homepage text; dedicated shipping page takes priority"))
    stores = re.search(r"(\d{1,4})\s+stores?\s+(?:australia[- ]wide|nationwide|across)", text, re.I)
    if stores:
        facts.append(fact("site_identity", "store_count", int(stores.group(1)), source_url=url,
                          evidence=stores.group(0), confidence="medium"))
    if re.search(r"apps\.apple\.com/", html):
        facts.append(fact("site_identity", "ios_app", True, source_url=url))
    if re.search(r"play\.google\.com/store/apps", html):
        facts.append(fact("site_identity", "android_app", True, source_url=url))
    return facts


def detect_ai_readiness(robots_text: str, llms_status: int | None, llms_text: str, base: str) -> list[dict]:
    facts = [fact("ai_readiness", "robots_txt_present", bool(robots_text), source_url=base + "robots.txt")]
    rules = {}
    groups = _robots_groups(robots_text)
    for bot in AI_BOTS:
        g = groups.get(bot.lower())
        if g is None:
            rules[bot] = "default"
        elif any(d.strip() == "/" for d in g["disallow"]):
            rules[bot] = "blocked"
        else:
            rules[bot] = "allowed"
    facts.append(fact("ai_readiness", "robots_ai_bot_rules", rules, source_url=base + "robots.txt"))
    star = groups.get("*", {"disallow": []})["disallow"]
    facts.append(fact("ai_readiness", "robots_blocks_policies", any(d.startswith("/policies") for d in star),
                      source_url=base + "robots.txt"))
    facts.append(fact("ai_readiness", "robots_blocks_sorting", any("sort_by" in d for d in star),
                      source_url=base + "robots.txt"))
    has_llms = llms_status == 200 and len(llms_text.strip()) > 50 and "<html" not in llms_text[:500].lower()
    facts.append(fact("ai_readiness", "llms_txt", has_llms, source_url=base + "llms.txt"))
    if has_llms:
        facts.append(fact("ai_readiness", "llms_txt_chars", len(llms_text), source_url=base + "llms.txt"))
        ucp = re.search(r"https?://\S+/\.well-known/ucp", llms_text)
        mcp = re.search(r"https?://\S+/api/ucp/mcp", llms_text)
        if ucp or mcp:
            facts.append(fact("ai_readiness", "agent_commerce_endpoint",
                              {"protocol": "UCP", "profile": ucp.group(0) if ucp else None, "mcp": mcp.group(0) if mcp else None},
                              source_url=base + "llms.txt"))
    return facts


def _robots_groups(text: str) -> dict:
    groups, current, last_was_agent = {}, [], False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        k, v = (x.strip() for x in line.split(":", 1))
        k = k.lower()
        if k == "user-agent":
            if not last_was_agent:
                current = []
            current.append(v.lower())
            groups.setdefault(v.lower(), {"disallow": [], "allow": []})
            last_was_agent = True
        else:
            last_was_agent = False
            for a in current:
                if k in ("disallow", "allow") and v:
                    groups[a][k].append(v)
    return groups


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _num(v):
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None
