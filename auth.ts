import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const sessionMaxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS ?? 30);
const sessionMaxAgeSeconds = Math.max(1, sessionMaxAgeDays) * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAgeSeconds,
    updateAge: 24 * 60 * 60
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    })
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) return true;
      return Boolean(session?.user?.email && allowedEmails.has(session.user.email.toLowerCase()));
    },
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      return allowedEmails.size === 0 ? false : allowedEmails.has(email);
    },
    session({ session }) {
      return session;
    }
  }
});
