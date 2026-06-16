import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MusicPlayer } from "@/components/player/music-player";
import { Navigation } from "@/components/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="px-4 pb-48 pt-6 sm:px-6 lg:ml-60 lg:px-8 lg:pb-28">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <MusicPlayer />
    </div>
  );
}
