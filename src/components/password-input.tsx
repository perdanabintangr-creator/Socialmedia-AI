"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Input password dengan tombol lihat/sembunyikan. */
export function PasswordInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute inset-y-0 right-1 my-auto grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
