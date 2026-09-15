"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/backends", label: "Backends" },
  { href: "/routing", label: "Routing" },
  { href: "/logs", label: "Logs" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b">
      <div className="container max-w-6xl flex items-center gap-6 py-3">
        <Link href="/" className="font-bold tracking-tight">
          web-tool
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === l.href ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
