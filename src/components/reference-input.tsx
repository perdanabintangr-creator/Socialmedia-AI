"use client";

import { boardLinks, pinLinks } from "@/lib/pin-link";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export const MAX_REFS = 6;

export interface RefItem {
  id: string;
  file: File;
  url: string; // object URL untuk pratinjau
}

/** Perkecil gambar di browser (maks 1600 px, JPEG) supaya unggahan cepat & di bawah batas server. */
async function compress(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], (file.name || "referensi").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // format yang tidak dikenali browser: kirim apa adanya, server yang mengolah
  }
}

/** State gambar referensi: tambah lewat tombol, tempel (Ctrl+V), atau seret & lepas. */
export function useReferences() {
  const [items, setItems] = useState<RefItem[]>([]);
  const [colors, setColors] = useState<"ref" | "brand">("ref");
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const live = useRef<RefItem[]>([]);
  live.current = items;

  useEffect(() => () => live.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const add = useCallback(async (list: FileList | File[]) => {
    const imgs = [...list].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      setNote("Yang bisa dilampirkan hanya gambar (JPG, PNG, WebP).");
      return;
    }
    const room = MAX_REFS - live.current.length;
    if (room <= 0) {
      setNote(`Maksimal ${MAX_REFS} gambar referensi.`);
      return;
    }
    setNote(imgs.length > room ? `Maksimal ${MAX_REFS} gambar referensi, sisanya dilewati.` : null);
    const files = await Promise.all(imgs.slice(0, room).map(compress));
    setItems((prev) => [...prev, ...files.map((file) => ({ id: Math.random().toString(36).slice(2), file, url: URL.createObjectURL(file) }))].slice(0, MAX_REFS));
  }, []);

  const remove = (id: string) =>
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });

  /** Kosongkan daftar. Object URL tidak dicabut di sini karena pratinjau pesan terkirim masih memakainya. */
  const clear = () => {
    setItems([]);
    setNote(null);
  };

  const appendTo = (fd: FormData) => {
    for (const i of items) fd.append("refs", i.file);
    if (items.length) fd.set("colors", colors);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      void add(files);
    }
  };

  const dropZone = {
    onDragOver: (e: React.DragEvent) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setDragging(false);
      void add(e.dataTransfer.files);
    },
  };

  return { items, colors, setColors, dragging, note, add, remove, clear, appendTo, onPaste, dropZone };
}

export type References = ReturnType<typeof useReferences>;

/** Tombol lampirkan gambar (membuka pemilih file). */
export function AttachButton({ refs, compact = false }: { refs: References; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void refs.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label="Lampirkan gambar referensi"
        title="Lampirkan referensi (atau tempel dengan Ctrl+V / seret ke sini)"
        className={
          compact
            ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-line transition hover:text-ink hover:ring-slate-300"
        }
      >
        <ImagePlus size={compact ? 19 : 14} />
        {!compact && "Referensi"}
      </button>
    </>
  );
}

/** Deretan pratinjau referensi + pilihan warna. */
export function RefTray({ refs }: { refs: References }) {
  if (!refs.items.length && !refs.note) return null;
  return (
    <div className="animate-fade-up">
      {refs.items.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          {refs.items.map((r, i) => (
            <span key={r.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt={`Referensi ${i + 1}`} className="h-20 w-16 rounded-xl object-cover ring-1 ring-line" />
              <button
                type="button"
                onClick={() => refs.remove(r.id)}
                aria-label={`Hapus referensi ${i + 1}`}
                className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white shadow-soft"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </span>
          ))}
          <div className="ml-1 flex flex-col gap-1.5 pb-0.5">
            <span className="text-[11px] font-semibold text-slate-500">
              {refs.items.length} referensi · AI meniru layout, tipografi & gaya foto
            </span>
            <div className="inline-flex w-fit rounded-full bg-slate-100 p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="Warna desain">
              {(
                [
                  ["ref", "Warna referensi"],
                  ["brand", "Warna brand"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={refs.colors === k}
                  onClick={() => refs.setColors(k)}
                  className={`rounded-full px-2.5 py-1 transition ${refs.colors === k ? "bg-white text-ink shadow-soft" : "text-slate-500 hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {refs.note && <p className="mt-1.5 text-xs font-medium text-amber-700">{refs.note}</p>}
    </div>
  );
}

/** Lapisan saat file diseret ke atas kotak. */
export function DropOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[inherit] border-2 border-dashed border-brand-400 bg-brand-50/90 text-sm font-bold text-brand-700">
      <span className="flex items-center gap-2">
        <ImagePlus size={18} /> Lepas gambar referensi di sini
      </span>
    </div>
  );
}

/** Penanda: link Pinterest di pesan akan dipakai sebagai referensi desain. */
export function PinHint({ text }: { text: string }) {
  const n = pinLinks(text).length;
  const board = !n && boardLinks(text).length > 0;
  if (!n && !board) return null;
  return (
    <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${board ? "bg-amber-50 text-amber-800" : "bg-red-50 text-[#E60023]"}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-.79-.17-2 .03-2.86l1.2-5.08s-.3-.61-.3-1.5c0-1.41.82-2.46 1.83-2.46.87 0 1.29.65 1.29 1.43 0 .87-.56 2.18-.85 3.39-.24 1.01.51 1.84 1.51 1.84 1.81 0 3.2-1.91 3.2-4.66 0-2.44-1.75-4.14-4.25-4.14-2.9 0-4.6 2.17-4.6 4.42 0 .87.34 1.81.76 2.32a.3.3 0 0 1 .07.29l-.28 1.15c-.05.18-.15.22-.34.13-1.27-.59-2.06-2.44-2.06-3.93 0-3.2 2.33-6.14 6.71-6.14 3.52 0 6.26 2.51 6.26 5.86 0 3.5-2.2 6.31-5.26 6.31-1.03 0-2-.53-2.33-1.17l-.63 2.42c-.23.88-.85 1.98-1.26 2.65A10 10 0 1 0 12 2Z" />
      </svg>
      {board ? "Itu link board — salin link satu pin (pinterest.com/pin/… atau pin.it/…)" : `${n} pin Pinterest akan jadi referensi desain`}
    </p>
  );
}
