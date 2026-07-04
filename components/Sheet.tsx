"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Cover the whole screen instead of a bottom sheet. */
  fullscreen?: boolean;
  children: ReactNode;
}

/** Mobile-style bottom sheet built on the shadcn Drawer (vaul). */
const Sheet = ({ open, onClose, title, fullscreen, children }: SheetProps) => (
  <Drawer
    open={open}
    onOpenChange={(next) => {
      if (!next) onClose();
    }}
    repositionInputs={false}
  >
    <DrawerContent
      className={cn(
        "mx-auto w-full max-w-md",
        fullscreen &&
          "h-[100dvh] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-t-none",
      )}
    >
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-lg">{title}</DrawerTitle>
      </DrawerHeader>
      <div
        className={cn(
          "overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          fullscreen && "flex-1",
        )}
      >
        {children}
      </div>
    </DrawerContent>
  </Drawer>
);

export default Sheet;
