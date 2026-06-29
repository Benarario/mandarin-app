import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mandarin — Personal Chinese Learning",
  description:
    "Learn Mandarin with spaced repetition, a tap-to-define reader, and verified, never-fabricated definitions.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mandarin" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* Warm the Supabase connection (CDN audio + API) before first use. */}
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />}
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}
      </head>
      <body className="flex min-h-dvh flex-col pb-16">
        {children}
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
