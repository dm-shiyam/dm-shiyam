import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { defaultMetadata } from "@/lib/seo";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import CookieConsent from "@/components/CookieConsent";
import Providers from "@/components/Providers";   // <-- ADD

// Premium typography — Inter is Linear/Resend/Vercel's default; renders
// cleanly across all weights and gives the product a "built with care"
// first impression that Tailwind's default system stack can't.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = defaultMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Google Analytics */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}} />
      </head>

      <body>
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}