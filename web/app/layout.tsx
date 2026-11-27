import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import { BRAND } from "@/lib/brand";


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND} – how Australian online stores sell, tracked over time`, template: `%s | ${BRAND}` },
  description: "Dated, sourced facts on Australian ecommerce: returns, shipping, buy now pay later, loyalty, promotions, prices and tech, with every change recorded.",
  openGraph: { siteName: `${BRAND}`, locale: "en_AU", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" />
      </head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
