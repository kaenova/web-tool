import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "web-tool",
  description: "Unified web engine proxy — search & scrape with pluggable backends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} antialiased min-h-screen bg-background`}>
        <Sidebar />
        <main className="py-6 pl-56 max-sm:pl-14">
          <div className="mx-auto w-full max-w-6xl px-6 max-sm:px-3">{children}</div>
        </main>
      </body>
    </html>
  );
}
