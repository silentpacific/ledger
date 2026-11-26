// Technology categories, mirroring TECH_RULES in ledger_scanner/detect.py (keep the two in step).
export const TECH_CATEGORY: Record<string, string> = {
  "Shopify": "Ecommerce platforms", "WooCommerce": "Ecommerce platforms", "Magento": "Ecommerce platforms",
  "BigCommerce": "Ecommerce platforms", "Salesforce Commerce Cloud": "Ecommerce platforms", "WordPress": "Content management",
  "Google Tag Manager": "Tag management", "Google Analytics 4": "Analytics",
  "Meta Pixel": "Advertising pixels", "TikTok Pixel": "Advertising pixels", "Pinterest Tag": "Advertising pixels",
  "Google Ads": "Advertising pixels", "Microsoft Ads": "Advertising pixels",
  "Optimizely": "Experimentation", "VWO": "Experimentation", "AB Tasty": "Experimentation", "Convert": "Experimentation",
  "Hotjar": "Session recording", "Microsoft Clarity": "Session recording",
  "Klaviyo": "Email & SMS", "Mailchimp": "Email & SMS", "Omnisend": "Email & SMS",
  "Yotpo": "Reviews", "Okendo": "Reviews", "Judge.me": "Reviews", "Trustpilot widget": "Reviews", "Reviews.io": "Reviews",
  "Feefo": "Reviews", "Bazaarvoice": "Reviews",
  "Boost Product Filter & Search": "Search", "Algolia": "Search", "Klevu": "Search", "Searchspring": "Search",
  "Nosto": "Recommendations", "Rebuy": "Recommendations",
  "Gorgias": "Chat & support", "Zendesk": "Chat & support", "Intercom": "Chat & support", "Tidio": "Chat & support", "LiveChat": "Chat & support",
  "Smile.io": "Loyalty", "LoyaltyLion": "Loyalty", "Recharge": "Subscriptions", "Loop Returns": "Returns", "AfterShip": "Shipping & tracking",
  "OneTrust": "Cookie consent", "Cookiebot": "Cookie consent", "Commission Factory": "Affiliate", "Cloudflare": "CDN & security",
};
/** Order of sections on the Tech page: commerce tools first, plumbing last. */
export const TECH_ORDER = [
  "Ecommerce platforms", "Email & SMS", "Reviews", "Loyalty", "Subscriptions", "Search", "Recommendations", "Chat & support",
  "Returns", "Shipping & tracking", "Experimentation", "Session recording", "Advertising pixels", "Affiliate", "Analytics",
  "Tag management", "Content management", "Cookie consent", "CDN & security", "Other",
];
/** Plumbing that nearly every site has: left out of "most-used tool" stats. */
export const PLUMBING = new Set(["Ecommerce platforms", "Content management", "Tag management", "Analytics", "CDN & security", "Cookie consent"]);
export const techCategory = (name: string) => TECH_CATEGORY[name] || "Other";
