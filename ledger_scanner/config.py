"""Settings, read from environment variables (GitHub Actions secrets)."""
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")

# AI model used for reading policy/promo text. Override with the CLAUDE_MODEL secret or variable.
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")

# Crawler identity (honest user agent with a contact address)
CRAWLER_CONTACT = os.environ.get("CRAWLER_CONTACT", "contact@example.com")
USER_AGENT = f"LedgerBot/0.1 (+mailto:{CRAWLER_CONTACT})"
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
