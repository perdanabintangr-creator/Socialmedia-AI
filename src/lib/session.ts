import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./auth";
import { db } from "./db";
import type { PublicUser, User } from "./types";

export function publicUser(u: User): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, created_at: u.created_at, last_login_at: u.last_login_at };
}

/** Pengguna yang sedang login (aktif), atau null. */
export async function currentUser(): Promise<PublicUser | null> {
  const uid = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const user = await db().getUserById(uid);
  return user && user.status === "active" ? publicUser(user) : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 3600,
    path: "/",
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
