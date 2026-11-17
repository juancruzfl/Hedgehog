import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">🦔 Hedgehog</Link>
            <Link href="/crypto" className="text-text-2 hover:text-text">Crypto</Link>
            <Link href="/business" className="text-text-2 hover:text-text">Business</Link>
            <Link href="/positions" className="ml-auto text-text-2 hover:text-text">My hedges</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
