import Link from "next/link";
import { CoverArt } from "@/components/ui/cover-art";

type GridItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  image_url?: string | null;
};

export function CardGrid({ items }: { items: GridItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="rounded-md bg-surface p-3 transition hover:bg-white/10">
          <CoverArt src={item.image_url} alt={item.title} className="aspect-square w-full" />
          <p className="mt-3 truncate text-sm font-bold text-white">{item.title}</p>
          {item.subtitle ? <p className="mt-1 truncate text-xs text-muted">{item.subtitle}</p> : null}
        </Link>
      ))}
    </div>
  );
}
