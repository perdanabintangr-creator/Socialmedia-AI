import { requireWorkspace } from "@/lib/session";
import { Studio } from "@/components/studio";
import { greetIfEmpty } from "@/lib/studio";
import { studioState } from "@/lib/studio-view";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // pekerjaan agen berjalan di latar belakang (after) setelah respons

export default async function StudioPage() {
  const { w } = await requireWorkspace();
  await greetIfEmpty(w);
  return <Studio initial={await studioState(w)} />;
}
