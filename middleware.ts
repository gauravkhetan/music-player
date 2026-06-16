export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/", "/library/:path*", "/artists/:path*", "/albums/:path*", "/playlists/:path*", "/favorites/:path*"]
};
