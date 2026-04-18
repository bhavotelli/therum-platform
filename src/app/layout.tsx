import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Therum | Financial OS for Talent Agencies",
  description: "The professional financial operating system for UK talent and influencer management agencies.",
};

import { Providers } from "@/components/providers";
import { TimeThemeScript } from "@/components/TimeThemeScript";
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
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <TimeThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SuperAdminToolbar />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
