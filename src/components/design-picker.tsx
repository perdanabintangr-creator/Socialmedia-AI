"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutTemplate, Loader2, Sparkles, Type, AlignLeft } from "lucide-react";
import { DENSITIES, DENSITY_KEYS, PACKS, PACK_KEYS, PACK_DEFAULT_PAIR, type Density, type PackChoice, type PackKey, type PairChoice } from "@/lib/design";
import { FONT_PAIRS, FONT_PAIR_KEYS } from "@/lib/font-pairs";

const preview = (pack: PackKey, pair?: string, density: Density = "visual") =>
  `/api/design-preview?pack=${pack}&density=${density}${pair ? `&pair=${pair}` : ""}`;

function Tile({ on, onClick, children, label, sub }: { on: boolean; onClick: () => void; children: React.ReactNode; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white text-left transition ${on ? "ring-2 ring-brand-600 shadow-lift" : "ring-1 ring-line hover:ring-brand-300"}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">{children}</div>
      <div className="px-2.5 py-2">
        <div className="truncate text-xs font-bold text-ink">{label}</div>
        {sub ? <div className="line-clamp-2 text-[11px] leading-snug text-slate-500">{sub}</div> : null}
      </div>
      {on && (
        <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white shadow">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/* eslint-disable @next/next/no-img-element */
const Img = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />;

export interface DesignValue {
  pack: PackChoice;
  pair: PairChoice;
  density: Density;
}

/** Pemilih sistem desain: gaya (pack), pasangan huruf, dan kepadatan teks — dengan pratinjau brand sendiri. */
export function DesignPicker({ value, onChange, allowAuto = true, allowClassic = true }: { value: DesignValue; onChange: (v: DesignValue) => void; allowAuto?: boolean; allowClassic?: boolean }) {
  const shownPack: PackKey = value.pack === "auto" || value.pack === "classic" ? "editorial" : value.pack;
  const set = (p: Partial<DesignValue>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
          <LayoutTemplate size={16} className="text-brand-600" /> Gaya desain
        </h3>
        <p className="mb-3 text-xs text-slate-500">Contoh di bawah memakai nama & warna brand kamu.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {allowAuto && (
            <Tile on={value.pack === "auto"} onClick={() => set({ pack: "auto" })} label="Otomatis (AI pilih)" sub="AI memilih gaya terbaik per konten">
              <div className="bg-social grid h-full place-items-center text-white">
                <Sparkles size={34} />
              </div>
            </Tile>
          )}
          {PACK_KEYS.map((k) => (
            <Tile key={k} on={value.pack === k} onClick={() => set({ pack: k })} label={PACKS[k].label} sub={PACKS[k].desc}>
              <Img src={preview(k, value.pair !== "auto" ? value.pair : PACK_DEFAULT_PAIR[k], value.density)} alt={`Contoh gaya ${PACKS[k].label}`} />
            </Tile>
          ))}
          {allowClassic && (
            <Tile on={value.pack === "classic"} onClick={() => set({ pack: "classic" })} label="Template klasik" sub="Gaya lama + arah visual (Berita, Info, dll.)">
              <div className="grid h-full place-items-center bg-slate-200 text-slate-500">
                <LayoutTemplate size={30} />
              </div>
            </Tile>
          )}
        </div>
      </section>

      {value.pack !== "classic" && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
            <Type size={16} className="text-brand-600" /> Pasangan huruf
          </h3>
          <p className="mb-3 text-xs text-slate-500">Pilih karakter huruf yang paling “kamu”. Contoh ditampilkan dengan gaya {PACKS[shownPack].short}.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Tile on={value.pair === "auto"} onClick={() => set({ pair: "auto" })} label="Otomatis" sub="Sesuai jenis bisnis & referensi">
              <div className="bg-social grid h-full place-items-center text-white">
                <span className="text-3xl font-black">Aa</span>
              </div>
            </Tile>
            {FONT_PAIR_KEYS.map((k) => (
              <Tile key={k} on={value.pair === k} onClick={() => set({ pair: k })} label={FONT_PAIRS[k].label} sub={FONT_PAIRS[k].mood.split(",")[0]}>
                <Img src={preview(shownPack, k, value.density)} alt={`Contoh huruf ${FONT_PAIRS[k].label}`} />
              </Tile>
            ))}
          </div>
        </section>
      )}

      {value.pack !== "classic" && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
            <AlignLeft size={16} className="text-brand-600" /> Banyaknya tulisan di slide
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DENSITY_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ density: k })}
                aria-pressed={value.density === k}
                className={`rounded-xl px-3.5 py-3 text-left transition ${value.density === k ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-1 ring-line hover:ring-brand-300"}`}
              >
                <div className="text-sm font-bold text-ink">
                  {DENSITIES[k].label}
                  {k === "visual" ? <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Disarankan</span> : null}
                </div>
                <div className="text-xs text-slate-500">{DENSITIES[k].desc}</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Versi form (Brand Kit): nilai dikirim lewat input tersembunyi. */
export function DesignPickerField({ defaults }: { defaults: DesignValue }) {
  const [v, setV] = useState(defaults);
  return (
    <>
      <input type="hidden" name="designPack" value={v.pack} />
      <input type="hidden" name="fontPair" value={v.pair} />
      <input type="hidden" name="density" value={v.density} />
      <DesignPicker value={v} onChange={setV} />
    </>
  );
}

/** Ganti desain satu konten tanpa biaya AI: render ulang langsung. */
export function PostDesignSwitcher({
  initial,
  action,
}: {
  initial: { pack: PackKey | "classic"; pair: PairChoice; density: Density };
  action: (v: { pack: PackKey | "classic"; pair: PairChoice; density: Density }) => Promise<{ ok?: string; error?: string }>;
}) {
  const router = useRouter();
  const [v, setV] = useState<DesignValue>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = v.pack !== initial.pack || v.pair !== initial.pair || v.density !== initial.density;
  return (
    <div>
      <DesignPicker value={v} onChange={setV} allowAuto={false} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!changed || pending}
          onClick={() =>
            start(async () => {
              const r = await action({ pack: v.pack === "auto" ? "editorial" : v.pack, pair: v.pair, density: v.density });
              setMsg(r);
              if (r.ok) router.refresh();
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-ink/90 disabled:opacity-40"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Terapkan ke konten ini
        </button>
        <span className="text-xs text-slate-500">Gratis — tidak memakai kuota AI. Foto & teks tetap.</span>
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.ok ?? msg.error}</span>}
      </div>
    </div>
  );
}
