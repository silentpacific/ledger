export type Industry = { slug: string; name: string; why: string };
export const INDUSTRIES: Industry[] = [
  { slug: "jewellery", name: "Jewellery", why: "Chains, demi-fine DTC brands, bridal and designer jewellers." },
  { slug: "fashion", name: "Fashion & apparel", why: "The biggest group of Australian DTC stores, with constant promotions and fast-changing returns rules." },
  { slug: "beauty", name: "Beauty & skincare", why: "Heavy use of loyalty programmes, gifts with purchase and subscriptions." },
  { slug: "health", name: "Health & personal care", why: "Pharmacies, supplements and oral care; subscriptions and bundles." },
  { slug: "homewares", name: "Homewares & furniture", why: "High order values: delivery fees, BNPL limits and long returns windows matter most." },
  { slug: "pet", name: "Pet care", why: "Repeat purchases, autoship discounts and same-day delivery competition." },
  { slug: "baby-kids", name: "Baby & kids", why: "Price-sensitive shoppers, frequent sales and safety-related policy wording." },
  { slug: "sports-outdoors", name: "Sports & outdoors", why: "Seasonal sales, click and collect, and many Shopify brands." },
  { slug: "electronics", name: "Consumer electronics", why: "Price matching, extended warranties and finance offers." },
];
export const industryName = (slug?: string | null) => INDUSTRIES.find((i) => i.slug === slug)?.name ?? "Other";
