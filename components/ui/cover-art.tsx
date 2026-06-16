import Image from "next/image";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CoverArtProps = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function CoverArt({ src, alt, className, priority }: CoverArtProps) {
  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-white/10", className)}>
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes="(max-width: 768px) 30vw, 180px" className="object-cover" />
      ) : (
        <Music2 className="h-1/3 w-1/3 text-muted" aria-hidden />
      )}
    </div>
  );
}
