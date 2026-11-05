import { redirect } from "next/navigation";

/** Alamat lama: Studio kini ada di Beranda (chat baru) & riwayat percakapan. */
export default function StudioRedirect() {
  redirect("/beranda");
}
