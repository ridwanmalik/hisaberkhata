const OfflinePage = () => (
  <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
    <span className="text-5xl">📴</span>
    <h1 className="text-lg font-bold">You&apos;re offline</h1>
    <p className="max-w-xs text-sm text-neutral-500">
      This page isn&apos;t cached yet. Your khata itself lives on this device —
      pages you&apos;ve visited before still work without a connection.
    </p>
  </div>
);

export default OfflinePage;
