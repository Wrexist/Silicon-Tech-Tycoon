// Resolves an achievement's Lucide icon NAME (a pure engine string) to a real Lucide component.
// Keeps the engine DOM-free: engine/achievements.ts only names icons; the mapping lives here.
import {
  Rocket,
  Sparkles,
  Boxes,
  Factory,
  Building2,
  Layers,
  Cpu,
  BadgeDollarSign,
  TrendingUp,
  Gem,
  Users,
  Heart,
  Globe,
  Star,
  Crown,
  Flame,
  PiggyBank,
  LineChart,
  FlaskConical,
  UserPlus,
  Package,
  Zap,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { AchievementIconName } from "../engine/achievements.ts";

const ICONS: Record<AchievementIconName, LucideIcon> = {
  Rocket,
  Sparkles,
  Boxes,
  Factory,
  Building2,
  Layers,
  Cpu,
  BadgeDollarSign,
  TrendingUp,
  Gem,
  Users,
  Heart,
  Globe,
  Star,
  Crown,
  Flame,
  PiggyBank,
  LineChart,
  FlaskConical,
  UserPlus,
  Package,
  Zap,
  Trophy,
};

export function achievementIcon(name: AchievementIconName): LucideIcon {
  return ICONS[name] ?? Trophy;
}

export function AchievementIcon({
  name,
  size = 22,
  strokeWidth = 1.9,
}: {
  name: AchievementIconName;
  size?: number;
  strokeWidth?: number;
}) {
  const Ico = achievementIcon(name);
  return <Ico size={size} strokeWidth={strokeWidth} aria-hidden />;
}
