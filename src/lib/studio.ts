import "server-only";
import { z } from "zod";
import type { NewMessage, WorkspaceRepo } from "./db";
import { config } from "./config";
import { brandSystemPrompt, callStructured } from "./ai";
import { AGENTS, type AgentId } from "./agents";
import {
  approveAndPublish,
  buildPostFromIdea,
  createIdeas,
  defaultScheduleWib,
  nowWib,
  parseWib,
  revisePostWith,
  type Progress,
} from "./pipeline";
import { analyzeReference, describeReference } from "./reference";
import { metered } from "./cost";
import { brandGaps, quotaOf } from "./plans";
import { VISUAL_STYLES, withVisualStyle, type Idea, type Job, type Post, type PostFormat, type PostReference, type VisualStyleKey } from "./types";

/**
 * Studio: owner ngobrol dengan tim agen (Kata, Rupa, Siar).
 * 1. Pesan owner → diputuskan aksinya (Claude, atau aturan kata kunci di mode demo)
 * 2. Agen membalas singkat
 * 3. Pekerjaan berat dijalankan di latar belakang (job); tiap agen melapor progres ke chat
 */

const say = (w: WorkspaceRepo, agent: AgentId, text: string, extra: Partial<NewMessage> = {}) =>
  w.addMessage({ role: "agent", agent, kind: "text", text, refs: [], ...extra });

export const userSays = (w: WorkspaceRepo, text: string, attachments: string[] = []) =>
  w.addMessage({ role: "user", agent: null, kind: "text", text, refs: [], attachments });

/** Gambar referensi yang dilampirkan owner pada sebuah pesan. */
export interface Attach {
  urls: string[];
  useRefColors: boolean; // true: pakai palet referensi; false: tetap warna brand
  style?: VisualStyleKey; // arah visual pilihan owner (tanpa gambar pun boleh)
}

const fmtWib = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) + " WIB"
    : "-";

// ------------------------------------------------------------------ keputusan

const Decision = z.object({
  action: z.enum(["ideas", "create_post", "revise", "approve", "reject", "status", "chat"]),
  speaker: z.enum(["kata", "rupa", "siar"]).describe("Agen yang paling pas membalas: kata (ide/naskah), rupa (desain/revisi visual), siar (jadwal/posting/status)"),
  reply: z.string().describe("Balasan singkat 1-2 kalimat, santai & ramah, sebagai agen tersebut. Jangan janji hal yang tidak dikerjakan aksi ini"),
  brief: z.string().describe("ideas/create_post: topik / arahan dari owner. Selain itu kosong"),
  count: z.number().describe("ideas: jumlah ide (1-10), default 5. Selain itu 0"),
  format: z.enum(["auto", "single", "carousel"]),
  targetId: z.string().describe("revise/approve/reject: id konten (post) atau ide yang dimaksud. Kosong bila tidak jelas"),
  instruction: z.string().describe("revise: instruksi revisi selengkap mungkin. Selain itu kosong"),
  when: z.enum(["now", "schedule"]).describe("approve: posting sekarang atau dijadwalkan (default schedule)"),
  scheduleAt: z.string().describe("approve + schedule: waktu WIB format YYYY-MM-DDTHH:mm, atau kosong untuk jam default"),
});
type DecisionT = z.infer<typeof Decision>;

interface Snapshot {
  pendingIdeas: Idea[];
  review: Post[];
  upcoming: Post[];
  published: Post[];
}

async function snapshot(w: WorkspaceRepo): Promise<Snapshot> {
  const [ideas, posts] = await Promise.all([w.listIdeas(), w.listPosts()]);
  return {
    pendingIdeas: ideas.filter((i) => i.status === "pending").slice(0, 15),
    review: posts.filter((p) => p.status === "review" || p.status === "failed").slice(0, 10),
    upcoming: posts
      .filter((p) => p.status === "scheduled" || p.status === "approved")
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
      .slice(0, 10),
    published: posts.filter((p) => p.status === "published").slice(0, 5),
  };
}

async function decide(w: WorkspaceRepo, text: string, snap: Snapshot, refCount = 0): Promise<DecisionT> {
  if (!config.hasAI) return demoDecide(text, snap, refCount);
  const brand = await w.getBrand();
  const history = (await w.listMessages(14))
    .map((m) => `${m.role === "user" ? "Owner" : AGENTS[m.agent ?? "kata"].name}: ${m.text}`)
    .join("\n");
  const state = JSON.stringify(
    {
      ide_menunggu_acc: snap.pendingIdeas.map((i) => ({ id: i.id, judul: i.title, format: i.format })),
      konten_menunggu_acc: snap.review.map((p) => ({ id: p.id, judul: p.title, slide: p.slides.length, revisi: p.revision_count })),
      terjadwal: snap.upcoming.map((p) => ({ id: p.id, judul: p.title, jadwal: fmtWib(p.scheduled_at), status: p.status })),
      sudah_terbit: snap.published.map((p) => ({ judul: p.title, waktu: fmtWib(p.scheduled_at) })),
    },
    null,
    1,
  );
  const system = `${brandSystemPrompt(brand)}

# Peranmu sekarang: koordinator tim di Studio chat
Owner mengobrol dengan tim agen: Kata (strategi & naskah), Rupa (desain & visual), Siar (jadwal & posting ke Instagram & TikTok). Tugasmu membaca pesan owner lalu memilih SATU aksi:
- ideas: owner minta ide / brainstorming.
- create_post: owner minta langsung dibuatkan konten tentang topik tertentu.
- revise: owner minta mengubah konten yang sedang menunggu ACC (teks, visual, foto, caption, dsb).
- approve: owner menyetujui konten (ACC / oke / posting / jadwalkan). Jika targetId tidak disebut, pilih konten menunggu ACC terbaru.
- reject: owner menolak/membuang ide atau konten.
- status: owner bertanya jadwal, progres, apa yang sudah/akan terbit. Jawab langsung di reply berdasarkan data.
- chat: sapaan, pertanyaan umum, atau hal lain. Jawab membantu di reply.
Gunakan id persis dari data. Jangan mengarang id.
Pesan PERTAMA di percakapan baru yang berisi topik, judul, atau tema konten (walau singkat, mis. "Coming soon produk X", "promo akhir bulan") = create_post. Adanya konten menunggu ACC dengan judul mirip BUKAN alasan untuk memilih chat — owner sedang meminta konten baru. Pilih revise hanya bila owner jelas meminta mengubah konten yang sudah ada.
Bila owner melampirkan gambar referensi desain: pilih create_post (atau ideas bila owner minta ide, atau revise bila owner minta konten yang sedang menunggu ACC dibuat seperti referensi). Jangan pilih chat untuk pesan berlampiran.`;
  const user = `Sekarang: ${nowWib()} (WIB)

Data saat ini:
${state}

Percakapan terakhir:
${history || "(belum ada)"}

Pesan baru dari owner: ${text}${refCount ? `\n(Owner melampirkan ${refCount} gambar referensi desain.)` : ""}`;
  return callStructured(system, user, Decision, "low");
}

/** Mode demo: aturan kata kunci sederhana. */
function demoDecide(text: string, snap: Snapshot, refCount = 0): DecisionT {
  const t = text.toLowerCase();
  const base: DecisionT = {
    action: "chat",
    speaker: "kata",
    reply: "",
    brief: "",
    count: 0,
    format: "auto",
    targetId: "",
    instruction: "",
    when: "schedule",
    scheduleAt: "",
  };
  const latest = snap.review[0];
  if (/\b(acc|setuju|approve|oke posting|gas)\b/.test(t) && latest) {
    return { ...base, action: "approve", speaker: "siar", targetId: latest.id, when: /sekarang/.test(t) ? "now" : "schedule", reply: "Siap! Aku render versi final dan atur jadwalnya." };
  }
  if (/(revisi|ubah|ganti|perbaiki|lebih |kurang)/.test(t) && latest) {
    return { ...base, action: "revise", speaker: "rupa", targetId: latest.id, instruction: text, reply: "Oke, aku dan Kata kerjakan revisinya." };
  }
  if (/(jadwal|status|kapan|terbit)/.test(t)) {
    return { ...base, action: "status", speaker: "siar", reply: "" };
  }
  if (/\bide\b|brainstorm/.test(t)) {
    const n = Number(/(\d+)/.exec(t)?.[1] ?? 5);
    return { ...base, action: "ideas", speaker: "kata", brief: text, count: Math.min(10, Math.max(1, n)), reply: "Siap, aku cari ide-idenya dulu ya." };
  }
  if (refCount || /(buat|bikin|carousel|konten|post)/.test(t)) {
    return { ...base, action: "create_post", speaker: "kata", brief: text, format: /single/.test(t) ? "single" : /carousel/.test(t) ? "carousel" : "auto", reply: "Siap! Aku susun angle & naskahnya, nanti Rupa yang desain." };
  }
  return {
    ...base,
    reply:
      "Halo! Kami siap bantu. Coba ketik misalnya: “buatkan 5 ide konten minggu ini”, “bikin carousel tentang tips branding”, atau “ACC, jadwalkan besok jam 7 malam”. (Mode demo: isi ANTHROPIC_API_KEY supaya kami benar-benar pintar.)",
  };
}

function statusText(snap: Snapshot) {
  const lines: string[] = [];
  if (snap.review.length) lines.push(`Menunggu ACC kamu: ${snap.review.map((p) => `“${p.title}”`).join(", ")}.`);
  if (snap.pendingIdeas.length) lines.push(`Ada ${snap.pendingIdeas.length} ide yang belum kamu pilih.`);
  if (snap.upcoming.length)
    lines.push(`Jadwal: ${snap.upcoming.map((p) => `“${p.title}” → ${fmtWib(p.scheduled_at)}${p.status === "approved" ? " (belum terkirim, auto-post belum aktif)" : ""}`).join("; ")}.`);
  if (snap.published.length) lines.push(`Terakhir terbit: “${snap.published[0].title}”.`);
  return lines.length ? lines.join("\n") : "Belum ada konten yang berjalan. Mau aku minta Kata siapkan ide?";
}

// ------------------------------------------------------------------ job

type Task =
  | { type: "ideas"; brief: string; count: number; format?: PostFormat; ref?: Attach }
  | { type: "create_post"; brief: string; format?: PostFormat; ref?: Attach }
  | { type: "build_from_idea"; ideaId: string }
  | { type: "revise"; postId: string; instruction: string; ref?: Attach }
  | { type: "approve"; postId: string; scheduleAt: Date | null };

const taskRef = (t: Task): Attach | undefined => ("ref" in t && t.ref?.urls.length ? t.ref : undefined);
const taskStyle = (t: Task): VisualStyleKey | undefined => ("ref" in t ? t.ref?.style : undefined);

const FIRST_AGENT: Record<Task["type"], [AgentId, string]> = {
  ideas: ["kata", "Kata sedang mencari ide…"],
  create_post: ["kata", "Kata sedang menulis naskah…"],
  build_from_idea: ["kata", "Kata sedang menulis naskah…"],
  revise: ["kata", "Kata sedang merevisi…"],
  approve: ["siar", "Siar sedang merender & menjadwalkan…"],
};

export async function activeJob(w: WorkspaceRepo): Promise<Job | null> {
  return w.getActiveJob();
}

/** Buat job lalu kembalikan fungsi yang menjalankannya (dipanggil lewat after()). */
export async function startTask(w: WorkspaceRepo, task: Task): Promise<() => Promise<void>> {
  const [agent, label] = taskRef(task) ? (["rupa", "Rupa sedang mempelajari referensimu…"] as const) : FIRST_AGENT[task.type];
  const job = await w.createJob({ agent, label });
  const kind = task.type === "approve" ? "other" : task.type === "build_from_idea" ? "build_post" : task.type;
  return () => metered(w, kind, () => runTask(w, job, task));
}

const NEXT_LABEL: Partial<Record<AgentId, [AgentId, string]>> = {
  kata: ["rupa", "Rupa sedang menyusun desain…"],
  rupa: ["rupa", "Rupa sedang mengecek hasil render…"],
};

async function runTask(w: WorkspaceRepo, job: Job, task: Task) {
  let current: AgentId = job.agent;
  const progress: Progress = async (agent, text) => {
    await say(w, agent, text);
    const next = NEXT_LABEL[agent];
    if (next) {
      current = next[0];
      await w.updateJob(job.id, { agent: next[0], label: next[1] });
    }
  };
  try {
    // Referensi dipelajari dulu oleh Rupa, baru tim mulai menulis & mendesain.
    let reference: PostReference | null = null;
    const ref = taskRef(task);
    if (ref) {
      current = "rupa";
      reference = await analyzeReference(await w.getBrand(), ref.urls, ref.useRefColors);
      const summary = describeReference(reference);
      await say(
        w,
        "rupa",
        `Referensimu sudah kupelajari${summary ? `: ${summary}` : ""}. Gayanya kubuat semirip mungkin, isinya tetap untuk brand kamu.${!config.hasAI ? " (Mode demo: warna & gaya latar sudah mengikuti referensi; peniruan layout & copy aktif setelah ANTHROPIC_API_KEY diisi.)" : ""}`,
      );
      const [a, l] = FIRST_AGENT[task.type];
      current = a;
      await w.updateJob(job.id, { agent: a, label: l });
    }
    // Arah visual pilihan owner (Beranda) atau default Brand Kit.
    const style = taskStyle(task) ?? (task.type === "ideas" || task.type === "create_post" ? (await w.getBrand()).visualStyle : undefined);
    reference = withVisualStyle(reference, style);
    switch (task.type) {
      case "ideas": {
        const ideas = await createIdeas(w, task.brief, task.count, task.format, reference);
        await say(w, "kata", `Ini ${ideas.length} ide buat kamu. Pilih yang kamu suka, klik ACC, nanti aku & Rupa langsung kerjakan.`, {
          kind: "ideas",
          refs: ideas.map((i) => i.id),
        });
        break;
      }
      case "create_post": {
        const [idea] = await createIdeas(w, task.brief, 1, task.format, reference);
        await say(w, "kata", `Angle-nya: “${idea.title}” (${idea.format === "carousel" ? "carousel" : "single post"}). Hook: “${idea.hook}”. Aku tulis naskahnya sekarang.`);
        await deliverPost(w, await buildPostFromIdea(w, idea.id, progress));
        break;
      }
      case "build_from_idea": {
        await deliverPost(w, await buildPostFromIdea(w, task.ideaId, progress));
        break;
      }
      case "revise": {
        await deliverPost(w, await revisePostWith(w, task.postId, task.instruction, progress, reference), true);
        break;
      }
      case "approve": {
        current = "siar";
        const res = await approveAndPublish(w, task.postId, task.scheduleAt);
        const when = task.scheduleAt ? fmtWib(task.scheduleAt.toISOString()) : "sekarang";
        await say(w, 
          "siar",
          res.ok
            ? res.post.status === "scheduled" || res.post.status === "published"
              ? `Beres! “${res.post.title}” ${task.scheduleAt ? `terjadwal ${when}` : "sedang diposting"} ke ${res.post.platforms.map((p) => (p === "instagram" ? "Instagram" : "TikTok")).join(" & ")}.`
              : `${res.message}${task.scheduleAt ? ` Jadwal yang kucatat: ${when}.` : ""}`
            : res.message,
          { kind: res.ok ? "post" : "error", refs: [task.postId] },
        );
        break;
      }
    }
    await w.updateJob(job.id, { status: "done" });
  } catch (e) {
    console.error("Job gagal:", e);
    await say(w, current, `Maaf, ada kendala: ${e instanceof Error ? e.message : "terjadi kesalahan"}. Coba ulangi ya.`, { kind: "error" });
    await w.updateJob(job.id, { status: "error" });
  }
}

async function deliverPost(w: WorkspaceRepo, post: Post, revised = false) {
  const intro = revised ? "Revisi sudah masuk. Cek lagi ya." : `Desain ${post.slides.length > 1 ? `${post.slides.length} slide` : ""} siap!`;
  const notes = post.design_notes ? `\nCatatan dariku: ${post.design_notes}` : "";
  await say(w, "rupa", `${intro} Kalau sudah oke tinggal ACC, atau ketik revisinya di sini.${notes}`, { kind: "post", refs: [post.id] });
}

// ------------------------------------------------------------------ pesan owner

/** Proses pesan owner. Mengembalikan job yang perlu dijalankan di latar belakang (bila ada). */
export async function handleMessage(w: WorkspaceRepo, text: string, attach?: Attach): Promise<(() => Promise<void>) | null> {
  const ref = attach?.urls.length || attach?.style ? attach : undefined;
  const hasImages = !!attach?.urls.length;
  await userSays(w, text, attach?.urls ?? []);
  const running = await activeJob(w);
  if (running) {
    await say(w, running.agent, `Sebentar ya, aku masih ${running.label.replace(/^\w+ sedang /, "").replace(/…$/, "")}. Pesanmu kubaca setelah ini selesai.`);
    return null;
  }
  const snap = await snapshot(w);
  let d: DecisionT;
  try {
    d = await decide(w, text, snap, ref?.urls.length ?? 0);
    // Pesan pertama di chat baru yang berupa topik konten: langsung kerjakan, jangan cuma dijawab.
    const first = (await w.listMessages(60)).filter((m) => m.role === "user").length <= 1;
    if (first && d.action === "chat" && (attach?.style || (text.trim().length >= 10 && !/\?\s*$/.test(text.trim())))) {
      d = { ...d, action: "create_post", speaker: "kata", brief: d.brief || text, reply: "" };
    }
    // Pesan berlampiran selalu jadi pekerjaan desain, bukan obrolan.
    if (hasImages && !["ideas", "create_post", "revise"].includes(d.action)) d = { ...d, action: "create_post", speaker: "rupa", brief: d.brief || text };
  } catch (e) {
    await say(w, "kata", `Maaf, aku lagi kesulitan memahami pesan ini (${e instanceof Error ? e.message : "error"}). Coba lagi ya.`, { kind: "error" });
    return null;
  }
  const format = d.format === "auto" ? undefined : d.format;
  const brand = await w.getBrand();

  switch (d.action) {
    case "ideas":
      await say(w, "kata", d.reply || "Siap, aku cari ide dulu.");
      return startTask(w, { type: "ideas", brief: d.brief || text, count: Math.min(10, Math.max(1, Math.round(d.count) || 5)), format, ref });
    case "create_post":
      if (await gate(w)) return null;
      await say(
        w,
        hasImages ? "rupa" : "kata",
        hasImages
          ? "Referensinya sudah kuterima! Aku pelajari dulu gayanya ya."
          : `${d.reply || "Siap, kukerjakan."}${attach?.style ? ` Arah visualnya: ${VISUAL_STYLES[attach.style].label}.` : ""}`,
      );
      return startTask(w, { type: "create_post", brief: d.brief || text, format, ref });
    case "revise": {
      const post = snap.review.find((p) => p.id === d.targetId) ?? snap.review[0];
      if (!post) {
        await say(w, "rupa", "Belum ada konten yang menunggu ACC untuk direvisi. Mau kubuatkan konten baru?");
        return null;
      }
      await say(w, d.speaker, d.reply || "Oke, kami revisi.");
      return startTask(w, { type: "revise", postId: post.id, instruction: d.instruction || text, ref });
    }
    case "approve": {
      const post = snap.review.find((p) => p.id === d.targetId) ?? snap.review[0];
      if (!post) {
        await say(w, "siar", "Belum ada konten yang menunggu ACC. Kalau ada ide yang kamu suka, klik ACC di kartunya ya.");
        return null;
      }
      let when: Date | null = null;
      if (d.when === "schedule") {
        when = parseWib(d.scheduleAt) ?? parseWib(defaultScheduleWib(brand.postingTime));
        if (when && when.getTime() < Date.now() + 5 * 60_000) when = parseWib(defaultScheduleWib(brand.postingTime));
      }
      await say(w, "siar", d.reply || "Siap, kuproses.");
      return startTask(w, { type: "approve", postId: post.id, scheduleAt: when });
    }
    case "reject": {
      const post = snap.review.find((p) => p.id === d.targetId);
      const idea = snap.pendingIdeas.find((i) => i.id === d.targetId);
      if (post) await w.updatePost(post.id, { status: "rejected" });
      else if (idea) await w.updateIdea(idea.id, { status: "rejected" });
      await say(w, d.speaker, d.reply || (post || idea ? "Oke, sudah kubuang." : "Yang mana ya? Sebutkan judulnya."));
      return null;
    }
    case "status":
      await say(w, "siar", config.hasAI && d.reply ? d.reply : statusText(snap));
      return null;
    default:
      await say(w, d.speaker, d.reply || "Siap membantu!");
      return null;
  }
}

/**
 * Sebelum membuat konten: cek kuota paket & kelengkapan Brand Kit (paket kualitas penuh).
 * Mengembalikan pesan penolakan (sudah dikirim ke chat) atau null bila boleh lanjut.
 */
async function gate(w: WorkspaceRepo): Promise<string | null> {
  const q = await quotaOf(w);
  if (!q.ok) {
    await say(w, "siar", `${q.message} Lihat pilihan paket di menu Akun.`, { kind: "error" });
    return q.message;
  }
  if (q.plan.quality === "full") {
    const gaps = brandGaps(await w.getBrand());
    if (gaps.length) {
      const msg = `Sebelum kubuat desain kualitas penuh, aku perlu kenal brand kamu dulu: ${gaps.join(" & ")} masih kosong. Buka menu Brand Kit, tempel alamat website lalu klik "Isi otomatis dari website" (atau isi manual & upload logo), lalu kirim lagi permintaanmu ya.`;
      await say(w, "rupa", msg, { kind: "error" });
      return msg;
    }
  }
  return null;
}

/** Klik tombol di kartu chat. */
export async function approveIdeaFromChat(w: WorkspaceRepo, ideaId: string) {
  const idea = await w.getIdea(ideaId);
  if (!idea) throw new Error("Ide tidak ditemukan");
  if (await activeJob(w)) throw new Error("Tim masih mengerjakan tugas lain, tunggu sebentar ya");
  await userSays(w, `ACC ide: “${idea.title}”`);
  if (await gate(w)) return null;
  await say(w, "kata", "Mantap, pilihan bagus! Aku tulis naskahnya sekarang.");
  return startTask(w, { type: "build_from_idea", ideaId });
}

export async function approvePostFromChat(w: WorkspaceRepo, postId: string, scheduleAt: Date | null) {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (await activeJob(w)) throw new Error("Tim masih mengerjakan tugas lain, tunggu sebentar ya");
  await userSays(w, `ACC “${post.title}” — ${scheduleAt ? `jadwalkan ${fmtWib(scheduleAt.toISOString())}` : "posting sekarang"}`);
  return startTask(w, { type: "approve", postId, scheduleAt });
}
