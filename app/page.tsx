import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/**
 * Landing page. Auth doesn't exist yet — both buttons just enter the
 * dashboard. When real auth lands (Phase 3), wire them up here.
 */
const LandingPage = () => (
  <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-12">
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
        ৳
      </span>
      <h1 className="text-3xl font-bold">Hisaber Khata</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        হিসাবের খাতা — a cash-first money manager.
        <br />
        Withdraw, spend, account for it lazily.
      </p>
    </div>
    <div className="space-y-3">
      <Button asChild className="h-12 w-full text-base font-semibold">
        <Link href={ROUTES.dashboard}>Log in</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        className="h-12 w-full text-base font-semibold"
      >
        <Link href={ROUTES.dashboard}>Sign up</Link>
      </Button>
      <p className="pt-1 text-center text-xs text-muted-foreground">
        No account needed yet — everything stays on your device.
      </p>
    </div>
  </div>
);

export default LandingPage;
