"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/history", label: "History", icon: "history" },
  null, // slot for the add button
  { href: "/budget", label: "Budget", icon: "budget" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
] as const satisfies readonly (
  | { href: string; label: string; icon: IconName }
  | null
)[];

const BottomNav = () => {
  const pathname = usePathname();
  const openQuickEntry = useUIStore((s) => s.openQuickEntry);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item, i) =>
          item === null ? (
            <div key={i} className="flex justify-center">
              <Button
                onClick={() => openQuickEntry()}
                aria-label="Add entry"
                className="-mt-5 h-14 w-14 rounded-full shadow-lg shadow-primary/30"
              >
                <Icon name="add" className="size-7" />
              </Button>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                pathname === item.href
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Icon name={item.icon} className="size-5" />
              {item.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
};

export default BottomNav;
