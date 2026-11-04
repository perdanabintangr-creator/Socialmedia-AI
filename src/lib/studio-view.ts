import "server-only";
import { db } from "./db";
import type { ChatMessage, Idea, Job, Post } from "./types";

export interface IdeaCard {
  id: string;
  title: string;
  hook: string;
  pillar: string;
  format: Idea["format"];
  status: Idea["status"];
  post_id: string | null;
}
export interface PostCard {
  id: string;
  title: string;
  status: Post["status"];
  slides: number;
  version: string;
  scheduled_at: string | null;
  media_urls: string[];
  caption: string;
  hashtags: string[];
}
export interface ChatView extends Omit<ChatMessage, "refs"> {
  ideas?: IdeaCard[];
  post?: PostCard;
}
export interface StudioState {
  messages: ChatView[];
  job: Job | null;
  postingTime: string;
}

export async function studioState(limit = 80): Promise<StudioState> {
  const [messages, job, ideas, posts, brand] = await Promise.all([
    db().listMessages(limit),
    db().getActiveJob(),
    db().listIdeas(),
    db().listPosts(),
    db().getBrand(),
  ]);
  const ideaById = new Map(ideas.map((i) => [i.id, i]));
  const postById = new Map(posts.map((p) => [p.id, p]));
  return {
    job,
    postingTime: brand.postingTime,
    messages: messages.map(({ refs, ...m }) => {
      const view: ChatView = { ...m };
      if (m.kind === "ideas") {
        view.ideas = refs
          .map((id) => ideaById.get(id))
          .filter((i): i is Idea => Boolean(i))
          .map((i) => ({ id: i.id, title: i.title, hook: i.hook, pillar: i.pillar, format: i.format, status: i.status, post_id: i.post_id }));
      }
      if ((m.kind === "post" || m.kind === "error") && refs[0] && postById.has(refs[0])) {
        const p = postById.get(refs[0])!;
        view.post = {
          id: p.id,
          title: p.title,
          status: p.status,
          slides: p.slides.length,
          version: p.updated_at,
          scheduled_at: p.scheduled_at,
          media_urls: p.media_urls,
          caption: p.caption,
          hashtags: p.hashtags,
        };
      }
      return view;
    }),
  };
}
