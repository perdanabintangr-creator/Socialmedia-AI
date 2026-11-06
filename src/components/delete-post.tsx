"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deletePostsAction } from "@/app/actions";

/** Tombol hapus konten dengan konfirmasi; setelah terhapus kembali ke Hasil konten. */
export function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">
        <Trash2 size={15} /> Hapus konten ini
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
      <p className="text-sm font-semibold text-red-800">Hapus konten ini?</p>
      <p className="mt-1 text-xs text-red-700/80">Tidak bisa dikembalikan. Kuota yang sudah terpakai tidak bertambah kembali.</p>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deletePostsAction([id]);
              if (r?.error) return setError(r.error);
              router.push("/posts");
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Hapus
        </button>
        <button type="button" onClick={() => setAsk(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
          Batal
        </button>
      </div>
    </div>
  );
}
