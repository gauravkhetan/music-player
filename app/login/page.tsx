import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { ListMusic } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-accent text-black">
            <ListMusic className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black text-white">Personal Music</h1>
            <p className="text-sm text-muted">Private streaming library</p>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button className="w-full" variant="primary" type="submit">
            Continue with Google
          </Button>
        </form>
      </section>
    </main>
  );
}
