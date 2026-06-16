import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-black">Not found</h1>
        <p className="mt-2 text-muted">That music page is not in this library.</p>
        <Button asChild className="mt-6" variant="primary"><Link href="/">Go home</Link></Button>
      </div>
    </main>
  );
}
