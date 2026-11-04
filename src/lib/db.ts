import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { DEFAULT_BRAND, type Brand, type ChatMessage, type Idea, type Job, type Post, type User } from "./types";

/**
 * Lapisan data. Dua mode:
 * - Supabase (produksi): aktif bila SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di-set.
 * - Lokal (.data/): untuk coba-coba tanpa cloud. Gambar disajikan lewat /api/media.
 */

type NewIdea = Omit<Idea, "id" | "created_at" | "status" | "feedback" | "post_id">;
type NewPost = Omit<
  Post,
  | "id"
  | "created_at"
  | "updated_at"
  | "media_urls"
  | "publish_ref"
  | "publish_result"
  | "error"
  | "revision_count"
  | "scheduled_at"
>;

interface Repo {
  getBrand(): Promise<Brand>;
  saveBrand(brand: Brand): Promise<void>;
  listIdeas(): Promise<Idea[]>;
  getIdea(id: string): Promise<Idea | null>;
  createIdeas(ideas: NewIdea[]): Promise<Idea[]>;
  updateIdea(id: string, patch: Partial<Idea>): Promise<void>;
  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost): Promise<Post>;
  updatePost(id: string, patch: Partial<Post>): Promise<void>;
  uploadFile(key: string, data: Buffer, contentType: string): Promise<string>;
  listMessages(limit: number): Promise<ChatMessage[]>; // urut lama → baru
  addMessage(m: NewMessage): Promise<ChatMessage>;
  getActiveJob(): Promise<Job | null>;
  createJob(j: Pick<Job, "agent" | "label">): Promise<Job>;
  updateJob(id: string, patch: Partial<Job>): Promise<void>;
  countUsers(): Promise<number>;
  listUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(u: Pick<User, "name" | "email" | "password_hash" | "role" | "status">): Promise<User>;
  updateUser(id: string, patch: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export type NewMessage = Omit<ChatMessage, "id" | "created_at">;
const JOB_STALE_MS = 6 * 60_000; // job lebih lama dari ini dianggap macet

const BUCKET = "media";

function mergeBrand(data: Partial<Brand> | null | undefined): Brand {
  return {
    ...DEFAULT_BRAND,
    ...(data ?? {}),
    colors: { ...DEFAULT_BRAND.colors, ...(data?.colors ?? {}) },
  };
}

// ---------------------------------------------------------------- Supabase

class SupabaseRepo implements Repo {
  private sb: SupabaseClient;
  constructor() {
    this.sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(`Database: ${res.error.message}`);
    return res.data;
  }
  async getBrand() {
    const res = await this.sb.from("brand").select("data").eq("id", 1).maybeSingle();
    const row = this.check(res) as { data: Partial<Brand> } | null;
    return mergeBrand(row?.data);
  }
  async saveBrand(brand: Brand) {
    this.check(
      await this.sb
        .from("brand")
        .upsert({ id: 1, data: brand, updated_at: new Date().toISOString() }),
    );
  }
  async listIdeas() {
    return this.check(
      await this.sb.from("ideas").select("*").order("created_at", { ascending: false }).limit(200),
    ) as Idea[];
  }
  async getIdea(id: string) {
    return this.check(await this.sb.from("ideas").select("*").eq("id", id).maybeSingle()) as Idea | null;
  }
  async createIdeas(ideas: NewIdea[]) {
    return this.check(await this.sb.from("ideas").insert(ideas).select("*")) as Idea[];
  }
  async updateIdea(id: string, patch: Partial<Idea>) {
    this.check(await this.sb.from("ideas").update(patch).eq("id", id));
  }
  async listPosts() {
    return this.check(
      await this.sb.from("posts").select("*").order("created_at", { ascending: false }).limit(200),
    ) as Post[];
  }
  async getPost(id: string) {
    return this.check(await this.sb.from("posts").select("*").eq("id", id).maybeSingle()) as Post | null;
  }
  async createPost(post: NewPost) {
    return this.check(await this.sb.from("posts").insert(post).select("*").single()) as Post;
  }
  async updatePost(id: string, patch: Partial<Post>) {
    this.check(
      await this.sb
        .from("posts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id),
    );
  }
  async uploadFile(key: string, data: Buffer, contentType: string) {
    const { error } = await this.sb.storage
      .from(BUCKET)
      .upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`Storage: ${error.message}`);
    return this.sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  }
  async listMessages(limit: number) {
    const rows = this.check(
      await this.sb.from("messages").select("*").order("created_at", { ascending: false }).limit(limit),
    ) as ChatMessage[];
    return rows.reverse();
  }
  async addMessage(m: NewMessage) {
    return this.check(await this.sb.from("messages").insert(m).select("*").single()) as ChatMessage;
  }
  async getActiveJob() {
    const job = this.check(
      await this.sb.from("jobs").select("*").eq("status", "running").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ) as Job | null;
    if (job && Date.now() - new Date(job.updated_at).getTime() > JOB_STALE_MS) {
      await this.updateJob(job.id, { status: "error" });
      return null;
    }
    return job;
  }
  async createJob(j: Pick<Job, "agent" | "label">) {
    return this.check(await this.sb.from("jobs").insert({ ...j, status: "running" }).select("*").single()) as Job;
  }
  async updateJob(id: string, patch: Partial<Job>) {
    this.check(await this.sb.from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
  }
  async countUsers() {
    const res = await this.sb.from("users").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(`Database: ${res.error.message}`);
    return res.count ?? 0;
  }
  async listUsers() {
    return this.check(await this.sb.from("users").select("*").order("created_at", { ascending: true })) as User[];
  }
  async getUserById(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.check(await this.sb.from("users").select("*").eq("id", id).maybeSingle()) as User | null;
  }
  async getUserByEmail(email: string) {
    return this.check(await this.sb.from("users").select("*").eq("email", email.toLowerCase()).maybeSingle()) as User | null;
  }
  async createUser(u: Pick<User, "name" | "email" | "password_hash" | "role" | "status">) {
    const res = await this.sb.from("users").insert({ ...u, email: u.email.toLowerCase() }).select("*").single();
    if (res.error?.code === "23505") throw new Error("Email sudah terdaftar");
    return this.check(res) as User;
  }
  async updateUser(id: string, patch: Partial<User>) {
    this.check(await this.sb.from("users").update(patch).eq("id", id));
  }
  async deleteUser(id: string) {
    this.check(await this.sb.from("users").delete().eq("id", id));
  }
}

// ---------------------------------------------------------------- Lokal

interface LocalData {
  brand: Brand | null;
  ideas: Idea[];
  posts: Post[];
  messages?: ChatMessage[];
  jobs?: Job[];
  users?: User[];
}

export const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_DB = path.join(LOCAL_DIR, "db.json");
export const LOCAL_MEDIA = path.join(LOCAL_DIR, "media");

// Semua tulis-ulang file lokal diserialkan (job agen & request owner bisa jalan bersamaan).
const g = globalThis as unknown as { __mtLocalQueue?: Promise<unknown> };

class LocalRepo implements Repo {
  private async read(): Promise<LocalData> {
    try {
      return JSON.parse(await fs.readFile(LOCAL_DB, "utf8")) as LocalData;
    } catch {
      return { brand: null, ideas: [], posts: [] };
    }
  }
  private async write(d: LocalData) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    const tmp = `${LOCAL_DB}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2));
    await fs.rename(tmp, LOCAL_DB);
  }
  private mutate<T>(fn: (d: LocalData) => T): Promise<T> {
    const run = (g.__mtLocalQueue ?? Promise.resolve()).then(async () => {
      const d = await this.read();
      const out = fn(d);
      await this.write(d);
      return out;
    });
    g.__mtLocalQueue = run.catch(() => {});
    return run;
  }
  async getBrand() {
    return mergeBrand((await this.read()).brand);
  }
  async saveBrand(brand: Brand) {
    await this.mutate((d) => {
      d.brand = brand;
    });
  }
  async listIdeas() {
    return (await this.read()).ideas.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getIdea(id: string) {
    return (await this.read()).ideas.find((i) => i.id === id) ?? null;
  }
  async createIdeas(ideas: NewIdea[]) {
    const now = Date.now();
    const created: Idea[] = ideas.map((i, n) => ({
      ...i,
      id: randomUUID(),
      status: "pending",
      feedback: null,
      post_id: null,
      created_at: new Date(now - n).toISOString(),
    }));
    await this.mutate((d) => {
      d.ideas.push(...created);
    });
    return created;
  }
  async updateIdea(id: string, patch: Partial<Idea>) {
    await this.mutate((d) => {
      d.ideas = d.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i));
    });
  }
  async listPosts() {
    return (await this.read()).posts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getPost(id: string) {
    return (await this.read()).posts.find((p) => p.id === id) ?? null;
  }
  async createPost(post: NewPost) {
    const now = new Date().toISOString();
    const created: Post = {
      ...post,
      id: randomUUID(),
      scheduled_at: null,
      media_urls: [],
      publish_ref: null,
      publish_result: null,
      error: null,
      revision_count: 0,
      created_at: now,
      updated_at: now,
    };
    await this.mutate((d) => {
      d.posts.push(created);
    });
    return created;
  }
  async updatePost(id: string, patch: Partial<Post>) {
    await this.mutate((d) => {
      d.posts = d.posts.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
    });
  }
  async uploadFile(key: string, data: Buffer) {
    const safe = key.replace(/\.\./g, "");
    const full = path.join(LOCAL_MEDIA, safe);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return `${config.appUrl}/api/media/${safe}`;
  }
  async listMessages(limit: number) {
    return ((await this.read()).messages ?? []).slice(-limit);
  }
  async addMessage(m: NewMessage) {
    const msg: ChatMessage = { ...m, id: randomUUID(), created_at: new Date().toISOString() };
    await this.mutate((d) => {
      d.messages = [...(d.messages ?? []), msg].slice(-500);
    });
    return msg;
  }
  async getActiveJob() {
    const jobs = (await this.read()).jobs ?? [];
    const job = jobs.filter((j) => j.status === "running").at(-1) ?? null;
    if (job && Date.now() - new Date(job.updated_at).getTime() > JOB_STALE_MS) {
      await this.updateJob(job.id, { status: "error" });
      return null;
    }
    return job;
  }
  async createJob(j: Pick<Job, "agent" | "label">) {
    const now = new Date().toISOString();
    const job: Job = { ...j, id: randomUUID(), status: "running", created_at: now, updated_at: now };
    await this.mutate((d) => {
      d.jobs = [...(d.jobs ?? []), job].slice(-50);
    });
    return job;
  }
  async updateJob(id: string, patch: Partial<Job>) {
    await this.mutate((d) => {
      d.jobs = (d.jobs ?? []).map((j) => (j.id === id ? { ...j, ...patch, updated_at: new Date().toISOString() } : j));
    });
  }
  async countUsers() {
    return ((await this.read()).users ?? []).length;
  }
  async listUsers() {
    return (await this.read()).users ?? [];
  }
  async getUserById(id: string) {
    return ((await this.read()).users ?? []).find((u) => u.id === id) ?? null;
  }
  async getUserByEmail(email: string) {
    return ((await this.read()).users ?? []).find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async createUser(u: Pick<User, "name" | "email" | "password_hash" | "role" | "status">) {
    const user: User = { ...u, email: u.email.toLowerCase(), id: randomUUID(), created_at: new Date().toISOString(), last_login_at: null };
    await this.mutate((d) => {
      if ((d.users ?? []).some((x) => x.email === user.email)) throw new Error("Email sudah terdaftar");
      d.users = [...(d.users ?? []), user];
    });
    return user;
  }
  async updateUser(id: string, patch: Partial<User>) {
    await this.mutate((d) => {
      d.users = (d.users ?? []).map((u) => (u.id === id ? { ...u, ...patch } : u));
    });
  }
  async deleteUser(id: string) {
    await this.mutate((d) => {
      d.users = (d.users ?? []).filter((u) => u.id !== id);
    });
  }
}

let repo: Repo | null = null;
export function db(): Repo {
  if (!repo) repo = config.hasSupabase ? new SupabaseRepo() : new LocalRepo();
  return repo;
}
