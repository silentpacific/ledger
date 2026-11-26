"""Settings, read from environment variables (GitHub Actions secrets)."""
import os


def _env(name: str, default: str = "") -> str:
    """Secrets pasted into GitHub often carry stray spaces or line breaks; strip them."""
    return (os.environ.get(name) or default).strip()


SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_SERVICE_KEY = _env("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY = _env("ANTHROPIC_API_KEY")
FIRECRAWL_API_KEY = _env("FIRECRAWL_API_KEY")

# AI model used for reading policy/promo text. Override with the CLAUDE_MODEL secret or variable.
CLAUDE_MODEL = _env("CLAUDE_MODEL", "claude-haiku-5-5")
# Stronger model asked only about the facts the first model could not settle
# (its two reads disagreed, or its quote was not on the page). Set to 'off' to never escalate.
ESCALATION_MODEL = _env("ESCALATION_MODEL", "claude-sonnet-5-5")
if ESCALATION_MODEL.lower() in ("off", "none", "0"):
    ESCALATION_MODEL = ""

# Crawler identity (honest user agent with a contact address)
CRAWLER_CONTACT = _env("CRAWLER_CONTACT")
USER_AGENT = f"LedgerBot/0.1 (+mailto:{CRAWLER_CONTACT})" if CRAWLER_CONTACT else "LedgerBot/0.1"
ROBOTS_AGENT = "LedgerBot"

# Politeness
SECONDS_BETWEEN_REQUESTS = float(os.environ.get("SECONDS_BETWEEN_REQUESTS", "2"))
REQUEST_TIMEOUT = 30

# Scope
MAX_CATEGORIES = 8          # agreed cap
TOP_PER_CATEGORY = 10       # agreed watch list size
MAX_INFO_PAGES = 12         # policy / info pages read per scan
MAX_PAGE_CHARS = 60_000     # text sent to the AI per page

SCHEMA_VERSION = "dcf-spec-v1"
SCANNER_VERSION = "ledger-scanner 0.1"
