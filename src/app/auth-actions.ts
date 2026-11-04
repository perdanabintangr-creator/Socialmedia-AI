"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { endSession, requireAdmin, startSession } from "@/lib/session";
import type { ActionState } from "./actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hambat tebak-tebak password: maks 8 percobaan gagal per email per 15 menit (per instance server).
const g = globalThis as unknown as { __loginFails?: Map<string, { n: number; until: number }> };
const fails = (g.__loginFails ??= new Map());

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Isi email dan password" };

  const f = fails.get(email);
  if (f && f.n >= 8 && f.until > Date.now()) return { error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };

  let user: Awaited<ReturnType<ReturnType<typeof db>["getUserByEmail"]>>;
  try {
    user = await db().getUserByEmail(email);
  } catch (e) {
    console.error("Login: database error", e);
    return { error: "Server belum tersambung ke database. Hubungi admin (cek SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) {
    fails.set(email, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return { error: "Email atau password salah" };
  }
  fails.delete(email);
  if (user.status === "pending") return { error: "Akun kamu sedang menunggu persetujuan admin." };
  if (user.status === "disabled") return { error: "Akun ini dinonaktifkan. Hubungi admin." };

  await db().updateUser(user.id, { last_login_at: new Date().toISOString() });
  await startSession(user.id);
  redirect("/");
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (name.length < 2) return { error: "Nama minimal 2 huruf" };
  if (!EMAIL.test(email)) return { error: "Format email tidak valid" };
  if (password.length < 8) return { error: "Password minimal 8 karakter" };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama" };
  try {
    if (await db().getUserByEmail(email)) return { error: "Email sudah terdaftar. Silakan masuk." };
  } catch (e) {
    console.error("Daftar: database error", e);
    return { error: "Server belum tersambung ke database. Coba lagi nanti." };
  }

  // Pengguna pertama otomatis jadi admin aktif; berikutnya menunggu persetujuan admin.
  const first = (await db().countUsers()) === 0;
  try {
    const user = await db().createUser({
      name,
      email,
      password_hash: await hashPassword(password),
      role: first ? "admin" : "member",
      status: first ? "active" : "pending",
    });
    if (first) {
      await startSession(user.id);
      redirect("/");
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect
    return { error: e instanceof Error ? e.message : "Gagal mendaftar" };
  }
  return { ok: "Pendaftaran berhasil! Akunmu akan aktif setelah disetujui admin." };
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

// ------------------------------------------------------------------ kelola pengguna (admin)

async function guardOther(targetId: string) {
  const me = await requireAdmin();
  if (me.id === targetId) throw new Error("Tidak bisa mengubah akun sendiri dari sini");
  const target = await db().getUserById(targetId);
  if (!target) throw new Error("Pengguna tidak ditemukan");
  return target;
}

export async function setUserStatusAction(id: string, status: "active" | "disabled"): Promise<ActionState> {
  try {
    await guardOther(id);
    await db().updateUser(id, { status });
    revalidatePath("/pengguna");
    return { ok: status === "active" ? "Akun diaktifkan" : "Akun dinonaktifkan" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function setUserRoleAction(id: string, role: "admin" | "member"): Promise<ActionState> {
  try {
    await guardOther(id);
    await db().updateUser(id, { role });
    revalidatePath("/pengguna");
    return { ok: "Peran diubah" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function deleteUserAction(id: string): Promise<ActionState> {
  try {
    await guardOther(id);
    await db().deleteUser(id);
    revalidatePath("/pengguna");
    return { ok: "Akun dihapus" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { currentUser } = await import("@/lib/session");
  const me = await currentUser();
  if (!me) return { error: "Silakan masuk lagi" };
  const user = await db().getUserById(me.id);
  if (!user || !(await verifyPassword(String(fd.get("current") ?? ""), user.password_hash))) return { error: "Password lama salah" };
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "Password baru minimal 8 karakter" };
  await db().updateUser(me.id, { password_hash: await hashPassword(next) });
  return { ok: "Password berhasil diganti" };
}
