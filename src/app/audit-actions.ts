"use server";

import { revalidatePath } from "next/cache";
import { workspaceOrThrow } from "@/lib/session";
import { metered } from "@/lib/cost";
import { uploadReferences } from "@/lib/reference";
import { applyAudit, auditAccount, parseProfile } from "@/lib/audit";
import { proposeIdeas } from "@/lib/month";

export type AuditResult = { ok: boolean; message: string };
const fail = (e: unknown): AuditResult => ({ ok: false, message: e instanceof Error ? e.message : "Terjadi kesalahan" });

/** Jalankan audit akun (link profil + screenshot). */
export async function runAuditAction(fd: FormData): Promise<AuditResult> {
  try {
    const { w } = await workspaceOrThrow();
    const links = String(fd.get("links") ?? "")
      .split(/[\s,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2);
    const bad = links.filter((l) => !parseProfile(l));
    if (bad.length) return { ok: false, message: `Link profil tidak dikenali: ${bad[0]}. Pakai link profil, mis. instagram.com/namaakun atau tiktok.com/@namaakun` };
    const files = fd.getAll("shots").filter((f): f is File => f instanceof File && f.size > 0);
    if (!links.length && !files.length) return { ok: false, message: "Masukkan link profil atau upload screenshot profil dulu" };
    const screenshots = files.length ? await uploadReferences(w, files) : [];
    const audit = await metered(w, "audit", () => auditAccount(w, { links, screenshots, goal: String(fd.get("goal") ?? "").trim().slice(0, 300) }));
    const brand = await w.getBrand();
    // Akun baru (Brand Kit masih kosong): rekomendasi langsung diterapkan supaya siap dipakai.
    const fresh = !brand.description.trim() && !brand.audit;
    await w.saveBrand(fresh ? applyAudit(brand, audit) : { ...brand, audit });
    revalidatePath("/", "layout");
    return { ok: true, message: fresh ? "Audit selesai — Brand Kit sudah terisi dari hasil audit" : "Audit selesai" };
  } catch (e) {
    return fail(e);
  }
}

/** Terapkan rekomendasi audit ke Brand Kit (gaya bahasa, pilar, art direction, arah visual) + wawasan AI. */
export async function applyAuditAction(): Promise<AuditResult> {
  try {
    const { w } = await workspaceOrThrow();
    const brand = await w.getBrand();
    if (!brand.audit) return { ok: false, message: "Belum ada hasil audit" };
    await w.saveBrand(applyAudit(brand, brand.audit));
    revalidatePath("/", "layout");
    return { ok: true, message: "Rekomendasi diterapkan. Mulai sekarang tim AI membuat konten mengikuti hasil audit ini." };
  } catch (e) {
    return fail(e);
  }
}

/** Jadikan ide dari audit sebagai rencana konten di Mode ACC. */
export async function planFromAuditAction(): Promise<AuditResult> {
  try {
    const { w } = await workspaceOrThrow();
    const brand = await w.getBrand();
    if (!brand.audit?.ideas.length) return { ok: false, message: "Belum ada ide dari audit" };
    const res = await proposeIdeas(w, brand.audit.ideas);
    revalidatePath("/", "layout");
    return { ok: true, message: `${res.count} ide masuk Mode ACC lengkap dengan jadwalnya. ACC yang kamu suka — sisanya otomatis.` };
  } catch (e) {
    return fail(e);
  }
}
