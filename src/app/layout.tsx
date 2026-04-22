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
          palette so we don't have to style per-call. Success toasts dismiss
          at 3.5s; errors stay a little longer (5s) so the user has time to
          read a backend message before it disappears.
        */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 3500,
            classNames: {
              error: 'sonner-error',
            },
          }}
        />
      </body>
    </html>
  );
}
