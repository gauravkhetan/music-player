import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { AlertCircle, ListMusic } from "lucide-react";

const authErrorMessages: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Access denied",
    description: "This Google account is not allowed to access this private music library. Please sign in with an approved account."
  },
  OAuthAccountNotLinked: {
    title: "Could not sign you in",
    description: "This email is already linked to another sign-in method. Try the account you used before."
  },
  default: {
    title: "Sign-in failed",
    description: "Something went wrong while signing you in. Please try again."
  }
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.email) redirect("/");
  const params = await searchParams;
  const errorCode = params?.error;
  const authError = errorCode ? authErrorMessages[errorCode] ?? authErrorMessages.default : null;

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
        {authError ? (
          <div className="mb-5 flex gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <div>
              <p className="font-bold text-red-50">{authError.title}</p>
              <p className="mt-1 leading-5 text-red-100/85">{authError.description}</p>
            </div>
          </div>
        ) : null}
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
