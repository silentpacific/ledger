/** @type {import('next').NextConfig} */
// The site lives at au.sentientlogs.com (bought 27 Nov 2026). sentientlogs.com and www. redirect there temporarily
// (307, set on the Vercel project domains; Rahul will change that later). The old vercel.app addresses move permanently.
const OLD_HOSTS = ["ledger-au.vercel.app", "ledger-web-rose.vercel.app"];
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return OLD_HOSTS.map((host) => ({
      source: "/:path*", has: [{ type: "host", value: host }], destination: "https://au.sentientlogs.com/:path*", permanent: true,
    }));
  },
};
export default nextConfig;
