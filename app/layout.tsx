import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { StorageNotice } from "@/components/StorageNotice";
import { STORAGE_KEYS } from "@/lib/legal";
import { Nav } from "./Nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hedgehog",
  description: "Risk reduction powered by prediction markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint: skip the nav animation if it already played this visit (NavMascot). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("${STORAGE_KEYS.introSeen}"))document.documentElement.classList.add("hh-intro-seen")}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <Nav />
        {children}
        <SiteFooter />
        <StorageNotice />
      </body>
    </html>
  );
}
