/** Tim agen AI. Persona orisinal — tiap agen punya peran jelas di alur kerja. */
export type AgentId = "kata" | "rupa" | "siar";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  does: string;
  icon: "PenLine" | "Palette" | "Send";
  gradient: string; // kelas Tailwind
  ring: string;
}

export const AGENTS: Record<AgentId, Agent> = {
  kata: {
    id: "kata",
    name: "Kata",
    role: "Strategi & Naskah",
    does: "Riset ide, hook, naskah slide, dan caption",
    icon: "PenLine",
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-300",
  },
  rupa: {
    id: "rupa",
    name: "Rupa",
    role: "Desain & Visual",
    does: "Layout, foto, ikon, dan review hasil render",
    icon: "Palette",
    gradient: "from-fuchsia-500 to-violet-600",
    ring: "ring-violet-300",
  },
  siar: {
    id: "siar",
    name: "Siar",
    role: "Jadwal & Posting",
    does: "Render final, jadwal, dan posting ke Instagram & TikTok",
    icon: "Send",
    gradient: "from-sky-400 to-indigo-600",
    ring: "ring-sky-300",
  },
};

export const AGENT_LIST = Object.values(AGENTS);
