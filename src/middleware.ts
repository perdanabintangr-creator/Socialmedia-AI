import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, hasSessionSecret, verifySession } from "./lib/auth";

const PUBLIC = ["/login", "/daftar", "/lupa-password", "/api/media/", "/api/auth/", "/api/cron/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/" || PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!hasSessionSecret()) {
    return new NextResponse("SESSION_SECRET belum di-set. Aplikasi dikunci.", { status: 503 });
  }
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) {
    // Teruskan path ke layout, supaya layout bisa menolak akun yang sudah dinonaktifkan/dihapus.
    const headers = new Headers(req.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // File statis publik (gambar landing, font, ikon) tidak perlu login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|showcase/|.*\\.(?:png|jpe?g|webp|svg|ico|woff2?)$).*)"],
};
