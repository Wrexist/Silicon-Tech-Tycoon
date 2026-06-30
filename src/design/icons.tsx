// Central icon system — premium Lucide vector icons, NEVER emojis (project rule).
import {
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Cpu,
  Gamepad2,
  Watch,
  Glasses,
  Wrench,
  PencilRuler,
  Megaphone,
  BatteryCharging,
  Layers3,
  CodeXml,
  Camera,
  Users,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId, ComponentKind, StaffRole } from "../engine/types.ts";

const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Cpu,
  monitor: Monitor,
  console: Gamepad2,
  wearable: Watch,
  experimental: Glasses,
};

const ROLE_ICON: Record<StaffRole, LucideIcon> = {
  engineer: Wrench,
  designer: PencilRuler,
  marketer: Megaphone,
  hr: Users,
  researcher: FlaskConical,
};

export function CategoryIcon({ id, size = 16 }: { id: CategoryId; size?: number }) {
  const Ico = CATEGORY_ICON[id];
  return <Ico size={size} strokeWidth={2} aria-hidden />;
}

export function RoleIcon({ role, size = 18 }: { role: StaffRole; size?: number }) {
  const Ico = ROLE_ICON[role];
  return <Ico size={size} strokeWidth={2} aria-hidden />;
}

// Component-line glyphs for the Design Lab tiles (chip, display, …). All Lucide, no assets.
const COMPONENT_ICON: Record<ComponentKind, LucideIcon> = {
  chip: Cpu,
  display: Monitor,
  battery: BatteryCharging,
  materials: Layers3,
  software: CodeXml,
  camera: Camera,
};

export function ComponentIcon({ kind, size = 20 }: { kind: ComponentKind; size?: number }) {
  const Ico = COMPONENT_ICON[kind];
  return <Ico size={size} strokeWidth={2} aria-hidden />;
}
