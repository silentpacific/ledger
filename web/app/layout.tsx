import type { Metadata } from "next";
import Script from "next/script";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { siteSchema } from "@/lib/schema";


// Analytics (Rahul, 27 Nov 2026): Google Tag Manager, GA4 and Microsoft Clarity, production only.
const GTM_ID = "GTM-W7QFJH7G", GA4_ID = "G-GKKZBSND4H", CLARITY_ID = "zk7kvropmo";
const LIVE = process.env.VERCEL_ENV === "production";

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
        {LIVE && <>
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
          <Script id="gtm" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
gtag('js',new Date());gtag('config','${GA4_ID}');`}</Script>
          <Script id="gtm-js" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
          <Script id="ga4-js" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} />
          <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script","${CLARITY_ID}");`}</Script>
        </>}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema()).replace(/</g, "\\u003c") }} />
        {children}
        <Footer />
      </body>
    </html>
  );
}
