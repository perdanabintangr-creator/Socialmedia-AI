import { notFound } from "next/navigation";
import { inChat } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";
import { studioState } from "@/lib/studio-view";
import { ChatRoom } from "@/components/studio";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // pekerjaan agen berjalan di latar belakang (after) setelah respons

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { w } = await requireWorkspace();
  const chat = await w.getChat((await params).id);
  return { title: chat?.title ?? "Percakapan" };
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { w } = await requireWorkspace();
  const { id } = await params;
  const chat = await w.getChat(id);
  if (!chat) notFound();
  return <ChatRoom key={chat.id} chatId={chat.id} title={chat.title} initial={await studioState(inChat(w, chat.id))} />;
}
