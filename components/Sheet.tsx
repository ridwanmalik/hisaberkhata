"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Mobile-style bottom sheet built on the shadcn Drawer (vaul). */
const Sheet = ({ open, onClose, title, children }: SheetProps) => (
  <Drawer
    open={open}
    onOpenChange={(next) => {
      if (!next) onClose();
    }}
    repositionInputs={false}
  >
    <DrawerContent className="mx-auto w-full max-w-md">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-lg">{title}</DrawerTitle>
      </DrawerHeader>
      <div className="overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </DrawerContent>
  </Drawer>
);

export default Sheet;
