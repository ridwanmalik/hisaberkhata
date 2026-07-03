import {
  ArrowLeft,
  Banknote,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  History,
  Home,
  Landmark,
  Plus,
  Smartphone,
  Trash2,
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
  delete: Trash2,
  back: ArrowLeft,
  prev: ChevronLeft,
  next: ChevronRight,
  close: X,
  bank: Landmark,
  mfs: Smartphone,
  cash: Banknote,
  card: CreditCard,
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
