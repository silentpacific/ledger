// The site's public address: canonical links, sitemap, structured data. Previews use their own address.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_ENV === "production" ? "https://au.sentientlogs.com"
    : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
