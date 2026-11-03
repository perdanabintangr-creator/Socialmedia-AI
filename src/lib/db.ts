import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { DEFAULT_BRAND, type Brand, type Idea, type Post } from "./types";

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
}

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
}

// ---------------------------------------------------------------- Lokal

interface LocalData {
  brand: Brand | null;
  ideas: Idea[];
  posts: Post[];
}

export const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_DB = path.join(LOCAL_DIR, "db.json");
export const LOCAL_MEDIA = path.join(LOCAL_DIR, "media");

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
    const tmp = `${LOCAL_DB}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2));
    await fs.rename(tmp, LOCAL_DB);
  }
  async getBrand() {
    return mergeBrand((await this.read()).brand);
  }
  async saveBrand(brand: Brand) {
    const d = await this.read();
    d.brand = brand;
    await this.write(d);
  }
  async listIdeas() {
    return (await this.read()).ideas.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getIdea(id: string) {
    return (await this.read()).ideas.find((i) => i.id === id) ?? null;
  }
  async createIdeas(ideas: NewIdea[]) {
    const d = await this.read();
    const now = Date.now();
    const created: Idea[] = ideas.map((i, n) => ({
      ...i,
      id: randomUUID(),
      status: "pending",
      feedback: null,
      post_id: null,
      created_at: new Date(now - n).toISOString(),
    }));
    d.ideas.push(...created);
    await this.write(d);
    return created;
  }
  async updateIdea(id: string, patch: Partial<Idea>) {
    const d = await this.read();
    d.ideas = d.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i));
    await this.write(d);
  }
  async listPosts() {
    return (await this.read()).posts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getPost(id: string) {
    return (await this.read()).posts.find((p) => p.id === id) ?? null;
  }
  async createPost(post: NewPost) {
    const d = await this.read();
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
    d.posts.push(created);
    await this.write(d);
    return created;
  }
  async updatePost(id: string, patch: Partial<Post>) {
    const d = await this.read();
    d.posts = d.posts.map((p) =>
      p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p,
    );
    await this.write(d);
  }
  async uploadFile(key: string, data: Buffer) {
    const safe = key.replace(/\.\./g, "");
    const full = path.join(LOCAL_MEDIA, safe);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return `${config.appUrl}/api/media/${safe}`;
  }
}

let repo: Repo | null = null;
export function db(): Repo {
  if (!repo) repo = config.hasSupabase ? new SupabaseRepo() : new LocalRepo();
  return repo;
}
