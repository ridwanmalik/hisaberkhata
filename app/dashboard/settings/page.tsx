"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  exportBackup,
  exportTransactionsCsv,
  importBackup,
} from "@/lib/backup";
import { useDataSummary } from "@/lib/hooks";
import { ROUTES } from "@/lib/routes";

type Status = { kind: "success" | "error"; message: string } | null;

const SettingsPage = () => {
  const router = useRouter();
  const summary = useDataSummary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const runExport = async (
    label: string,
    fn: () => Promise<void>,
  ) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ kind: "success", message: `${label} downloaded.` });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : `Could not export ${label}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const pickImportFile = () => {
    setStatus(null);
    fileInputRef.current?.click();
  };

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (file) setPendingFile(file);
  };

  const confirmImport = async () => {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      await importBackup(file);
      setStatus({ kind: "success", message: "Backup restored." });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not restore backup",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => router.push(ROUTES.dashboard)}
          aria-label="Go back"
          className="rounded-full"
        >
          <Icon name="back" />
        </Button>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <Card className="gap-0 py-4">
        <CardContent className="flex items-center justify-around px-4 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">
              {summary?.accounts ?? "–"}
            </p>
            <p className="text-xs text-muted-foreground">Accounts</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">
              {summary?.transactions ?? "–"}
            </p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted-foreground">
          Everything lives only on this device. Back it up regularly, and
          before switching phones.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => runExport("Backup", exportBackup)}
          className="w-full justify-start"
        >
          <Icon name="download" /> Export backup (.json)
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={pickImportFile}
          className="w-full justify-start"
        >
          <Icon name="upload" /> Restore from backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={onFileChosen}
          className="hidden"
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Export</h2>
        <p className="text-sm text-muted-foreground">
          A spreadsheet of every transaction, for reconciling in Excel or
          Sheets. This is one-way — it can&apos;t be imported back.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => runExport("CSV", exportTransactionsCsv)}
          className="w-full justify-start"
        >
          <Icon name="csv" /> Export transactions (.csv)
        </Button>
      </section>

      {status && (
        <p
          className={`text-sm ${status.kind === "error" ? "text-destructive" : "text-primary"}`}
        >
          {status.message}
        </p>
      )}

      <ConfirmDialog
        open={pendingFile !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFile(null);
        }}
        title="Restore this backup?"
        description="This replaces every account and transaction on this device with what's in the backup file. This cannot be undone."
        confirmLabel="Restore"
        onConfirm={confirmImport}
      />
    </div>
  );
};

export default SettingsPage;
