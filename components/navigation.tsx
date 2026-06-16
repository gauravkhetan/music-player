"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Album, Heart, Home, Library, ListMusic, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/artists", label: "Artists", icon: Mic2 },
  { href: "/albums", label: "Albums", icon: Album },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/playlists", label: "Playlists", icon: ListMusic }
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-background px-4 py-6 lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-black">
            <ListMusic className="h-5 w-5" />
          </span>
          Personal Music
        </Link>
        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted transition hover:bg-white/10 hover:text-white",
                  active && "bg-white/10 text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-[#121212]/95 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-2 backdrop-blur lg:hidden">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn("grid place-items-center gap-1 text-[11px] text-muted", active && "text-white")}>
              <item.icon className={cn("h-5 w-5", active && "text-accent")} />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
