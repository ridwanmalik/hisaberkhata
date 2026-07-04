import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Bus,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Gift,
  GraduationCap,
  Handshake,
  History,
  Home,
  House,
  Landmark,
  Lightbulb,
  Pencil,
  Percent,
  Pill,
  Plus,
  ReceiptText,
  Shirt,
  ShoppingCart,
  Smartphone,
  SmartphoneCharging,
  Store,
  Trash2,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Semantic icon registry. Always reference icons by their semantic name
 * (e.g. "add", "delete") rather than the underlying Lucide name, so the
 * concrete icon can be swapped app-wide from this one file.
 *
 * Brand/social icons must come from the `simple-icons` package (Lucide
 * removed brand icons) — wrap them here under a semantic name too.
 * See CLAUDE.md › Icon Component Usage.
 */
const ICONS = {
  home: Home,
  history: History,
  budget: CalendarRange,
  accounts: Landmark,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  back: ArrowLeft,
  prev: ChevronLeft,
  next: ChevronRight,
  close: X,
  calendar: Calendar,
  bank: Landmark,
  mfs: Smartphone,
  cash: Banknote,
  card: CreditCard,
  // Money-flow types
  handshake: Handshake,
  transfer: ArrowLeftRight,
  // Spending categories
  bazar: ShoppingCart,
  food: Utensils,
  transport: Bus,
  recharge: SmartphoneCharging,
  utilities: Lightbulb,
  rent: House,
  health: Pill,
  education: GraduationCap,
  clothing: Shirt,
  family: Users,
  gift: Gift,
  fees: Percent,
  receipt: ReceiptText,
  // Income categories
  salary: Briefcase,
  business: Store,
  coins: Coins,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const Icon = ({ name, size = 18, className, ...props }: IconProps) => {
  const LucideComponent: LucideIcon = ICONS[name];
  return (
    <LucideComponent
      size={size}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
};

export { Icon };
