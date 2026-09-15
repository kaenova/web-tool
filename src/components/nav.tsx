"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Server, Route, ScrollText, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backends", label: "Backends", icon: Server },
  { href: "/routing", label: "Routing", icon: Route },
  { href: "/logs", label: "Logs", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground max-sm:w-14 max-sm:items-center">
      <Link
        href="/"
        className="flex h-14 items-center gap-2 border-b px-4 font-bold tracking-tight max-sm:px-0 max-sm:justify-center"
      >
        <Globe className="h-5 w-5 text-primary" />
        <span className="max-sm:hidden">web-tool</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-3 max-sm:items-center max-sm:p-2">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.label}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors max-sm:px-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="max-sm:hidden">{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground max-sm:hidden">
        unified web engine proxy
      </div>
    </aside>
  );
}
