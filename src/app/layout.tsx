import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { Toaster } from "sonner";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "DM Shiyam — Instagram Comment-to-DM Bot",
  description:
    "Automatically send DMs when users comment specific keywords on your Instagram posts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <CookieConsent />
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
