"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, Dumbbell, Ellipsis, ListChecks, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Today", icon: Dumbbell },
  { href: "/program", label: "Program", icon: ListChecks },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { href: "/body", label: "Body", icon: Scale },
  { href: "/more", label: "More", icon: Ellipsis },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/workout")) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-border bg-background/95 backdrop-blur"
    >
      <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative flex h-7 w-12 items-center justify-center">
                  {active ? (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-primary/15"
                      transition={{ type: "spring", stiffness: 520, damping: 36 }}
                    />
                  ) : null}
                  <Icon className="relative size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
