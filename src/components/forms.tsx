"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/actions";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

const PendingCtx = createContext(false);

/**
 * Form untuk server action. Dikirim lewat onSubmit (bukan `action=`), supaya React tidak
 * mengosongkan isian setelah submit — isian tetap ada bila server mengembalikan error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnOk = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnOk && state?.ok) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingCtx.Provider value={pending}>{children}</PendingCtx.Provider>
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{state.ok}</p>
      )}
    </form>
  );
}

const VARIANTS = {
  primary: "bg-ink text-white shadow-[0_1px_2px_rgb(15_18_34/0.2)] hover:bg-ink/85",
  accent: "bg-brand-600 text-white shadow-[0_1px_2px_rgb(95_69_240/0.3)] hover:bg-brand-500",
  approve: "bg-emerald-600 text-white hover:bg-emerald-500",
  ghost: "bg-white text-slate-700 ring-1 ring-line hover:bg-slate-50",
  danger: "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50",
};

export function Submit({
  children,
  pendingText,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  name?: string;
  value?: string;
}) {
  const pending = useContext(PendingCtx);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {pending ? pendingText ?? "Memproses…" : children}
    </button>
  );
}

/** Panel buka-tutup yang tetap terbuka setelah server action me-refresh halaman. */
export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left font-semibold">
        <span className={`inline-block transition ${open ? "rotate-90" : ""}`}>▸</span> {title}
      </button>
      <div className={open ? "" : "hidden"}>{children}</div>
    </div>
  );
}
