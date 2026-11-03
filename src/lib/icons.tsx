import { icons } from "lucide";

/** Ikon yang boleh dipilih AI (nama lucide). Dikurasi agar relevan untuk konten bisnis/marketing. */
export const ICON_NAMES = [
  "Lightbulb", "Target", "TrendingUp", "ChartColumn", "ChartPie", "Rocket", "Users", "User",
  "MessageCircle", "Heart", "Star", "Sparkles", "Zap", "Clock", "Calendar", "CircleCheck",
  "CircleX", "CircleAlert", "ShieldCheck", "Wallet", "ShoppingBag", "ShoppingCart", "Store",
  "Megaphone", "Camera", "Video", "PenLine", "Palette", "Search", "Globe", "Smartphone", "Laptop",
  "Mail", "Gift", "Tag", "Percent", "Handshake", "Brain", "BookOpen", "GraduationCap", "Trophy",
  "Flag", "Compass", "Layers", "Settings", "Bot", "Coffee", "MapPin", "Send", "Bookmark", "Repeat",
  "ThumbsUp", "CircleDollarSign", "Package", "Truck", "Leaf", "Eye", "Lock", "Key", "Puzzle",
  "Wand", "Sprout", "Hourglass", "MousePointerClick",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

type IconNode = [string, Record<string, string | number>][];

export function Icon({
  name,
  size,
  color,
  strokeWidth = 2,
}: {
  name: string;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  const node = (icons as unknown as Record<string, IconNode>)[name] ?? icons.Sparkles;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(node as IconNode).map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}
