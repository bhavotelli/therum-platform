import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  weight: ["700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Therum | Financial OS for Talent Agencies",
  description: "The professional financial operating system for UK talent and influencer management agencies.",
};

import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Providers } from "@/components/providers";
import SuperAdminToolbar from "@/components/layout/SuperAdminToolbar";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SuperAdminToolbar />
        <Providers>{children}</Providers>
        {/*
          Global toast provider. `richColors` gives each severity a built-in
          palette (success=green, error=red, info=blue) so we don't need to
          style per-call. 3.5s default duration is long enough to read a
          short message and short enough that rapid actions don't pile up;
          `closeButton` is the escape hatch for users who want it gone sooner.

          Must render as a direct child of <body/> so nothing wraps it in a
          stacking context that could trap toasts beneath sibling overlays.
          Z-index is pinned in globals.css (see the z-index scale comment).
        */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 3500 }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
