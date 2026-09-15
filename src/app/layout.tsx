import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "web-tool",
  description: "Unified web engine proxy — search & scrape with pluggable backends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} antialiased min-h-screen bg-background`}>
        <Nav />
        <main className="container max-w-6xl py-6">{children}</main>
      </body>
    </html>
  );
}
