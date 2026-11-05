"use server";

import { PLAN_KEYS, type PlanKey } from "@/lib/types";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { accounts, db } from "@/lib/db";
import { DEFAULT_BRAND } from "@/lib/types";
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

  let user: Awaited<ReturnType<ReturnType<typeof accounts>["getUserByEmail"]>>;
  try {
    user = await accounts().getUserByEmail(email);
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

  await accounts().updateUser(user.id, { last_login_at: new Date().toISOString() });
  await startSession(user.id);
  redirect("/beranda");
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const brandName = str(fd, "brand").slice(0, 80);
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (name.length < 2) return { error: "Nama minimal 2 huruf" };
  if (brandName.length < 2) return { error: "Isi nama brand / bisnis kamu" };
  if (!EMAIL.test(email)) return { error: "Format email tidak valid" };
  if (password.length < 8) return { error: "Password minimal 8 karakter" };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama" };
  try {
    if (await accounts().getUserByEmail(email)) return { error: "Email sudah terdaftar. Silakan masuk." };
  } catch (e) {
    console.error("Daftar: database error", e);
    return { error: "Server belum tersambung ke database. Coba lagi nanti." };
  }

  // Pendaftar pertama = owner aplikasi (admin). Semua pendaftar langsung aktif.
  const first = (await accounts().countUsers()) === 0;
  try {
    // Setiap klien mendapat workspace sendiri: brand kit, chat, ide, konten, dan file terpisah.
    const ws = await accounts().createWorkspace(brandName);
    const user = await accounts().createUser({
      name,
      email,
      password_hash: await hashPassword(password),
      role: first ? "admin" : "member",
      status: "active",
      workspace_id: ws.id,
    });
    await accounts().setWorkspaceOwner(ws.id, user.id);
    await db(ws.id).saveBrand({ ...DEFAULT_BRAND, name: brandName, handle: "" });
    await startSession(user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mendaftar" };
  }
  redirect("/beranda");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

// ------------------------------------------------------------------ kelola pengguna (admin)

async function guardOther(targetId: string) {
  const me = await requireAdmin();
  if (me.id === targetId) throw new Error("Tidak bisa mengubah akun sendiri dari sini");
  const target = await accounts().getUserById(targetId);
  if (!target) throw new Error("Pengguna tidak ditemukan");
  return target;
}

export async function setUserStatusAction(id: string, status: "active" | "disabled"): Promise<ActionState> {
  try {
    await guardOther(id);
    await accounts().updateUser(id, { status });
    revalidatePath("/pengguna");
    return { ok: status === "active" ? "Akun diaktifkan" : "Akun dinonaktifkan" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function setUserRoleAction(id: string, role: "admin" | "member"): Promise<ActionState> {
  try {
    await guardOther(id);
    await accounts().updateUser(id, { role });
    revalidatePath("/pengguna");
    return { ok: "Peran diubah" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function deleteUserAction(id: string): Promise<ActionState> {
  try {
    const target = await guardOther(id);
    await accounts().deleteUser(id);
    // Workspace milik klien ikut dihapus beserta seluruh isinya.
    if (target.workspace_id) await accounts().deleteWorkspace(target.workspace_id);
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
  const user = await accounts().getUserById(me.id);
  if (!user || !(await verifyPassword(String(fd.get("current") ?? ""), user.password_hash))) return { error: "Password lama salah" };
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "Password baru minimal 8 karakter" };
  await accounts().updateUser(me.id, { password_hash: await hashPassword(next) });
  return { ok: "Password berhasil diganti" };
}

/** Owner aplikasi menghubungkan akun sosmed klien (Ayrshare User Profile Key) ke workspace-nya. */
export async function setPublishKeyAction(workspaceId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const key = str(fd, "publishKey");
    if (key && !/^[A-Za-z0-9-]{8,100}$/.test(key)) return { error: "Format Profile Key tidak valid" };
    await accounts().setWorkspacePublishKey(workspaceId, key || null);
    revalidatePath("/pengguna");
    return { ok: key ? "Akun sosmed klien terhubung" : "Koneksi sosmed dilepas" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Admin: ubah paket langganan workspace klien. */
export async function setWorkspacePlanAction(workspaceId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const plan = str(fd, "plan") as PlanKey;
    if (!(PLAN_KEYS as readonly string[]).includes(plan)) return { error: "Paket tidak dikenal" };
    await accounts().setWorkspacePlan(workspaceId, plan);
    revalidatePath("/pengguna");
    return { ok: "Paket diperbarui" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal" };
  }
}
