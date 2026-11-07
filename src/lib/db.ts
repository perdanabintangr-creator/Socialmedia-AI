import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { DEFAULT_BRAND, type Brand, type Chat, type ChatMessage, type Idea, type Job, type Post, type PlanKey, type SocialAccount, type TrackedLink, type UsageLog, type User, type Workspace } from "./types";

/**
 * Lapisan data. Dua mode:
 * - Supabase (produksi): aktif bila SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di-set.
 * - Lokal (.data/): untuk coba-coba tanpa cloud. Gambar disajikan lewat /api/media.
 *
 * Multi-tenant: semua data konten (brand, ide, konten, chat, job, file) milik satu workspace.
 * `db(workspaceId)` mengembalikan repo yang SELALU memfilter per workspace — termasuk saat
 * mengambil/mengubah berdasarkan id — jadi satu klien tidak bisa menyentuh data klien lain.
 * `accounts()` untuk data lintas workspace: pengguna & workspace.
 */

export type NewIdea = Omit<Idea, "id" | "workspace_id" | "created_at" | "status" | "feedback" | "post_id" | "reference"> & { reference?: Idea["reference"] };
export type NewPost = Omit<
  Post,
  | "id"
  | "workspace_id"
  | "created_at"
  | "updated_at"
  | "media_urls"
  | "publish_ref"
  | "publish_result"
  | "error"
  | "revision_count"
  | "scheduled_at"
  | "reference"
  | "story"
> & { reference?: Post["reference"]; story?: Post["story"] };
export type NewMessage = Omit<ChatMessage, "id" | "workspace_id" | "created_at" | "chat_id" | "attachments"> & { chat_id?: string | null; attachments?: string[] };
export type NewLink = Pick<TrackedLink, "platform" | "kind" | "url" | "handle"> & { post_id?: string | null };
export type NewUsage = Omit<UsageLog, "id" | "workspace_id" | "created_at">;
export type NewUser = Pick<User, "name" | "email" | "password_hash" | "role" | "status" | "workspace_id">;

export interface WorkspaceRepo {
  readonly id: string;
  getBrand(): Promise<Brand>;
  saveBrand(brand: Brand): Promise<void>;
  listIdeas(): Promise<Idea[]>;
  getIdea(id: string): Promise<Idea | null>;
  createIdeas(ideas: NewIdea[]): Promise<Idea[]>;
  updateIdea(id: string, patch: Partial<Idea>): Promise<void>;
  listPosts(): Promise<Post[]>; // tanpa konten yang dihapus
  /** Jumlah konten dibuat (termasuk yang dihapus) sejak tanggal tertentu — untuk kuota. */
  countPostsCreated(since?: string): Promise<number>;
  /** Hapus lunak: konten hilang dari aplikasi, tetap terhitung di kuota. */
  deletePosts(ids: string[]): Promise<void>;
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost): Promise<Post>;
  updatePost(id: string, patch: Partial<Post>): Promise<void>;
  /** key relatif; otomatis disimpan di bawah folder workspace. */
  uploadFile(key: string, data: Buffer, contentType: string): Promise<string>;
  /** urut lama → baru; dengan chatId hanya pesan di percakapan itu */
  listMessages(limit: number, chatId?: string): Promise<ChatMessage[]>;
  addMessage(m: NewMessage): Promise<ChatMessage>;
  listChats(limit: number): Promise<Chat[]>; // terbaru dulu
  getChat(id: string): Promise<Chat | null>;
  createChat(title: string): Promise<Chat>;
  updateChat(id: string, patch: Partial<Pick<Chat, "title">>): Promise<void>;
  deleteChat(id: string): Promise<void>;
  getActiveJob(): Promise<Job | null>;
  createJob(j: Pick<Job, "agent" | "label">): Promise<Job>;
  updateJob(id: string, patch: Partial<Job>): Promise<void>;
  listLinks(): Promise<TrackedLink[]>; // terbaru dulu
  getLink(id: string): Promise<TrackedLink | null>;
  createLink(l: NewLink): Promise<TrackedLink>;
  updateLink(id: string, patch: Partial<TrackedLink>): Promise<void>;
  deleteLink(id: string): Promise<void>;
  addUsage(u: NewUsage): Promise<void>;
  listUsage(since: string, limit?: number): Promise<UsageLog[]>; // terbaru dulu
  getSocial(platform: SocialAccount["platform"]): Promise<SocialAccount | null>;
  saveSocial(a: Omit<SocialAccount, "workspace_id" | "updated_at">): Promise<void>;
  deleteSocial(platform: SocialAccount["platform"]): Promise<void>;
}

export interface AccountRepo {
  countUsers(): Promise<number>;
  listUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(u: NewUser): Promise<User>;
  updateUser(id: string, patch: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<void>;
  createWorkspace(name: string): Promise<Workspace>;
  setWorkspaceOwner(id: string, ownerId: string): Promise<void>;
  getWorkspace(id: string): Promise<Workspace | null>;
  setWorkspacePublishKey(id: string, key: string | null): Promise<void>;
  setWorkspacePlan(id: string, plan: PlanKey): Promise<void>;
  listWorkspaces(): Promise<Workspace[]>;
  deleteWorkspace(id: string): Promise<void>;
  /** Link yang terakhir dicek sebelum `before` (untuk pembaruan terjadwal), lintas workspace. */
  listStaleLinks(before: string, limit: number): Promise<TrackedLink[]>;
  /** Log biaya semua workspace sejak tanggal tertentu (untuk admin). */
  listUsageAll(since: string, limit?: number): Promise<UsageLog[]>;
  /** Konten terjadwal yang sudah jatuh tempo, lintas workspace (untuk penjadwal posting). */
  listDuePosts(now: string, limit: number): Promise<Post[]>;
  /** Akun sosmed yang token-nya perlu diperpanjang sebelum `before`. */
  listExpiringSocial(before: string, limit: number): Promise<SocialAccount[]>;
  /** Kunci konten jatuh tempo supaya tidak diposting dua kali (true = berhasil dikunci). */
  claimDuePost(id: string, ref: string): Promise<boolean>;
  /** Kunci cron posting yang dibuat & disimpan di Supabase Vault (null bila tidak ada). */
  publishCronKey(): Promise<string | null>;
}

const JOB_STALE_MS = 6 * 60_000; // job lebih lama dari ini dianggap macet
const BUCKET = "media";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIP = ["id", "workspace_id", "created_at"] as const;

/** Buang field yang tidak boleh diubah lewat patch (id, workspace) pada data konten. */
function safePatch<T extends object>(patch: T): T {
  const out = { ...patch } as Record<string, unknown>;
  for (const k of STRIP) delete out[k];
  return out as T;
}

/** Untuk akun: id & tanggal dibuat tidak boleh diubah, tapi workspace_id boleh (ditautkan ke workspace). */
function userPatch<T extends object>(patch: T): T {
  const out = { ...patch } as Record<string, unknown>;
  delete out.id;
  delete out.created_at;
  return out as T;
}

export function mergeBrand(data: Partial<Brand> | null | undefined): Brand {
  return {
    ...DEFAULT_BRAND,
    ...(data ?? {}),
    colors: { ...DEFAULT_BRAND.colors, ...(data?.colors ?? {}) },
  };
}

/**
 * updated_at dipakai sebagai versi gambar (cache render). Perubahan yang tidak mengubah
 * tampilan desain (status Story) tidak menaikkan versinya.
 */
const touch = (patch: Partial<Post>) => (Object.keys(patch).every((k) => k === "story") ? {} : { updated_at: new Date().toISOString() });

/** Kolom numeric dari Postgres datang sebagai string. */
const numUsage = (u: UsageLog): UsageLog => ({ ...u, ai_usd: Number(u.ai_usd), image_usd: Number(u.image_usd) });

const wsKey = (ws: string, key: string) => `ws/${ws}/${key.replace(/\.\./g, "").replace(/^\/+/, "")}`;

// ---------------------------------------------------------------- Supabase

let sbClient: SupabaseClient | null = null;
function sb() {
  if (!sbClient) {
    // trim: kunci yang ditempel di dashboard sering ikut spasi / baris baru.
    sbClient = createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
      auth: { persistSession: false },
    });
  }
  return sbClient;
}
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Database: ${res.error.message}`);
  return res.data;
}

class SupabaseWorkspace implements WorkspaceRepo {
  constructor(readonly id: string) {}
  async getBrand() {
    const row = check(await sb().from("brand").select("data").eq("workspace_id", this.id).maybeSingle()) as { data: Partial<Brand> } | null;
    return mergeBrand(row?.data);
  }
  async saveBrand(brand: Brand) {
    check(await sb().from("brand").upsert({ workspace_id: this.id, data: brand, updated_at: new Date().toISOString() }));
  }
  async listIdeas() {
    return check(
      await sb().from("ideas").select("*").eq("workspace_id", this.id).order("created_at", { ascending: false }).limit(200),
    ) as Idea[];
  }
  async getIdea(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("ideas").select("*").eq("workspace_id", this.id).eq("id", id).maybeSingle()) as Idea | null;
  }
  async createIdeas(ideas: NewIdea[]) {
    if (!ideas.length) return [];
    return check(await sb().from("ideas").insert(ideas.map((i) => ({ ...i, workspace_id: this.id }))).select("*")) as Idea[];
  }
  async updateIdea(id: string, patch: Partial<Idea>) {
    check(await sb().from("ideas").update(safePatch(patch)).eq("workspace_id", this.id).eq("id", id));
  }
  async listPosts() {
    return check(
      await sb().from("posts").select("*").eq("workspace_id", this.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    ) as Post[];
  }
  async countPostsCreated(since?: string) {
    let q = sb().from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", this.id);
    if (since) q = q.gte("created_at", since);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  async deletePosts(ids: string[]) {
    const valid = ids.filter((id) => UUID.test(id));
    if (!valid.length) return;
    check(await sb().from("posts").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", this.id).in("id", valid));
  }
  async getPost(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("posts").select("*").eq("workspace_id", this.id).eq("id", id).is("deleted_at", null).maybeSingle()) as Post | null;
  }
  async createPost(post: NewPost) {
    return check(await sb().from("posts").insert({ ...post, workspace_id: this.id }).select("*").single()) as Post;
  }
  async updatePost(id: string, patch: Partial<Post>) {
    check(
      await sb()
        .from("posts")
        .update({ ...safePatch(patch), ...touch(patch) })
        .eq("workspace_id", this.id)
        .eq("id", id),
    );
  }
  async uploadFile(key: string, data: Buffer, contentType: string) {
    const full = wsKey(this.id, key);
    const { error } = await sb().storage.from(BUCKET).upload(full, data, { contentType, upsert: true });
    if (error) throw new Error(`Storage: ${error.message}`);
    return sb().storage.from(BUCKET).getPublicUrl(full).data.publicUrl;
  }
  async listMessages(limit: number, chatId?: string) {
    let q = sb().from("messages").select("*").eq("workspace_id", this.id);
    if (chatId) q = q.eq("chat_id", chatId);
    const rows = check(await q.order("created_at", { ascending: false }).limit(limit)) as ChatMessage[];
    return rows.reverse().map((m) => ({ ...m, attachments: m.attachments ?? [] }));
  }
  async addMessage(m: NewMessage) {
    const msg = check(await sb().from("messages").insert({ ...m, workspace_id: this.id }).select("*").single()) as ChatMessage;
    if (m.chat_id) await sb().from("chats").update({ updated_at: new Date().toISOString() }).eq("workspace_id", this.id).eq("id", m.chat_id);
    return msg;
  }
  async listChats(limit: number) {
    return check(
      await sb().from("chats").select("*").eq("workspace_id", this.id).order("updated_at", { ascending: false }).limit(limit),
    ) as Chat[];
  }
  async getChat(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("chats").select("*").eq("workspace_id", this.id).eq("id", id).maybeSingle()) as Chat | null;
  }
  async createChat(title: string) {
    return check(await sb().from("chats").insert({ title, workspace_id: this.id }).select("*").single()) as Chat;
  }
  async updateChat(id: string, patch: Partial<Pick<Chat, "title">>) {
    check(await sb().from("chats").update(patch).eq("workspace_id", this.id).eq("id", id));
  }
  async deleteChat(id: string) {
    check(await sb().from("chats").delete().eq("workspace_id", this.id).eq("id", id));
  }
  async getActiveJob() {
    const job = check(
      await sb()
        .from("jobs")
        .select("*")
        .eq("workspace_id", this.id)
        .eq("status", "running")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as Job | null;
    if (job && Date.now() - new Date(job.updated_at).getTime() > JOB_STALE_MS) {
      await this.updateJob(job.id, { status: "error" });
      return null;
    }
    return job;
  }
  async createJob(j: Pick<Job, "agent" | "label">) {
    return check(await sb().from("jobs").insert({ ...j, workspace_id: this.id, status: "running" }).select("*").single()) as Job;
  }
  async updateJob(id: string, patch: Partial<Job>) {
    check(
      await sb()
        .from("jobs")
        .update({ ...safePatch(patch), updated_at: new Date().toISOString() })
        .eq("workspace_id", this.id)
        .eq("id", id),
    );
  }
  async listLinks() {
    return check(
      await sb().from("tracked_links").select("*").eq("workspace_id", this.id).order("created_at", { ascending: false }).limit(100),
    ) as TrackedLink[];
  }
  async getLink(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("tracked_links").select("*").eq("workspace_id", this.id).eq("id", id).maybeSingle()) as TrackedLink | null;
  }
  async createLink(l: NewLink) {
    const res = await sb().from("tracked_links").insert({ ...l, workspace_id: this.id }).select("*").single();
    if (res.error?.code === "23505") throw new Error("Link ini sudah dipantau");
    return check(res) as TrackedLink;
  }
  async updateLink(id: string, patch: Partial<TrackedLink>) {
    check(await sb().from("tracked_links").update(safePatch(patch)).eq("workspace_id", this.id).eq("id", id));
  }
  async deleteLink(id: string) {
    check(await sb().from("tracked_links").delete().eq("workspace_id", this.id).eq("id", id));
  }
  async addUsage(u: NewUsage) {
    check(await sb().from("usage_logs").insert({ ...u, workspace_id: this.id }));
  }
  async listUsage(since: string, limit = 500) {
    const rows = check(
      await sb().from("usage_logs").select("*").eq("workspace_id", this.id).gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    ) as UsageLog[];
    return rows.map(numUsage);
  }
  async getSocial(platform: SocialAccount["platform"]) {
    return check(await sb().from("social_accounts").select("*").eq("workspace_id", this.id).eq("platform", platform).maybeSingle()) as SocialAccount | null;
  }
  async saveSocial(a: Omit<SocialAccount, "workspace_id" | "updated_at">) {
    check(await sb().from("social_accounts").upsert({ ...a, workspace_id: this.id, updated_at: new Date().toISOString() }));
  }
  async deleteSocial(platform: SocialAccount["platform"]) {
    check(await sb().from("social_accounts").delete().eq("workspace_id", this.id).eq("platform", platform));
  }
}

class SupabaseAccounts implements AccountRepo {
  async countUsers() {
    const res = await sb().from("users").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(`Database: ${res.error.message}`);
    return res.count ?? 0;
  }
  async listUsers() {
    return check(await sb().from("users").select("*").order("created_at", { ascending: true })) as User[];
  }
  async getUserById(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("users").select("*").eq("id", id).maybeSingle()) as User | null;
  }
  async getUserByEmail(email: string) {
    return check(await sb().from("users").select("*").eq("email", email.toLowerCase()).maybeSingle()) as User | null;
  }
  async createUser(u: NewUser) {
    const res = await sb().from("users").insert({ ...u, email: u.email.toLowerCase() }).select("*").single();
    if (res.error?.code === "23505") throw new Error("Email sudah terdaftar");
    return check(res) as User;
  }
  async updateUser(id: string, patch: Partial<User>) {
    check(await sb().from("users").update(userPatch(patch)).eq("id", id));
  }
  async deleteUser(id: string) {
    check(await sb().from("users").delete().eq("id", id));
  }
  async createWorkspace(name: string) {
    return check(await sb().from("workspaces").insert({ name }).select("*").single()) as Workspace;
  }
  async setWorkspaceOwner(id: string, ownerId: string) {
    check(await sb().from("workspaces").update({ owner_id: ownerId }).eq("id", id));
  }
  async getWorkspace(id: string) {
    if (!UUID.test(id)) return null;
    return check(await sb().from("workspaces").select("*").eq("id", id).maybeSingle()) as Workspace | null;
  }
  async setWorkspacePublishKey(id: string, key: string | null) {
    check(await sb().from("workspaces").update({ publish_key: key }).eq("id", id));
  }
  async setWorkspacePlan(id: string, plan: PlanKey) {
    check(await sb().from("workspaces").update({ plan }).eq("id", id));
  }
  async listWorkspaces() {
    return check(await sb().from("workspaces").select("*").order("created_at", { ascending: true })) as Workspace[];
  }
  async deleteWorkspace(id: string) {
    // Konten workspace ikut terhapus (foreign key ON DELETE CASCADE).
    check(await sb().from("workspaces").delete().eq("id", id));
  }
  async listUsageAll(since: string, limit = 2000) {
    return (check(await sb().from("usage_logs").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(limit)) as UsageLog[]).map(numUsage);
  }
  async listDuePosts(now: string, limit: number) {
    return check(
      await sb().from("posts").select("*").eq("status", "scheduled").is("deleted_at", null).is("publish_ref", null).lte("scheduled_at", now).order("scheduled_at").limit(limit),
    ) as Post[];
  }
  async listExpiringSocial(before: string, limit: number) {
    return check(await sb().from("social_accounts").select("*").lt("expires_at", before).limit(limit)) as SocialAccount[];
  }
  async publishCronKey() {
    const { data, error } = await sb().rpc("publish_cron_key");
    return error || typeof data !== "string" ? null : data;
  }
  async claimDuePost(id: string, ref: string) {
    const rows = check(await sb().from("posts").update({ publish_ref: ref }).eq("id", id).eq("status", "scheduled").is("publish_ref", null).select("id")) as { id: string }[];
    return rows.length > 0;
  }
  async listStaleLinks(before: string, limit: number) {
    return check(
      await sb()
        .from("tracked_links")
        .select("*")
        .or(`checked_at.is.null,checked_at.lt.${before}`)
        .order("checked_at", { ascending: true, nullsFirst: true })
        .limit(limit),
    ) as TrackedLink[];
  }
}

// ---------------------------------------------------------------- Lokal

interface LocalData {
  brands?: Record<string, Brand>;
  ideas: Idea[];
  posts: Post[];
  messages?: ChatMessage[];
  chats?: Chat[];
  jobs?: Job[];
  users?: User[];
  workspaces?: Workspace[];
  links?: TrackedLink[];
  usage?: UsageLog[];
  social?: SocialAccount[];
}

export const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_DB = path.join(LOCAL_DIR, "db.json");
export const LOCAL_MEDIA = path.join(LOCAL_DIR, "media");

// Semua tulis-ulang file lokal diserialkan (job agen & request owner bisa jalan bersamaan).
const g = globalThis as unknown as { __mtLocalQueue?: Promise<unknown> };

async function readLocal(): Promise<LocalData> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_DB, "utf8")) as LocalData;
  } catch {
    return { ideas: [], posts: [] };
  }
}
async function writeLocal(d: LocalData) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const tmp = `${LOCAL_DB}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.rename(tmp, LOCAL_DB);
}
function mutateLocal<T>(fn: (d: LocalData) => T): Promise<T> {
  const run = (g.__mtLocalQueue ?? Promise.resolve()).then(async () => {
    const d = await readLocal();
    const out = fn(d);
    await writeLocal(d);
    return out;
  });
  g.__mtLocalQueue = run.catch(() => {});
  return run;
}

class LocalWorkspace implements WorkspaceRepo {
  constructor(readonly id: string) {}
  private mine<T extends { workspace_id: string }>(rows: T[] | undefined) {
    return (rows ?? []).filter((r) => r.workspace_id === this.id);
  }
  async getBrand() {
    return mergeBrand((await readLocal()).brands?.[this.id]);
  }
  async saveBrand(brand: Brand) {
    await mutateLocal((d) => {
      d.brands = { ...(d.brands ?? {}), [this.id]: brand };
    });
  }
  async listIdeas() {
    return this.mine((await readLocal()).ideas).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getIdea(id: string) {
    return this.mine((await readLocal()).ideas).find((i) => i.id === id) ?? null;
  }
  async createIdeas(ideas: NewIdea[]) {
    const now = Date.now();
    const created: Idea[] = ideas.map((i, n) => ({
      ...i,
      reference: i.reference ?? null,
      id: randomUUID(),
      workspace_id: this.id,
      status: "pending",
      feedback: null,
      post_id: null,
      created_at: new Date(now - n).toISOString(),
    }));
    await mutateLocal((d) => {
      d.ideas.push(...created);
    });
    return created;
  }
  async updateIdea(id: string, patch: Partial<Idea>) {
    await mutateLocal((d) => {
      d.ideas = d.ideas.map((i) => (i.id === id && i.workspace_id === this.id ? { ...i, ...safePatch(patch) } : i));
    });
  }
  async listPosts() {
    return this.mine((await readLocal()).posts)
      .filter((p) => !p.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async countPostsCreated(since?: string) {
    return this.mine((await readLocal()).posts).filter((p) => !since || p.created_at >= since).length;
  }
  async deletePosts(ids: string[]) {
    const set = new Set(ids);
    const now = new Date().toISOString();
    await mutateLocal((d) => {
      d.posts = d.posts.map((p) => (p.workspace_id === this.id && set.has(p.id) ? { ...p, deleted_at: now } : p));
    });
  }
  async getPost(id: string) {
    return this.mine((await readLocal()).posts).find((p) => p.id === id && !p.deleted_at) ?? null;
  }
  async createPost(post: NewPost) {
    const now = new Date().toISOString();
    const created: Post = {
      ...post,
      reference: post.reference ?? null,
      story: post.story ?? null,
      id: randomUUID(),
      workspace_id: this.id,
      scheduled_at: null,
      media_urls: [],
      publish_ref: null,
      publish_result: null,
      error: null,
      revision_count: 0,
      created_at: now,
      updated_at: now,
    };
    await mutateLocal((d) => {
      d.posts.push(created);
    });
    return created;
  }
  async updatePost(id: string, patch: Partial<Post>) {
    await mutateLocal((d) => {
      d.posts = d.posts.map((p) =>
        p.id === id && p.workspace_id === this.id ? { ...p, ...safePatch(patch), ...touch(patch) } : p,
      );
    });
  }
  async uploadFile(key: string, data: Buffer) {
    const safe = wsKey(this.id, key);
    const full = path.join(LOCAL_MEDIA, safe);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return `${config.appUrl}/api/media/${safe}`;
  }
  async listMessages(limit: number, chatId?: string) {
    return this.mine((await readLocal()).messages)
      .filter((m) => !chatId || m.chat_id === chatId)
      .slice(-limit)
      .map((m) => ({ ...m, attachments: m.attachments ?? [] }));
  }
  async addMessage(m: NewMessage) {
    const now = new Date().toISOString();
    const msg: ChatMessage = { ...m, attachments: m.attachments ?? [], chat_id: m.chat_id ?? null, id: randomUUID(), workspace_id: this.id, created_at: now };
    await mutateLocal((d) => {
      d.messages = [...(d.messages ?? []), msg].slice(-5000);
      if (m.chat_id) d.chats = (d.chats ?? []).map((c) => (c.id === m.chat_id && c.workspace_id === this.id ? { ...c, updated_at: now } : c));
    });
    return msg;
  }
  async listChats(limit: number) {
    return this.mine((await readLocal()).chats)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, limit);
  }
  async getChat(id: string) {
    return this.mine((await readLocal()).chats).find((c) => c.id === id) ?? null;
  }
  async createChat(title: string) {
    const now = new Date().toISOString();
    const chat: Chat = { id: randomUUID(), workspace_id: this.id, title, created_at: now, updated_at: now };
    await mutateLocal((d) => {
      d.chats = [...(d.chats ?? []), chat];
    });
    return chat;
  }
  async updateChat(id: string, patch: Partial<Pick<Chat, "title">>) {
    await mutateLocal((d) => {
      d.chats = (d.chats ?? []).map((c) => (c.id === id && c.workspace_id === this.id ? { ...c, ...patch } : c));
    });
  }
  async deleteChat(id: string) {
    await mutateLocal((d) => {
      d.chats = (d.chats ?? []).filter((c) => !(c.id === id && c.workspace_id === this.id));
      d.messages = (d.messages ?? []).filter((m) => !(m.chat_id === id && m.workspace_id === this.id));
    });
  }
  async getActiveJob() {
    const job = this.mine((await readLocal()).jobs).filter((j) => j.status === "running").at(-1) ?? null;
    if (job && Date.now() - new Date(job.updated_at).getTime() > JOB_STALE_MS) {
      await this.updateJob(job.id, { status: "error" });
      return null;
    }
    return job;
  }
  async createJob(j: Pick<Job, "agent" | "label">) {
    const now = new Date().toISOString();
    const job: Job = { ...j, id: randomUUID(), workspace_id: this.id, status: "running", created_at: now, updated_at: now };
    await mutateLocal((d) => {
      d.jobs = [...(d.jobs ?? []), job].slice(-500);
    });
    return job;
  }
  async updateJob(id: string, patch: Partial<Job>) {
    await mutateLocal((d) => {
      d.jobs = (d.jobs ?? []).map((j) =>
        j.id === id && j.workspace_id === this.id ? { ...j, ...safePatch(patch), updated_at: new Date().toISOString() } : j,
      );
    });
  }
  async listLinks() {
    return this.mine((await readLocal()).links).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getLink(id: string) {
    return this.mine((await readLocal()).links).find((l) => l.id === id) ?? null;
  }
  async createLink(l: NewLink) {
    const link: TrackedLink = {
      ...l,
      id: randomUUID(),
      workspace_id: this.id,
      post_id: l.post_id ?? null,
      title: null,
      thumbnail: null,
      metrics: null,
      history: [],
      status: "pending",
      error: null,
      checked_at: null,
      created_at: new Date().toISOString(),
    };
    await mutateLocal((d) => {
      if ((d.links ?? []).some((x) => x.workspace_id === this.id && x.url === l.url)) throw new Error("Link ini sudah dipantau");
      d.links = [...(d.links ?? []), link];
    });
    return link;
  }
  async updateLink(id: string, patch: Partial<TrackedLink>) {
    await mutateLocal((d) => {
      d.links = (d.links ?? []).map((l) => (l.id === id && l.workspace_id === this.id ? { ...l, ...safePatch(patch) } : l));
    });
  }
  async deleteLink(id: string) {
    await mutateLocal((d) => {
      d.links = (d.links ?? []).filter((l) => !(l.id === id && l.workspace_id === this.id));
    });
  }
  async addUsage(u: NewUsage) {
    const row: UsageLog = { ...u, id: randomUUID(), workspace_id: this.id, created_at: new Date().toISOString() };
    await mutateLocal((d) => {
      d.usage = [...(d.usage ?? []), row].slice(-5000);
    });
  }
  async listUsage(since: string, limit = 500) {
    return this.mine((await readLocal()).usage)
      .filter((u) => u.created_at >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async getSocial(platform: SocialAccount["platform"]) {
    return ((await readLocal()).social ?? []).find((x) => x.workspace_id === this.id && x.platform === platform) ?? null;
  }
  async saveSocial(a: Omit<SocialAccount, "workspace_id" | "updated_at">) {
    await mutateLocal((d) => {
      d.social = [...(d.social ?? []).filter((x) => !(x.workspace_id === this.id && x.platform === a.platform)), { ...a, workspace_id: this.id, updated_at: new Date().toISOString() }];
    });
  }
  async deleteSocial(platform: SocialAccount["platform"]) {
    await mutateLocal((d) => {
      d.social = (d.social ?? []).filter((x) => !(x.workspace_id === this.id && x.platform === platform));
    });
  }
}

class LocalAccounts implements AccountRepo {
  async listUsageAll(since: string, limit = 2000) {
    return ((await readLocal()).usage ?? [])
      .filter((u) => u.created_at >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async listDuePosts(now: string, limit: number) {
    return (await readLocal()).posts
      .filter((p) => p.status === "scheduled" && !p.deleted_at && !p.publish_ref && p.scheduled_at && p.scheduled_at <= now)
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
      .slice(0, limit);
  }
  async listExpiringSocial(before: string, limit: number) {
    return ((await readLocal()).social ?? []).filter((x) => x.expires_at && x.expires_at < before).slice(0, limit);
  }
  async publishCronKey() {
    return null;
  }
  async claimDuePost(id: string, ref: string) {
    let ok = false;
    await mutateLocal((d) => {
      const p = d.posts.find((x) => x.id === id && x.status === "scheduled" && !x.publish_ref);
      if (p) {
        p.publish_ref = ref;
        ok = true;
      }
    });
    return ok;
  }
  async listStaleLinks(before: string, limit: number) {
    return ((await readLocal()).links ?? [])
      .filter((l) => !l.checked_at || l.checked_at < before)
      .sort((a, b) => (a.checked_at ?? "").localeCompare(b.checked_at ?? ""))
      .slice(0, limit);
  }
  async countUsers() {
    return ((await readLocal()).users ?? []).length;
  }
  async listUsers() {
    return (await readLocal()).users ?? [];
  }
  async getUserById(id: string) {
    return ((await readLocal()).users ?? []).find((u) => u.id === id) ?? null;
  }
  async getUserByEmail(email: string) {
    return ((await readLocal()).users ?? []).find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async createUser(u: NewUser) {
    const user: User = { ...u, email: u.email.toLowerCase(), id: randomUUID(), created_at: new Date().toISOString(), last_login_at: null };
    await mutateLocal((d) => {
      if ((d.users ?? []).some((x) => x.email === user.email)) throw new Error("Email sudah terdaftar");
      d.users = [...(d.users ?? []), user];
    });
    return user;
  }
  async updateUser(id: string, patch: Partial<User>) {
    await mutateLocal((d) => {
      d.users = (d.users ?? []).map((u) => (u.id === id ? { ...u, ...userPatch(patch) } : u));
    });
  }
  async deleteUser(id: string) {
    await mutateLocal((d) => {
      d.users = (d.users ?? []).filter((u) => u.id !== id);
    });
  }
  async createWorkspace(name: string) {
    const ws: Workspace = { id: randomUUID(), name, owner_id: null, publish_key: null, plan: "free", created_at: new Date().toISOString() };
    await mutateLocal((d) => {
      d.workspaces = [...(d.workspaces ?? []), ws];
    });
    return ws;
  }
  async setWorkspaceOwner(id: string, ownerId: string) {
    await mutateLocal((d) => {
      d.workspaces = (d.workspaces ?? []).map((w) => (w.id === id ? { ...w, owner_id: ownerId } : w));
    });
  }
  async getWorkspace(id: string) {
    return ((await readLocal()).workspaces ?? []).find((w) => w.id === id) ?? null;
  }
  async setWorkspacePlan(id: string, plan: PlanKey) {
    await mutateLocal((d) => {
      d.workspaces = (d.workspaces ?? []).map((w) => (w.id === id ? { ...w, plan } : w));
    });
  }
  async setWorkspacePublishKey(id: string, key: string | null) {
    await mutateLocal((d) => {
      d.workspaces = (d.workspaces ?? []).map((w) => (w.id === id ? { ...w, publish_key: key } : w));
    });
  }
  async listWorkspaces() {
    return (await readLocal()).workspaces ?? [];
  }
  async deleteWorkspace(id: string) {
    await mutateLocal((d) => {
      const keep = <T extends { workspace_id: string }>(rows: T[] | undefined) => (rows ?? []).filter((r) => r.workspace_id !== id);
      d.workspaces = (d.workspaces ?? []).filter((w) => w.id !== id);
      d.ideas = keep(d.ideas);
      d.posts = keep(d.posts);
      d.messages = keep(d.messages);
      d.chats = keep(d.chats);
      d.jobs = keep(d.jobs);
      if (d.brands) delete d.brands[id];
      d.users = (d.users ?? []).map((u) => (u.workspace_id === id ? { ...u, workspace_id: null } : u));
    });
  }
}

// ---------------------------------------------------------------- akses

export function db(workspaceId: string): WorkspaceRepo {
  if (!workspaceId) throw new Error("Workspace tidak diketahui");
  return config.hasSupabase ? new SupabaseWorkspace(workspaceId) : new LocalWorkspace(workspaceId);
}

let acc: AccountRepo | null = null;
export function accounts(): AccountRepo {
  if (!acc) acc = config.hasSupabase ? new SupabaseAccounts() : new LocalAccounts();
  return acc;
}

/**
 * Repo workspace yang terkunci ke satu percakapan: pesan dibaca & ditulis hanya di chat ini.
 * Semua fungsi lain (brand, ide, konten, job) tetap per workspace.
 */
export function inChat(w: WorkspaceRepo, chatId: string): WorkspaceRepo {
  const scoped = Object.create(w) as WorkspaceRepo;
  scoped.listMessages = (limit: number) => w.listMessages(limit, chatId);
  scoped.addMessage = (m: NewMessage) => w.addMessage({ ...m, chat_id: chatId });
  return scoped;
}
