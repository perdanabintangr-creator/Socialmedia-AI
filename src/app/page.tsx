import { Studio } from "@/components/studio";
import { greetIfEmpty } from "@/lib/studio";
import { studioState } from "@/lib/studio-view";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // pekerjaan agen berjalan di latar belakang (after) setelah respons

export default async function StudioPage() {
  await greetIfEmpty();
  return <Studio initial={await studioState()} />;
}
